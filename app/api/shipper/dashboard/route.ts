export const dynamic = "force-dynamic";
/**
 * Shipper Dashboard API
 *
 * GET /api/shipper/dashboard
 *
 * Provides dashboard statistics for shipper portal
 * Sprint 11 - Story 11.1: Shipper Dashboard
 *
 * AGGREGATION NOTE (2026-02-08):
 * Spending aggregation logic duplicates lib/aggregation.ts:getShipperSpendingSummary().
 * This is acceptable for now as the dashboard has additional requirements.
 * New aggregation logic should use lib/aggregation.ts as the single source of truth.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiErrors";

/**
 * GET /api/shipper/dashboard
 *
 * Returns:
 * - Total loads posted
 * - Active loads
 * - Completed loads
 * - Loads by status
 * - Wallet balance
 * - Pending matches
 * - Recent activity
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireActiveUser();

    // Check if user is a shipper or admin
    if (
      session.role !== "SHIPPER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Access denied. Shipper role required." },
        { status: 403 }
      );
    }

    // Check if user has an organization
    if (!session.organizationId) {
      return NextResponse.json(
        {
          error:
            "You must belong to an organization to access shipper features.",
        },
        { status: 400 }
      );
    }

    // H16 FIX: Verify user actually belongs to claimed organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user || user.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: "Session organization mismatch" },
        { status: 403 }
      );
    }

    // Parse optional date range for chart data (default: last 30 days)
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const chartStart = startDateParam
      ? new Date(startDateParam + "T00:00:00")
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const chartEnd = endDateParam
      ? new Date(endDateParam + "T23:59:59")
      : new Date();

    // Start of current month for "this month" queries
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get statistics in parallel
    const [
      totalLoads,
      activeLoads,
      inTransitLoads,
      deliveredLoads,
      totalSpentResult,
      pendingPaymentsResult,
      loadsByStatus,
      walletAccount,
      loadsOverTimeRaw,
      spendingOverTimeRaw,
    ] = await Promise.all([
      // Total loads
      db.load.count({
        where: { shipperId: session.organizationId },
      }),

      // Active loads (all pre-delivery states)
      db.load.count({
        where: {
          shipperId: session.organizationId,
          status: {
            in: [
              "POSTED",
              "SEARCHING",
              "OFFERED",
              "ASSIGNED",
              "PICKUP_PENDING",
            ],
          },
        },
      }),

      // In-transit loads
      db.load.count({
        where: {
          shipperId: session.organizationId,
          status: "IN_TRANSIT",
        },
      }),

      // Delivered this month (DELIVERED + COMPLETED)
      db.load.count({
        where: {
          shipperId: session.organizationId,
          status: { in: ["DELIVERED", "COMPLETED"] },
          updatedAt: { gte: startOfMonth },
        },
      }),

      // Total spent: sum of SERVICE_FEE_DEDUCT debits from journal entries.
      // SOURCE OF TRUTH: journal lines, NOT Load.shipperServiceFee — this
      // ensures dashboard agrees with /shipper/wallet (which derives totals
      // from the journal too). Previously these used different sources and
      // could diverge.
      db.journalLine.aggregate({
        where: {
          account: {
            organizationId: session.organizationId,
            accountType: "SHIPPER_WALLET",
          },
          isDebit: true,
          journalEntry: { transactionType: "SERVICE_FEE_DEDUCT" },
        },
        _sum: { amount: true },
      }),

      // Pending payments: sum of shipperServiceFee for reserved (in-progress) loads
      db.load.aggregate({
        where: {
          shipperId: session.organizationId,
          shipperFeeStatus: "RESERVED",
        },
        _sum: { shipperServiceFee: true },
      }),

      // Loads by status
      db.load.groupBy({
        by: ["status"],
        where: { shipperId: session.organizationId },
        _count: true,
      }),

      // Wallet account
      db.financialAccount.findFirst({
        where: {
          organizationId: session.organizationId,
          accountType: "SHIPPER_WALLET",
        },
        select: {
          balance: true,
          currency: true,
        },
      }),

      // Loads over time (for chart)
      db.$queryRaw<{ date: Date; count: bigint }[]>`
        SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*) as count
        FROM loads
        WHERE "shipperId" = ${session.organizationId}
          AND "createdAt" >= ${chartStart} AND "createdAt" <= ${chartEnd}
        GROUP BY DATE_TRUNC('day', "createdAt")
        ORDER BY date ASC
      `,

      // Spending over time (for chart) — derived from journal entries
      // (single source of truth, matches /shipper/wallet aggregation)
      db.$queryRaw<{ date: Date; amount: number }[]>`
        SELECT DATE_TRUNC('day', je."createdAt") as date,
               COALESCE(SUM(jl."amount"), 0) as amount
        FROM journal_lines jl
        JOIN journal_entries je ON jl."journalEntryId" = je.id
        JOIN financial_accounts fa ON jl."accountId" = fa.id
        WHERE fa."organizationId" = ${session.organizationId}
          AND fa."accountType" = 'SHIPPER_WALLET'
          AND jl."isDebit" = true
          AND je."transactionType" = 'SERVICE_FEE_DEDUCT'
          AND je."createdAt" >= ${chartStart}
          AND je."createdAt" <= ${chartEnd}
        GROUP BY DATE_TRUNC('day', je."createdAt")
        ORDER BY date ASC
      `,
    ]);

    const totalSpent = Number(totalSpentResult._sum?.amount || 0);
    const pendingPayments = Number(
      pendingPaymentsResult._sum?.shipperServiceFee || 0
    );

    return NextResponse.json({
      stats: {
        totalLoads,
        activeLoads,
        inTransitLoads,
        deliveredLoads,
        totalSpent,
        pendingPayments,
      },
      loadsByStatus: loadsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      wallet: {
        balance: Number(walletAccount?.balance || 0),
        currency: walletAccount?.currency || "ETB",
      },
      charts: {
        loadsOverTime: loadsOverTimeRaw.map((item) => ({
          date: item.date,
          count: Number(item.count),
        })),
        spendingOverTime: spendingOverTimeRaw.map((item) => ({
          date: item.date,
          amount: Number(item.amount),
        })),
      },
    });
  } catch (error) {
    return handleApiError(error, "Shipper dashboard error");
  }
}

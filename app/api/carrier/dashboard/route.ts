export const dynamic = "force-dynamic";
/**
 * Carrier Dashboard API
 *
 * GET /api/carrier/dashboard
 *
 * Provides dashboard statistics for carrier portal
 * Sprint 12 - Story 12.1: Carrier Dashboard
 *
 * AGGREGATION NOTE (2026-02-08):
 * Earnings aggregation logic duplicates lib/aggregation.ts:getCarrierEarningsSummary().
 * This is acceptable for now as the dashboard has additional requirements.
 * New aggregation logic should use lib/aggregation.ts as the single source of truth.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";

/**
 * GET /api/carrier/dashboard
 *
 * Returns carrier-specific statistics using Trip model for accurate data:
 * - Total trucks in fleet (filtered by carrierId)
 * - Active trucks available for work
 * - Active postings
 * - Completed deliveries (from Trip model, filtered by carrierId)
 * - In-transit trips
 * - Total revenue (from Trip model, filtered by carrierId)
 * - Total distance traveled
 * - Wallet balance
 * - Recent postings
 * - Pending truck approvals
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limiting: Apply dashboard RPS limit
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      RPS_CONFIGS.dashboard.endpoint,
      ip,
      RPS_CONFIGS.dashboard.rps,
      RPS_CONFIGS.dashboard.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down.", retryAfter: 1 },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rpsResult.limit.toString(),
            "X-RateLimit-Remaining": rpsResult.remaining.toString(),
            "Retry-After": "1",
          },
        }
      );
    }

    const session = await requireActiveUser();

    // Check if user is a carrier or admin
    if (
      session.role !== "CARRIER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Access denied. Carrier role required." },
        { status: 403 }
      );
    }

    // Check if user has an organization
    if (!session.organizationId) {
      return NextResponse.json(
        {
          error:
            "You must belong to an organization to access carrier features.",
        },
        { status: 400 }
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

    // Get statistics in parallel using Trip model for carrier-specific data
    const [
      totalTrucks,
      activeTrucks,
      activePostings,
      completedTrips,
      inTransitTrips,
      tripStats,
      revenueResult,
      walletAccount,
      recentPostings,
      pendingApprovals,
      tripsOverTimeRaw,
      earningsOverTimeRaw,
    ] = await Promise.all([
      // Total trucks owned by this carrier
      db.truck.count({
        where: { carrierId: session.organizationId },
      }),

      // Active trucks (available for work)
      db.truck.count({
        where: {
          carrierId: session.organizationId,
          isAvailable: true,
        },
      }),

      // Active postings (ACTIVE status)
      db.truckPosting.count({
        where: {
          carrierId: session.organizationId,
          status: "ACTIVE",
        },
      }),

      // Completed deliveries - using Trip model with carrierId filter
      db.trip.count({
        where: {
          carrierId: session.organizationId,
          status: { in: ["DELIVERED", "COMPLETED"] },
        },
      }),

      // In-transit trips
      db.trip.count({
        where: {
          carrierId: session.organizationId,
          status: "IN_TRANSIT",
        },
      }),

      // Trip stats - distance
      db.trip.aggregate({
        where: {
          carrierId: session.organizationId,
          status: { in: ["DELIVERED", "COMPLETED"] },
        },
        _sum: {
          estimatedDistanceKm: true,
          actualDistanceKm: true,
        },
      }),

      // Total service fees paid: sum of SERVICE_FEE_DEDUCT debits from
      // journal entries. SOURCE OF TRUTH: journal lines, NOT
      // Load.carrierServiceFee — this ensures dashboard agrees with
      // /carrier/wallet (which derives totals from the journal too).
      db.journalLine.aggregate({
        where: {
          account: {
            organizationId: session.organizationId,
            accountType: "CARRIER_WALLET",
          },
          isDebit: true,
          journalEntry: { transactionType: "SERVICE_FEE_DEDUCT" },
        },
        _sum: { amount: true },
      }),

      // Wallet account
      db.financialAccount.findFirst({
        where: {
          organizationId: session.organizationId,
          accountType: "CARRIER_WALLET",
        },
        select: {
          balance: true,
          currency: true,
        },
      }),

      // Recent postings (last 7 days)
      db.truckPosting.count({
        where: {
          carrierId: session.organizationId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Trucks pending approval
      db.truck.count({
        where: {
          carrierId: session.organizationId,
          approvalStatus: "PENDING",
        },
      }),

      // Trips over time (for chart)
      db.$queryRaw<{ date: Date; completed: bigint; cancelled: bigint }[]>`
        SELECT
          DATE_TRUNC('day', "updatedAt") as date,
          COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'COMPLETED')) as completed,
          COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
        FROM trips
        WHERE "carrierId" = ${session.organizationId}
          AND "updatedAt" >= ${chartStart} AND "updatedAt" <= ${chartEnd}
          AND status IN ('DELIVERED', 'COMPLETED', 'CANCELLED')
        GROUP BY DATE_TRUNC('day', "updatedAt")
        ORDER BY date ASC
      `,

      // Service fees over time (for chart) — derived from journal entries
      // (single source of truth, matches /carrier/wallet aggregation)
      db.$queryRaw<{ date: Date; amount: number }[]>`
        SELECT DATE_TRUNC('day', je."createdAt") as date,
               COALESCE(SUM(jl."amount"), 0) as amount
        FROM journal_lines jl
        JOIN journal_entries je ON jl."journalEntryId" = je.id
        JOIN financial_accounts fa ON jl."accountId" = fa.id
        WHERE fa."organizationId" = ${session.organizationId}
          AND fa."accountType" = 'CARRIER_WALLET'
          AND jl."isDebit" = true
          AND je."transactionType" = 'SERVICE_FEE_DEDUCT'
          AND je."createdAt" >= ${chartStart}
          AND je."createdAt" <= ${chartEnd}
        GROUP BY DATE_TRUNC('day', je."createdAt")
        ORDER BY date ASC
      `,
    ]);

    // Calculate total distance from trips
    const totalDistance = Number(
      tripStats._sum?.actualDistanceKm ||
        tripStats._sum?.estimatedDistanceKm ||
        0
    );
    // Total service fees paid (single source of truth = journal entries)
    const totalServiceFeesPaid = parseFloat(
      Number(revenueResult._sum?.amount || 0).toFixed(2)
    );

    return NextResponse.json({
      totalTrucks,
      activeTrucks,
      activePostings,
      completedDeliveries: completedTrips,
      inTransitTrips,
      totalServiceFeesPaid,
      totalDistance,
      wallet: {
        balance: Number(walletAccount?.balance || 0),
        currency: walletAccount?.currency || "ETB",
      },
      recentPostings,
      pendingApprovals,
      charts: {
        tripsOverTime: tripsOverTimeRaw.map((item) => ({
          date: item.date,
          completed: Number(item.completed),
          cancelled: Number(item.cancelled),
        })),
        earningsOverTime: earningsOverTimeRaw.map((item) => ({
          date: item.date,
          amount: Number(item.amount),
        })),
      },
    });
  } catch (error) {
    return handleApiError(error, "Carrier dashboard error");
  }
}

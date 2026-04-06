export const dynamic = "force-dynamic";
/**
 * Admin Wallet Deposits List API
 *
 * Lists all WalletDeposit records across the platform for admin review.
 * Used by the admin deposits page to triage pending requests.
 *
 * GET /api/admin/wallet-deposits?status=PENDING&page=1&limit=20
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { handleApiError } from "@/lib/apiErrors";

export async function GET(request: NextRequest) {
  try {
    await requireActiveUser();
    await requirePermission(Permission.MANAGE_WALLET);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get("status");
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );

    const where: Record<string, unknown> = {};
    if (status && ["PENDING", "CONFIRMED", "REJECTED"].includes(status)) {
      where.status = status;
    }

    const [deposits, totalCount, pendingCount] = await Promise.all([
      db.walletDeposit.findMany({
        where,
        include: {
          financialAccount: {
            select: {
              accountType: true,
              organization: { select: { id: true, name: true } },
            },
          },
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          approvedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.walletDeposit.count({ where }),
      // Always return pendingCount for the dashboard badge, regardless of filter
      db.walletDeposit.count({ where: { status: "PENDING" } }),
    ]);

    return NextResponse.json({
      deposits,
      pagination: {
        page,
        limit,
        totalCount,
        totalPages: Math.ceil(totalCount / limit),
      },
      pendingCount,
    });
  } catch (error) {
    return handleApiError(error, "Admin list wallet deposits error");
  }
}

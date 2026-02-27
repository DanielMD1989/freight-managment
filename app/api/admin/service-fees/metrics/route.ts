/**
 * Admin Service Fee Metrics API
 *
 * GET /api/admin/service-fees/metrics
 *
 * Returns aggregated service fee metrics for the admin dashboard
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { roundMoney } from "@/lib/rounding";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check admin access
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get("range") || "30d";

    // Calculate date filter
    let dateFilter: Date | null = null;
    switch (range) {
      case "7d":
        dateFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30d":
        dateFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "90d":
        dateFilter = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        break;
      case "all":
      default:
        dateFilter = null;
    }

    // Build where clause
    const whereClause: Record<string, unknown> = {
      serviceFeeEtb: { not: null },
    };

    if (dateFilter) {
      whereClause.updatedAt = { gte: dateFilter };
    }

    // Fetch loads with service fees
    const loadsWithFees = await db.load.findMany({
      where: whereClause,
      select: {
        id: true,
        pickupCity: true,
        deliveryCity: true,
        serviceFeeEtb: true,
        serviceFeeStatus: true,
        serviceFeeReservedAt: true,
        serviceFeeDeductedAt: true,
        serviceFeeRefundedAt: true,
        corridorId: true,
        corridor: {
          select: {
            id: true,
            name: true,
          },
        },
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
    });

    // Calculate summary metrics
    let totalCollected = 0;
    let totalReserved = 0;
    let totalRefunded = 0;
    let totalWithFees = 0;

    const statusCounts: Record<string, { count: number; total: number }> = {};
    const corridorStats: Record<
      string,
      { name: string; count: number; total: number }
    > = {};

    for (const load of loadsWithFees) {
      const fee = Number(load.serviceFeeEtb || 0);
      if (fee <= 0) continue;

      totalWithFees++;

      // Status aggregation
      const status = load.serviceFeeStatus || "PENDING";
      if (!statusCounts[status]) {
        statusCounts[status] = { count: 0, total: 0 };
      }
      statusCounts[status].count++;
      statusCounts[status].total += fee;

      // Calculate totals by status
      if (status === "DEDUCTED") {
        totalCollected += fee;
      } else if (status === "RESERVED") {
        totalReserved += fee;
      } else if (status === "REFUNDED") {
        totalRefunded += fee;
      }

      // Corridor aggregation
      if (load.corridorId && load.corridor) {
        if (!corridorStats[load.corridorId]) {
          corridorStats[load.corridorId] = {
            name: load.corridor.name,
            count: 0,
            total: 0,
          };
        }
        corridorStats[load.corridorId].count++;
        corridorStats[load.corridorId].total += fee;
      }
    }

    // Format status breakdown (rounding delegated to lib/rounding.ts)
    const byStatus = Object.entries(statusCounts).map(([status, data]) => ({
      status,
      count: data.count,
      totalAmount: roundMoney(data.total),
    }));

    // Format corridor breakdown (rounding delegated to lib/rounding.ts)
    const byCorridor = Object.entries(corridorStats)
      .map(([corridorId, data]) => ({
        corridorId,
        corridorName: data.name,
        loadCount: data.count,
        totalFees: roundMoney(data.total),
        averageFee: data.count > 0 ? roundMoney(data.total / data.count) : 0,
      }))
      .sort((a, b) => b.totalFees - a.totalFees);

    // Recent transactions (top 10)
    const recentTransactions = loadsWithFees
      .filter((load) => load.serviceFeeEtb && Number(load.serviceFeeEtb) > 0)
      .slice(0, 10)
      .map((load) => ({
        loadId: load.id,
        pickupCity: load.pickupCity || "Unknown",
        deliveryCity: load.deliveryCity || "Unknown",
        serviceFee: Number(load.serviceFeeEtb),
        status: load.serviceFeeStatus || "PENDING",
        date:
          load.serviceFeeDeductedAt?.toISOString() ||
          load.serviceFeeRefundedAt?.toISOString() ||
          load.serviceFeeReservedAt?.toISOString() ||
          load.updatedAt.toISOString(),
      }));

    // Rounding delegated to lib/rounding.ts
    return NextResponse.json({
      summary: {
        totalFeesCollected: roundMoney(totalCollected),
        totalFeesReserved: roundMoney(totalReserved),
        totalFeesRefunded: roundMoney(totalRefunded),
        totalLoadsWithFees: totalWithFees,
        averageFeePerLoad:
          totalWithFees > 0
            ? roundMoney((totalCollected + totalReserved) / totalWithFees)
            : 0,
      },
      byStatus,
      byCorridor,
      recentTransactions,
    });
  } catch (error) {
    console.error("Service fee metrics error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

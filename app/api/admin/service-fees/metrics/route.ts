/**
 * Admin Service Fee Metrics API
 *
 * GET /api/admin/service-fees/metrics?period=day|week|month|year
 *
 * Returns aggregated service fee metrics for the admin dashboard.
 *
 * Fixed in Round A16:
 * G-A16-3: date filter now uses shipperFeeDeductedAt (was updatedAt)
 * G-A16-4: reads shipperServiceFee + carrierServiceFee (was legacy serviceFeeEtb)
 * G-A16-5: period param is day|week|month|year (was 7d|30d|90d|all)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requirePermission, Permission } from "@/lib/rbac";
import { roundMoney } from "@/lib/rounding";
import { handleApiError } from "@/lib/apiErrors";
import { getDateRangeForPeriod, type TimePeriod } from "@/lib/admin/metrics";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_SERVICE_FEE_REPORTS);

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as TimePeriod;
    const { start, end } = getDateRangeForPeriod(period);

    // Fetch loads that had a shipper or carrier fee deducted in the period.
    // Uses shipperFeeDeductedAt as the canonical date anchor (G-A16-3).
    const loadsWithFees = await db.load.findMany({
      where: {
        OR: [
          { shipperFeeStatus: { in: ["DEDUCTED", "RESERVED", "REFUNDED"] } },
          { carrierFeeStatus: { in: ["DEDUCTED", "RESERVED", "REFUNDED"] } },
        ],
        shipperFeeDeductedAt: { gte: start, lte: end },
      },
      select: {
        id: true,
        pickupCity: true,
        deliveryCity: true,
        shipperServiceFee: true,
        carrierServiceFee: true,
        shipperFeeStatus: true,
        carrierFeeStatus: true,
        shipperFeeDeductedAt: true,
        carrierFeeDeductedAt: true,
        serviceFeeReservedAt: true,
        serviceFeeRefundedAt: true,
        corridorId: true,
        corridor: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { shipperFeeDeductedAt: "desc" },
    });

    let totalShipperCollected = 0;
    let totalCarrierCollected = 0;
    let totalReserved = 0;
    let totalRefunded = 0;
    let totalWithFees = 0;

    const corridorStats: Record<
      string,
      { name: string; count: number; total: number }
    > = {};

    for (const load of loadsWithFees) {
      const shipperFee = Number(load.shipperServiceFee || 0);
      const carrierFee = Number(load.carrierServiceFee || 0);
      const combinedFee = shipperFee + carrierFee;

      if (combinedFee <= 0) continue;
      totalWithFees++;

      if (load.shipperFeeStatus === "DEDUCTED") {
        totalShipperCollected += shipperFee;
      } else if (load.shipperFeeStatus === "RESERVED") {
        totalReserved += shipperFee;
      } else if (load.shipperFeeStatus === "REFUNDED") {
        totalRefunded += shipperFee;
      }

      if (load.carrierFeeStatus === "DEDUCTED") {
        totalCarrierCollected += carrierFee;
      } else if (load.carrierFeeStatus === "RESERVED") {
        totalReserved += carrierFee;
      } else if (load.carrierFeeStatus === "REFUNDED") {
        totalRefunded += carrierFee;
      }

      if (load.corridorId && load.corridor) {
        if (!corridorStats[load.corridorId]) {
          corridorStats[load.corridorId] = {
            name: load.corridor.name,
            count: 0,
            total: 0,
          };
        }
        corridorStats[load.corridorId].count++;
        corridorStats[load.corridorId].total += combinedFee;
      }
    }

    const byCorridor = Object.entries(corridorStats)
      .map(([corridorId, data]) => ({
        corridorId,
        corridorName: data.name,
        loadCount: data.count,
        totalFees: roundMoney(data.total),
        averageFee: data.count > 0 ? roundMoney(data.total / data.count) : 0,
      }))
      .sort((a, b) => b.totalFees - a.totalFees);

    const totalCollected = totalShipperCollected + totalCarrierCollected;

    const recentTransactions = loadsWithFees
      .filter(
        (load) =>
          Number(load.shipperServiceFee || 0) +
            Number(load.carrierServiceFee || 0) >
          0
      )
      .slice(0, 10)
      .map((load) => ({
        loadId: load.id,
        pickupCity: load.pickupCity || "Unknown",
        deliveryCity: load.deliveryCity || "Unknown",
        shipperFee: Number(load.shipperServiceFee || 0),
        carrierFee: Number(load.carrierServiceFee || 0),
        totalFee:
          Number(load.shipperServiceFee || 0) +
          Number(load.carrierServiceFee || 0),
        shipperFeeStatus: load.shipperFeeStatus || "PENDING",
        carrierFeeStatus: load.carrierFeeStatus || "PENDING",
        date:
          load.shipperFeeDeductedAt?.toISOString() ||
          load.serviceFeeRefundedAt?.toISOString() ||
          load.serviceFeeReservedAt?.toISOString() ||
          new Date().toISOString(),
      }));

    return NextResponse.json({
      period,
      summary: {
        shipperFeeCollected: roundMoney(totalShipperCollected),
        carrierFeeCollected: roundMoney(totalCarrierCollected),
        totalFeesCollected: roundMoney(totalCollected),
        totalFeesReserved: roundMoney(totalReserved),
        totalFeesRefunded: roundMoney(totalRefunded),
        totalLoadsWithFees: totalWithFees,
        averageFeePerLoad:
          totalWithFees > 0
            ? roundMoney((totalCollected + totalReserved) / totalWithFees)
            : 0,
      },
      byCorridor,
      recentTransactions,
    });
  } catch (error) {
    return handleApiError(error, "Service fee metrics error");
  }
}

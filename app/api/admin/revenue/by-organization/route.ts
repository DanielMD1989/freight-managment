/**
 * Admin Revenue By Organization API
 *
 * GET /api/admin/revenue/by-organization?period=day|week|month|year
 *
 * Returns revenue collected broken down per Shipper and per Carrier,
 * filtered by time period. Fixes G-A16-1 and G-A16-2.
 *
 * Carrier FK is indirect: Load.assignedTruckId → Truck.carrierId → Organization
 * so groupBy is done in-memory after findMany.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, Permission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiErrors";
import { roundMoney } from "@/lib/rounding";
import { getDateRangeForPeriod, type TimePeriod } from "@/lib/admin/metrics";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_SERVICE_FEE_REPORTS);

    const { searchParams } = new URL(request.url);
    const period = (searchParams.get("period") || "month") as TimePeriod;
    const { start, end } = getDateRangeForPeriod(period);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(searchParams.get("limit") || "50"))
    );
    const skip = (page - 1) * limit;

    // ── Shipper breakdown (direct FK on Load) ─────────────────────────────
    const [shipperLoads, totalShipperCount] = await Promise.all([
      db.load.findMany({
        where: {
          shipperFeeStatus: "DEDUCTED",
          shipperFeeDeductedAt: { gte: start, lte: end },
        },
        select: {
          shipperId: true,
          shipperServiceFee: true,
          shipper: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
      }),
      db.load.count({
        where: {
          shipperFeeStatus: "DEDUCTED",
          shipperFeeDeductedAt: { gte: start, lte: end },
        },
      }),
    ]);

    const shipperMap = new Map<
      string,
      { name: string; shipperFeeCollected: number; loadCount: number }
    >();

    for (const load of shipperLoads) {
      if (!load.shipperId) continue;
      const fee = Number(load.shipperServiceFee || 0);
      const existing = shipperMap.get(load.shipperId);
      if (existing) {
        existing.shipperFeeCollected += fee;
        existing.loadCount += 1;
      } else {
        shipperMap.set(load.shipperId, {
          name: load.shipper?.name ?? "Unknown",
          shipperFeeCollected: fee,
          loadCount: 1,
        });
      }
    }

    const byShipper = Array.from(shipperMap.entries()).map(([orgId, data]) => ({
      organizationId: orgId,
      name: data.name,
      shipperFeeCollected: roundMoney(data.shipperFeeCollected),
      loadCount: data.loadCount,
    }));

    // ── Carrier breakdown (indirect: Load → Truck → Organization) ─────────
    const [carrierLoads, totalCarrierCount] = await Promise.all([
      db.load.findMany({
        where: {
          carrierFeeStatus: "DEDUCTED",
          carrierFeeDeductedAt: { gte: start, lte: end },
        },
        select: {
          carrierServiceFee: true,
          assignedTruck: {
            select: {
              carrierId: true,
              carrier: { select: { id: true, name: true } },
            },
          },
        },
        skip,
        take: limit,
      }),
      db.load.count({
        where: {
          carrierFeeStatus: "DEDUCTED",
          carrierFeeDeductedAt: { gte: start, lte: end },
        },
      }),
    ]);

    const carrierMap = new Map<
      string,
      { name: string; carrierFeeCollected: number; loadCount: number }
    >();

    for (const load of carrierLoads) {
      const truck = load.assignedTruck;
      if (!truck?.carrierId) continue;
      const fee = Number(load.carrierServiceFee || 0);
      const existing = carrierMap.get(truck.carrierId);
      if (existing) {
        existing.carrierFeeCollected += fee;
        existing.loadCount += 1;
      } else {
        carrierMap.set(truck.carrierId, {
          name: truck.carrier?.name ?? "Unknown",
          carrierFeeCollected: fee,
          loadCount: 1,
        });
      }
    }

    const byCarrier = Array.from(carrierMap.entries()).map(([orgId, data]) => ({
      organizationId: orgId,
      name: data.name,
      carrierFeeCollected: roundMoney(data.carrierFeeCollected),
      loadCount: data.loadCount,
    }));

    // ── Summary ───────────────────────────────────────────────────────────
    const totalShipperFees = byShipper.reduce(
      (sum, s) => sum + s.shipperFeeCollected,
      0
    );
    const totalCarrierFees = byCarrier.reduce(
      (sum, c) => sum + c.carrierFeeCollected,
      0
    );

    return NextResponse.json({
      period,
      dateRange: { start: start.toISOString(), end: end.toISOString() },
      byShipper,
      byCarrier,
      summary: {
        totalShipperFees: roundMoney(totalShipperFees),
        totalCarrierFees: roundMoney(totalCarrierFees),
        totalRevenue: roundMoney(totalShipperFees + totalCarrierFees),
      },
      pagination: {
        page,
        limit,
        total: Math.max(totalShipperCount, totalCarrierCount),
      },
    });
  } catch (error) {
    return handleApiError(error, "Revenue by organization error");
  }
}

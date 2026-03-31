export const dynamic = "force-dynamic";
/**
 * Admin Insurance Compliance Dashboard (P1)
 *
 * GET /api/admin/insurance/compliance
 *
 * Returns aggregate insurance compliance metrics for all trucks.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, Permission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiErrors";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_ALL_TRUCKS);

    const [totalTrucks, valid, expiring, expired, missing] = await Promise.all([
      db.truck.count(),
      db.truck.count({ where: { insuranceStatus: "VALID" } }),
      db.truck.count({ where: { insuranceStatus: "EXPIRING" } }),
      db.truck.count({ where: { insuranceStatus: "EXPIRED" } }),
      db.truck.count({ where: { insuranceStatus: "MISSING" } }),
    ]);

    const complianceRate =
      totalTrucks > 0
        ? Math.round(((valid + expiring) / totalTrucks) * 10000) / 100
        : 0;

    return NextResponse.json({
      totalTrucks,
      valid,
      expiring,
      expired,
      missing,
      complianceRate,
    });
  } catch (error) {
    return handleApiError(error, "Insurance compliance error");
  }
}

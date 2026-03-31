export const dynamic = "force-dynamic";
/**
 * Admin Expiring Insurance Documents (P1)
 *
 * GET /api/admin/insurance/expiring?days=30
 *
 * Returns trucks with insurance expiring within N days.
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, Permission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiErrors";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_ALL_TRUCKS);

    const { searchParams } = new URL(request.url);
    const days = Math.min(
      365,
      Math.max(1, parseInt(searchParams.get("days") || "30"))
    );

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const trucks = await db.truck.findMany({
      where: {
        insuranceExpiresAt: { not: null, lte: cutoff },
        insuranceStatus: { in: ["VALID", "EXPIRING", "EXPIRED"] },
      },
      select: {
        id: true,
        licensePlate: true,
        insuranceStatus: true,
        insuranceExpiresAt: true,
        carrierId: true,
        carrier: { select: { id: true, name: true } },
        documents: {
          where: {
            type: "INSURANCE",
            verificationStatus: "APPROVED",
            deletedAt: null,
          },
          select: {
            id: true,
            policyNumber: true,
            insuranceProvider: true,
            expiresAt: true,
          },
          orderBy: { expiresAt: "desc" },
          take: 1,
        },
      },
      orderBy: { insuranceExpiresAt: "asc" },
    });

    const now = new Date();
    const result = trucks.map((truck) => {
      const msRemaining = truck.insuranceExpiresAt
        ? truck.insuranceExpiresAt.getTime() - now.getTime()
        : 0;
      const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
      const doc = truck.documents[0] ?? null;

      return {
        id: truck.id,
        licensePlate: truck.licensePlate,
        insuranceStatus: truck.insuranceStatus,
        insuranceExpiresAt: truck.insuranceExpiresAt,
        daysRemaining: Math.max(0, daysRemaining),
        carrier: truck.carrier,
        insuranceDoc: doc
          ? {
              id: doc.id,
              policyNumber: doc.policyNumber,
              provider: doc.insuranceProvider,
            }
          : null,
      };
    });

    return NextResponse.json({
      trucks: result,
      total: result.length,
      filterDays: days,
    });
  } catch (error) {
    return handleApiError(error, "Expiring insurance query error");
  }
}

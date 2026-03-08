/**
 * Organization Rate Override API
 *
 * G-A15-2: Admin endpoint to write per-org rate/km overrides.
 *
 * Schema fields (Round S8):
 *   Organization.shipperRatePerKm, carrierRatePerKm
 *   Organization.shipperPromoFlag, shipperPromoPct
 *   Organization.carrierPromoFlag, carrierPromoPct
 *
 * These override the corridor rate in deductServiceFee() at fee collection time.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

const rateSchema = z.number().nonnegative().nullable();
const pctSchema = z.number().min(0).max(100).nullable();

const orgRatesSchema = z.object({
  shipperRatePerKm: rateSchema.optional(),
  carrierRatePerKm: rateSchema.optional(),
  shipperPromoFlag: z.boolean().optional(),
  shipperPromoPct: pctSchema.optional(),
  carrierPromoFlag: z.boolean().optional(),
  carrierPromoPct: pctSchema.optional(),
});

/**
 * PATCH /api/admin/organizations/[id]/rates
 *
 * Set per-org rate/km overrides. Admin-only.
 * Overrides take effect immediately for all new loads in that org.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: orgId } = await params;
    const session = await requireActiveUser();

    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const parseResult = orgRatesSchema.safeParse(body);
    if (!parseResult.success) {
      return zodErrorResponse(parseResult.error);
    }
    const data = parseResult.data;

    const organization = await db.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });
    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // Build update payload — only include fields that were sent
    const updateData: Record<string, unknown> = {};
    if (data.shipperRatePerKm !== undefined)
      updateData.shipperRatePerKm = data.shipperRatePerKm;
    if (data.carrierRatePerKm !== undefined)
      updateData.carrierRatePerKm = data.carrierRatePerKm;
    if (data.shipperPromoFlag !== undefined)
      updateData.shipperPromoFlag = data.shipperPromoFlag;
    if (data.shipperPromoPct !== undefined)
      updateData.shipperPromoPct = data.shipperPromoPct;
    if (data.carrierPromoFlag !== undefined)
      updateData.carrierPromoFlag = data.carrierPromoFlag;
    if (data.carrierPromoPct !== undefined)
      updateData.carrierPromoPct = data.carrierPromoPct;

    const updated = await db.organization.update({
      where: { id: orgId },
      data: updateData,
      select: {
        id: true,
        name: true,
        shipperRatePerKm: true,
        carrierRatePerKm: true,
        shipperPromoFlag: true,
        shipperPromoPct: true,
        carrierPromoFlag: true,
        carrierPromoPct: true,
      },
    });

    return NextResponse.json({
      message: "Organization rates updated",
      organization: {
        id: updated.id,
        name: updated.name,
        shipperRatePerKm: updated.shipperRatePerKm
          ? Number(updated.shipperRatePerKm)
          : null,
        carrierRatePerKm: updated.carrierRatePerKm
          ? Number(updated.carrierRatePerKm)
          : null,
        shipperPromoFlag: updated.shipperPromoFlag,
        shipperPromoPct: updated.shipperPromoPct
          ? Number(updated.shipperPromoPct)
          : null,
        carrierPromoFlag: updated.carrierPromoFlag,
        carrierPromoPct: updated.carrierPromoPct
          ? Number(updated.carrierPromoPct)
          : null,
      },
    });
  } catch (error) {
    return handleApiError(error, "Update org rates error");
  }
}

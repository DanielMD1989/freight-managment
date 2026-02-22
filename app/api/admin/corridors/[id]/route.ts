/**
 * Single Corridor Management API
 *
 * Service Fee Implementation - Task 1: Corridor Pricing Module
 *
 * Allows admins to view, update, or delete a specific corridor
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { Decimal } from "decimal.js";
import { CorridorDirection } from "@prisma/client";
import {
  calculateFeePreview,
  calculateDualPartyFeePreview,
} from "@/lib/serviceFeeCalculation";
import { handleApiError } from "@/lib/apiErrors";
// CSRF FIX: Add CSRF validation
import { validateCSRFWithMobile } from "@/lib/csrf";

// Ethiopian regions for validation
const ETHIOPIAN_REGIONS = [
  "Addis Ababa",
  "Afar",
  "Amhara",
  "Benishangul-Gumuz",
  "Dire Dawa",
  "Gambela",
  "Harari",
  "Oromia",
  "Sidama",
  "Somali",
  "Southern Nations, Nationalities, and Peoples",
  "Southwest Ethiopia",
  "Tigray",
  "Djibouti",
] as const;

const updateCorridorSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  originRegion: z
    .string()
    .refine(
      (val) =>
        ETHIOPIAN_REGIONS.includes(val as (typeof ETHIOPIAN_REGIONS)[number]),
      {
        message: "Invalid origin region",
      }
    )
    .optional(),
  destinationRegion: z
    .string()
    .refine(
      (val) =>
        ETHIOPIAN_REGIONS.includes(val as (typeof ETHIOPIAN_REGIONS)[number]),
      {
        message: "Invalid destination region",
      }
    )
    .optional(),
  distanceKm: z.number().positive().max(5000).optional(),
  // Legacy pricing (kept for backward compatibility)
  pricePerKm: z.number().positive().max(100).optional(),
  direction: z.nativeEnum(CorridorDirection).optional(),
  promoFlag: z.boolean().optional(),
  promoDiscountPct: z.number().min(0).max(100).nullable().optional(),
  isActive: z.boolean().optional(),
  // Dual-party pricing - shipper
  shipperPricePerKm: z.number().min(0).max(100).optional(),
  shipperPromoFlag: z.boolean().optional(),
  shipperPromoPct: z.number().min(0).max(100).nullable().optional(),
  // Dual-party pricing - carrier
  carrierPricePerKm: z.number().min(0).max(100).optional(),
  carrierPromoFlag: z.boolean().optional(),
  carrierPromoPct: z.number().min(0).max(100).nullable().optional(),
});

/**
 * GET /api/admin/corridors/[id]
 *
 * Get a specific corridor by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    // Only admins can view corridors
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const corridor = await db.corridor.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        loads: {
          select: {
            id: true,
            status: true,
            serviceFeeStatus: true,
            serviceFeeEtb: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
        _count: {
          select: {
            loads: true,
          },
        },
      },
    });

    if (!corridor) {
      return NextResponse.json(
        { error: "Corridor not found" },
        { status: 404 }
      );
    }

    // Calculate service fee stats
    const serviceFeeStats = await db.load.aggregate({
      where: {
        corridorId: id,
        serviceFeeStatus: "DEDUCTED",
      },
      _sum: {
        serviceFeeEtb: true,
      },
      _count: true,
    });

    return NextResponse.json({
      corridor: {
        id: corridor.id,
        name: corridor.name,
        originRegion: corridor.originRegion,
        destinationRegion: corridor.destinationRegion,
        distanceKm: Number(corridor.distanceKm),
        pricePerKm: Number(corridor.pricePerKm),
        direction: corridor.direction,
        promoFlag: corridor.promoFlag,
        promoDiscountPct: corridor.promoDiscountPct
          ? Number(corridor.promoDiscountPct)
          : null,
        isActive: corridor.isActive,
        // Dual-party pricing - shipper
        shipperPricePerKm: corridor.shipperPricePerKm
          ? Number(corridor.shipperPricePerKm)
          : null,
        shipperPromoFlag: corridor.shipperPromoFlag,
        shipperPromoPct: corridor.shipperPromoPct
          ? Number(corridor.shipperPromoPct)
          : null,
        // Dual-party pricing - carrier
        carrierPricePerKm: corridor.carrierPricePerKm
          ? Number(corridor.carrierPricePerKm)
          : null,
        carrierPromoFlag: corridor.carrierPromoFlag,
        carrierPromoPct: corridor.carrierPromoPct
          ? Number(corridor.carrierPromoPct)
          : null,
        createdAt: corridor.createdAt,
        updatedAt: corridor.updatedAt,
        createdBy: corridor.createdBy,
        loadsCount: corridor._count.loads,
        recentLoads: corridor.loads.map((load) => ({
          id: load.id,
          status: load.status,
          serviceFeeStatus: load.serviceFeeStatus,
          serviceFeeEtb: load.serviceFeeEtb ? Number(load.serviceFeeEtb) : null,
          createdAt: load.createdAt,
        })),
        stats: {
          totalLoads: corridor._count.loads,
          totalRevenue: serviceFeeStats._sum.serviceFeeEtb
            ? Number(serviceFeeStats._sum.serviceFeeEtb)
            : 0,
          completedCount: serviceFeeStats._count,
        },
        serviceFeePreview: calculateDualPartyFeePreview(
          Number(corridor.distanceKm),
          corridor.shipperPricePerKm
            ? Number(corridor.shipperPricePerKm)
            : Number(corridor.pricePerKm),
          corridor.shipperPromoFlag || corridor.promoFlag,
          corridor.shipperPromoPct
            ? Number(corridor.shipperPromoPct)
            : corridor.promoDiscountPct
              ? Number(corridor.promoDiscountPct)
              : null,
          corridor.carrierPricePerKm ? Number(corridor.carrierPricePerKm) : 0,
          corridor.carrierPromoFlag || false,
          corridor.carrierPromoPct ? Number(corridor.carrierPromoPct) : null
        ),
      },
    });
  } catch (error) {
    return handleApiError(error, "Get corridor error");
  }
}

/**
 * PATCH /api/admin/corridors/[id]
 *
 * Update a specific corridor
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF FIX: Validate CSRF token
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();

    // Only admins can update corridors
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await db.corridor.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Corridor not found" },
        { status: 404 }
      );
    }

    const body = await request.json();
    const validatedData = updateCorridorSchema.parse(body);

    // Check for duplicate if changing regions/direction
    if (
      validatedData.originRegion ||
      validatedData.destinationRegion ||
      validatedData.direction
    ) {
      const newOrigin = validatedData.originRegion || existing.originRegion;
      const newDest =
        validatedData.destinationRegion || existing.destinationRegion;
      const newDir = validatedData.direction || existing.direction;

      const duplicate = await db.corridor.findFirst({
        where: {
          originRegion: newOrigin,
          destinationRegion: newDest,
          direction: newDir,
          id: { not: id },
        },
      });

      if (duplicate) {
        return NextResponse.json(
          {
            error: "Corridor already exists",
            message: `A corridor from ${newOrigin} to ${newDest} (${newDir}) already exists`,
          },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};

    if (validatedData.name !== undefined) updateData.name = validatedData.name;
    if (validatedData.originRegion !== undefined)
      updateData.originRegion = validatedData.originRegion;
    if (validatedData.destinationRegion !== undefined)
      updateData.destinationRegion = validatedData.destinationRegion;
    if (validatedData.distanceKm !== undefined)
      updateData.distanceKm = new Decimal(validatedData.distanceKm);
    if (validatedData.pricePerKm !== undefined)
      updateData.pricePerKm = new Decimal(validatedData.pricePerKm);
    if (validatedData.direction !== undefined)
      updateData.direction = validatedData.direction;
    if (validatedData.promoFlag !== undefined)
      updateData.promoFlag = validatedData.promoFlag;
    if (validatedData.promoDiscountPct !== undefined) {
      updateData.promoDiscountPct =
        validatedData.promoDiscountPct !== null
          ? new Decimal(validatedData.promoDiscountPct)
          : null;
    }
    if (validatedData.isActive !== undefined)
      updateData.isActive = validatedData.isActive;

    // Dual-party pricing - shipper
    if (validatedData.shipperPricePerKm !== undefined) {
      updateData.shipperPricePerKm = new Decimal(
        validatedData.shipperPricePerKm
      );
    }
    if (validatedData.shipperPromoFlag !== undefined) {
      updateData.shipperPromoFlag = validatedData.shipperPromoFlag;
    }
    if (validatedData.shipperPromoPct !== undefined) {
      updateData.shipperPromoPct =
        validatedData.shipperPromoPct !== null
          ? new Decimal(validatedData.shipperPromoPct)
          : null;
    }

    // Dual-party pricing - carrier
    if (validatedData.carrierPricePerKm !== undefined) {
      updateData.carrierPricePerKm = new Decimal(
        validatedData.carrierPricePerKm
      );
    }
    if (validatedData.carrierPromoFlag !== undefined) {
      updateData.carrierPromoFlag = validatedData.carrierPromoFlag;
    }
    if (validatedData.carrierPromoPct !== undefined) {
      updateData.carrierPromoPct =
        validatedData.carrierPromoPct !== null
          ? new Decimal(validatedData.carrierPromoPct)
          : null;
    }

    const corridor = await db.corridor.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      message: "Corridor updated successfully",
      corridor: {
        id: corridor.id,
        name: corridor.name,
        originRegion: corridor.originRegion,
        destinationRegion: corridor.destinationRegion,
        distanceKm: Number(corridor.distanceKm),
        pricePerKm: Number(corridor.pricePerKm),
        direction: corridor.direction,
        promoFlag: corridor.promoFlag,
        promoDiscountPct: corridor.promoDiscountPct
          ? Number(corridor.promoDiscountPct)
          : null,
        isActive: corridor.isActive,
        // Dual-party pricing - shipper
        shipperPricePerKm: corridor.shipperPricePerKm
          ? Number(corridor.shipperPricePerKm)
          : null,
        shipperPromoFlag: corridor.shipperPromoFlag,
        shipperPromoPct: corridor.shipperPromoPct
          ? Number(corridor.shipperPromoPct)
          : null,
        // Dual-party pricing - carrier
        carrierPricePerKm: corridor.carrierPricePerKm
          ? Number(corridor.carrierPricePerKm)
          : null,
        carrierPromoFlag: corridor.carrierPromoFlag,
        carrierPromoPct: corridor.carrierPromoPct
          ? Number(corridor.carrierPromoPct)
          : null,
        // Fee previews for both parties
        serviceFeePreview: calculateDualPartyFeePreview(
          Number(corridor.distanceKm),
          corridor.shipperPricePerKm
            ? Number(corridor.shipperPricePerKm)
            : Number(corridor.pricePerKm),
          corridor.shipperPromoFlag || corridor.promoFlag,
          corridor.shipperPromoPct
            ? Number(corridor.shipperPromoPct)
            : corridor.promoDiscountPct
              ? Number(corridor.promoDiscountPct)
              : null,
          corridor.carrierPricePerKm ? Number(corridor.carrierPricePerKm) : 0,
          corridor.carrierPromoFlag || false,
          corridor.carrierPromoPct ? Number(corridor.carrierPromoPct) : null
        ),
      },
    });
  } catch (error) {
    return handleApiError(error, "Update corridor error");
  }
}

/**
 * DELETE /api/admin/corridors/[id]
 *
 * Delete a corridor (only if no loads are using it)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF FIX: Validate CSRF token
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();

    // Only super admins can delete corridors
    if (session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Super Admin access required" },
        { status: 403 }
      );
    }

    const { id } = await params;

    const existing = await db.corridor.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            loads: true,
          },
        },
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Corridor not found" },
        { status: 404 }
      );
    }

    // Prevent deletion if corridor has loads
    if (existing._count.loads > 0) {
      return NextResponse.json(
        {
          error: "Cannot delete corridor",
          message: `This corridor has ${existing._count.loads} associated loads. Deactivate it instead.`,
        },
        { status: 400 }
      );
    }

    await db.corridor.delete({
      where: { id },
    });

    return NextResponse.json({
      message: "Corridor deleted successfully",
    });
  } catch (error) {
    return handleApiError(error, "Delete corridor error");
  }
}

// Fee preview functions imported from lib/serviceFeeCalculation.ts
// See import at top of file

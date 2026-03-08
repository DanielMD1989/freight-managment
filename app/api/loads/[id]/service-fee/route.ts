/**
 * Load Service Fee API
 *
 * Service Fee Implementation - Task 6
 *
 * Get service fee status for a specific load
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { calculateDualPartyFeePreview } from "@/lib/serviceFeeCalculation";
import { handleApiError } from "@/lib/apiErrors";

/**
 * GET /api/loads/[id]/service-fee
 *
 * Get service fee status for a load
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireActiveUser();
    const { id } = await params;

    const load = await db.load.findUnique({
      where: { id },
      select: {
        id: true,
        shipperId: true,
        // Legacy fields (kept for backward compatibility)
        serviceFeeEtb: true,
        serviceFeeStatus: true,
        serviceFeeReservedAt: true,
        serviceFeeDeductedAt: true,
        serviceFeeRefundedAt: true,
        // Authoritative dual-party fields (LEGACY FIELD POLICY)
        shipperServiceFee: true,
        shipperFeeStatus: true,
        shipperFeeDeductedAt: true,
        carrierServiceFee: true,
        carrierFeeStatus: true,
        carrierFeeDeductedAt: true,
        // S9: Rate/KM audit snapshot
        shipperRatePerKmUsed: true,
        carrierRatePerKmUsed: true,
        totalKmUsed: true,
        corridorId: true,
        corridor: {
          select: {
            id: true,
            name: true,
            originRegion: true,
            destinationRegion: true,
            distanceKm: true,
            pricePerKm: true,
            promoFlag: true,
            promoDiscountPct: true,
            // G-A15-3: dual-party fields for authoritative preview
            shipperPricePerKm: true,
            carrierPricePerKm: true,
            shipperPromoFlag: true,
            shipperPromoPct: true,
            carrierPromoFlag: true,
            carrierPromoPct: true,
          },
        },
        shipper: {
          select: {
            id: true,
            shipperRatePerKm: true,
            shipperPromoFlag: true,
            shipperPromoPct: true,
          },
        },
        assignedTruck: {
          select: {
            carrierId: true,
            carrier: {
              select: {
                id: true,
                carrierRatePerKm: true,
                carrierPromoFlag: true,
                carrierPromoPct: true,
              },
            },
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check access - must be shipper, carrier, or admin — role guard prevents DISPATCHER bypass
    const hasAccess =
      session.role === "ADMIN" ||
      session.role === "SUPER_ADMIN" ||
      (session.role === "SHIPPER" &&
        session.organizationId === load.shipperId) ||
      (session.role === "CARRIER" &&
        session.organizationId ===
          (load.assignedTruck?.carrierId ?? load.assignedTruck?.carrier?.id));

    if (!hasAccess) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // G-A15-3: Calculate dual-party fee preview using authoritative corridor fields
    // and org-first rate override chain (org.ratePerKm > corridor.partyPricePerKm > corridor.pricePerKm)
    let feeBreakdown = null;
    if (load.corridor) {
      const distanceKm = Number(load.corridor.distanceKm);

      // Shipper rate: org override → corridor.shipperPricePerKm → corridor.pricePerKm
      const shipperPricePerKm = load.shipper?.shipperRatePerKm
        ? Number(load.shipper.shipperRatePerKm)
        : load.corridor.shipperPricePerKm
          ? Number(load.corridor.shipperPricePerKm)
          : Number(load.corridor.pricePerKm);
      const shipperPromoFlag =
        load.shipper?.shipperPromoFlag ||
        load.corridor.shipperPromoFlag ||
        load.corridor.promoFlag ||
        false;
      const shipperPromoPct = load.shipper?.shipperPromoPct
        ? Number(load.shipper.shipperPromoPct)
        : load.corridor.shipperPromoPct
          ? Number(load.corridor.shipperPromoPct)
          : load.corridor.promoDiscountPct
            ? Number(load.corridor.promoDiscountPct)
            : null;

      // Carrier rate: org override → corridor.carrierPricePerKm → 0
      const carrierPricePerKm = load.assignedTruck?.carrier?.carrierRatePerKm
        ? Number(load.assignedTruck.carrier.carrierRatePerKm)
        : load.corridor.carrierPricePerKm
          ? Number(load.corridor.carrierPricePerKm)
          : 0;
      const carrierPromoFlag =
        load.assignedTruck?.carrier?.carrierPromoFlag ||
        load.corridor.carrierPromoFlag ||
        false;
      const carrierPromoPct = load.assignedTruck?.carrier?.carrierPromoPct
        ? Number(load.assignedTruck.carrier.carrierPromoPct)
        : load.corridor.carrierPromoPct
          ? Number(load.corridor.carrierPromoPct)
          : null;

      const preview = calculateDualPartyFeePreview(
        distanceKm,
        shipperPricePerKm,
        shipperPromoFlag,
        shipperPromoPct,
        carrierPricePerKm,
        carrierPromoFlag,
        carrierPromoPct
      );

      feeBreakdown = {
        distanceKm,
        shipperFee: preview.shipper,
        carrierFee: preview.carrier,
        totalFee: preview.totalPlatformFee,
        shipperPromoApplied: shipperPromoFlag && !!shipperPromoPct,
        carrierPromoApplied: carrierPromoFlag && !!carrierPromoPct,
      };
    }

    return NextResponse.json({
      loadId: load.id,
      serviceFee: {
        // Legacy fields (backward compatibility)
        amount: load.serviceFeeEtb ? Number(load.serviceFeeEtb) : null,
        status: load.serviceFeeStatus,
        reservedAt: load.serviceFeeReservedAt,
        deductedAt: load.serviceFeeDeductedAt,
        refundedAt: load.serviceFeeRefundedAt,
        // Authoritative dual-party breakdown (LEGACY FIELD POLICY)
        shipper: {
          fee: load.shipperServiceFee ? Number(load.shipperServiceFee) : null,
          status: load.shipperFeeStatus,
          deductedAt: load.shipperFeeDeductedAt,
          ratePerKmUsed:
            load.shipperRatePerKmUsed != null
              ? Number(load.shipperRatePerKmUsed)
              : null,
        },
        carrier: {
          fee: load.carrierServiceFee ? Number(load.carrierServiceFee) : null,
          status: load.carrierFeeStatus,
          deductedAt: load.carrierFeeDeductedAt,
          ratePerKmUsed:
            load.carrierRatePerKmUsed != null
              ? Number(load.carrierRatePerKmUsed)
              : null,
        },
        totalKmUsed: load.totalKmUsed != null ? Number(load.totalKmUsed) : null,
      },
      corridor: load.corridor
        ? {
            id: load.corridor.id,
            name: load.corridor.name,
            originRegion: load.corridor.originRegion,
            destinationRegion: load.corridor.destinationRegion,
            distanceKm: Number(load.corridor.distanceKm),
            pricePerKm: Number(load.corridor.pricePerKm),
            promoFlag: load.corridor.promoFlag,
            promoDiscountPct: load.corridor.promoDiscountPct
              ? Number(load.corridor.promoDiscountPct)
              : null,
          }
        : null,
      feeBreakdown,
    });
  } catch (error) {
    return handleApiError(error, "Service fee error");
  }
}

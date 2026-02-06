/**
 * Load Service Fee API
 *
 * Service Fee Implementation - Task 6
 *
 * Get service fee status for a specific load
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calculateFeePreview } from '@/lib/serviceFeeCalculation';

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
    const session = await requireAuth();
    const { id } = await params;

    const load = await db.load.findUnique({
      where: { id },
      select: {
        id: true,
        shipperId: true,
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
            originRegion: true,
            destinationRegion: true,
            distanceKm: true,
            pricePerKm: true,
            promoFlag: true,
            promoDiscountPct: true,
          },
        },
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Check access - must be shipper, carrier, or admin
    const hasAccess =
      session.role === 'ADMIN' ||
      session.role === 'SUPER_ADMIN' ||
      session.organizationId === load.shipperId ||
      session.organizationId === load.assignedTruck?.carrierId;

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Calculate fee breakdown if corridor exists (using centralized function)
    let feeBreakdown = null;
    if (load.corridor) {
      const preview = calculateFeePreview(
        Number(load.corridor.distanceKm),
        Number(load.corridor.pricePerKm),
        load.corridor.promoFlag,
        load.corridor.promoDiscountPct ? Number(load.corridor.promoDiscountPct) : null
      );

      feeBreakdown = {
        ...preview,
        promoApplied: load.corridor.promoFlag && !!load.corridor.promoDiscountPct,
      };
    }

    return NextResponse.json({
      loadId: load.id,
      serviceFee: {
        amount: load.serviceFeeEtb ? Number(load.serviceFeeEtb) : null,
        status: load.serviceFeeStatus,
        reservedAt: load.serviceFeeReservedAt,
        deductedAt: load.serviceFeeDeductedAt,
        refundedAt: load.serviceFeeRefundedAt,
      },
      corridor: load.corridor ? {
        id: load.corridor.id,
        name: load.corridor.name,
        originRegion: load.corridor.originRegion,
        destinationRegion: load.corridor.destinationRegion,
        distanceKm: Number(load.corridor.distanceKm),
        pricePerKm: Number(load.corridor.pricePerKm),
        promoFlag: load.corridor.promoFlag,
        promoDiscountPct: load.corridor.promoDiscountPct ? Number(load.corridor.promoDiscountPct) : null,
      } : null,
      feeBreakdown,
    });
  } catch (error) {
    console.error('Get service fee error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

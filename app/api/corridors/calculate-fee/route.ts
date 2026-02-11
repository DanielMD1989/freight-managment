/**
 * Service Fee Calculation API
 *
 * Service Fee Implementation - Task 6
 *
 * Calculate service fee for a load based on corridor pricing
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { calculateServiceFee } from '@/lib/serviceFeeCalculation';
import { z } from 'zod';
import { zodErrorResponse } from '@/lib/validation';

const calculateFeeSchema = z.object({
  loadId: z.string().cuid(),
});

/**
 * POST /api/corridors/calculate-fee
 *
 * Calculate service fee for a specific load
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const validatedData = calculateFeeSchema.parse(body);

    const feeCalc = await calculateServiceFee(validatedData.loadId);

    if (!feeCalc) {
      return NextResponse.json({
        calculated: false,
        message: 'Could not calculate service fee - no matching corridor or missing route info',
        serviceFee: null,
      });
    }

    return NextResponse.json({
      calculated: true,
      corridor: {
        id: feeCalc.corridorId,
        name: feeCalc.corridorName,
        originRegion: feeCalc.originRegion,
        destinationRegion: feeCalc.destinationRegion,
        distanceKm: feeCalc.distanceKm,
        pricePerKm: feeCalc.pricePerKm,
        direction: feeCalc.direction,
      },
      serviceFee: {
        baseFee: feeCalc.baseFee,
        promoDiscount: feeCalc.promoDiscount,
        finalFee: feeCalc.finalFee,
        promoApplied: feeCalc.promoApplied,
        promoDiscountPct: feeCalc.promoDiscountPct,
      },
    });
  } catch (error) {
    console.error('Calculate fee error:', error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

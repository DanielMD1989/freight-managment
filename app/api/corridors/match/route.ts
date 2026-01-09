/**
 * Corridor Match API
 *
 * Service Fee Implementation - Task 6
 *
 * Find matching corridor for a given route
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { findMatchingCorridor, calculateFeeFromCorridor } from '@/lib/serviceFeeCalculation';
import { z } from 'zod';

const matchCorridorSchema = z.object({
  originRegion: z.string().min(1),
  destinationRegion: z.string().min(1),
});

/**
 * POST /api/corridors/match
 *
 * Find a corridor matching the given origin and destination regions
 */
export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const validatedData = matchCorridorSchema.parse(body);

    const match = await findMatchingCorridor(
      validatedData.originRegion,
      validatedData.destinationRegion
    );

    if (!match) {
      return NextResponse.json({
        found: false,
        message: 'No corridor found for this route',
        corridor: null,
        serviceFee: null,
      });
    }

    // Calculate service fee
    const feeCalc = calculateFeeFromCorridor(
      match.corridor.distanceKm,
      match.corridor.pricePerKm,
      match.corridor.promoFlag,
      match.corridor.promoDiscountPct
    );

    return NextResponse.json({
      found: true,
      matchType: match.matchType,
      corridor: {
        id: match.corridor.id,
        name: match.corridor.name,
        originRegion: match.corridor.originRegion,
        destinationRegion: match.corridor.destinationRegion,
        distanceKm: match.corridor.distanceKm,
        pricePerKm: match.corridor.pricePerKm,
        direction: match.corridor.direction,
        promoFlag: match.corridor.promoFlag,
        promoDiscountPct: match.corridor.promoDiscountPct,
      },
      serviceFee: {
        baseFee: feeCalc.baseFee,
        promoDiscount: feeCalc.promoDiscount,
        finalFee: feeCalc.finalFee,
        promoApplied: feeCalc.promoApplied,
      },
    });
  } catch (error) {
    console.error('Corridor match error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

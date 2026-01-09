/**
 * Service Fee Calculation Module
 *
 * Service Fee Implementation - Task 2
 *
 * Calculates service fees based on corridor pricing
 */

import { db } from '@/lib/db';
import { CorridorDirection } from '@prisma/client';
import { Decimal } from 'decimal.js';

export interface ServiceFeeCalculation {
  corridorId: string;
  corridorName: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: number;
  pricePerKm: number;
  direction: CorridorDirection;
  baseFee: number;
  promoDiscount: number;
  finalFee: number;
  promoApplied: boolean;
  promoDiscountPct: number | null;
}

export interface CorridorMatch {
  corridor: {
    id: string;
    name: string;
    originRegion: string;
    destinationRegion: string;
    distanceKm: number;
    pricePerKm: number;
    direction: CorridorDirection;
    promoFlag: boolean;
    promoDiscountPct: number | null;
    isActive: boolean;
  };
  matchType: 'exact' | 'bidirectional' | 'none';
}

/**
 * Find a matching corridor for a given route
 */
export async function findMatchingCorridor(
  originRegion: string,
  destinationRegion: string
): Promise<CorridorMatch | null> {
  // Try exact match first (ONE_WAY or ROUND_TRIP)
  const exactMatch = await db.corridor.findFirst({
    where: {
      originRegion,
      destinationRegion,
      isActive: true,
      direction: { in: ['ONE_WAY', 'ROUND_TRIP'] },
    },
  });

  if (exactMatch) {
    return {
      corridor: {
        id: exactMatch.id,
        name: exactMatch.name,
        originRegion: exactMatch.originRegion,
        destinationRegion: exactMatch.destinationRegion,
        distanceKm: Number(exactMatch.distanceKm),
        pricePerKm: Number(exactMatch.pricePerKm),
        direction: exactMatch.direction,
        promoFlag: exactMatch.promoFlag,
        promoDiscountPct: exactMatch.promoDiscountPct ? Number(exactMatch.promoDiscountPct) : null,
        isActive: exactMatch.isActive,
      },
      matchType: 'exact',
    };
  }

  // Try bidirectional match (reverse direction)
  const bidirectionalMatch = await db.corridor.findFirst({
    where: {
      OR: [
        {
          originRegion,
          destinationRegion,
          direction: 'BIDIRECTIONAL',
        },
        {
          originRegion: destinationRegion,
          destinationRegion: originRegion,
          direction: 'BIDIRECTIONAL',
        },
      ],
      isActive: true,
    },
  });

  if (bidirectionalMatch) {
    return {
      corridor: {
        id: bidirectionalMatch.id,
        name: bidirectionalMatch.name,
        originRegion: bidirectionalMatch.originRegion,
        destinationRegion: bidirectionalMatch.destinationRegion,
        distanceKm: Number(bidirectionalMatch.distanceKm),
        pricePerKm: Number(bidirectionalMatch.pricePerKm),
        direction: bidirectionalMatch.direction,
        promoFlag: bidirectionalMatch.promoFlag,
        promoDiscountPct: bidirectionalMatch.promoDiscountPct ? Number(bidirectionalMatch.promoDiscountPct) : null,
        isActive: bidirectionalMatch.isActive,
      },
      matchType: 'bidirectional',
    };
  }

  return null;
}

/**
 * Calculate service fee for a given corridor
 */
export function calculateFeeFromCorridor(
  distanceKm: number,
  pricePerKm: number,
  promoFlag: boolean,
  promoDiscountPct: number | null
): {
  baseFee: number;
  promoDiscount: number;
  finalFee: number;
  promoApplied: boolean;
} {
  const baseFee = new Decimal(distanceKm).mul(new Decimal(pricePerKm));
  let promoDiscount = new Decimal(0);
  let promoApplied = false;

  if (promoFlag && promoDiscountPct && promoDiscountPct > 0) {
    promoDiscount = baseFee.mul(new Decimal(promoDiscountPct)).div(100);
    promoApplied = true;
  }

  const finalFee = baseFee.sub(promoDiscount);

  return {
    baseFee: baseFee.toDecimalPlaces(2).toNumber(),
    promoDiscount: promoDiscount.toDecimalPlaces(2).toNumber(),
    finalFee: finalFee.toDecimalPlaces(2).toNumber(),
    promoApplied,
  };
}

/**
 * Calculate service fee for a load based on its route
 */
export async function calculateServiceFee(
  loadId: string
): Promise<ServiceFeeCalculation | null> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    include: {
      pickupLocation: true,
      deliveryLocation: true,
      corridor: true,
    },
  });

  if (!load) {
    throw new Error(`Load ${loadId} not found`);
  }

  // If load already has a corridor assigned, use it
  if (load.corridor) {
    const feeCalc = calculateFeeFromCorridor(
      Number(load.corridor.distanceKm),
      Number(load.corridor.pricePerKm),
      load.corridor.promoFlag,
      load.corridor.promoDiscountPct ? Number(load.corridor.promoDiscountPct) : null
    );

    return {
      corridorId: load.corridor.id,
      corridorName: load.corridor.name,
      originRegion: load.corridor.originRegion,
      destinationRegion: load.corridor.destinationRegion,
      distanceKm: Number(load.corridor.distanceKm),
      pricePerKm: Number(load.corridor.pricePerKm),
      direction: load.corridor.direction,
      ...feeCalc,
      promoDiscountPct: load.corridor.promoDiscountPct ? Number(load.corridor.promoDiscountPct) : null,
    };
  }

  // Determine regions from load locations
  const originRegion = load.pickupLocation?.region || load.pickupCity;
  const destinationRegion = load.deliveryLocation?.region || load.deliveryCity;

  if (!originRegion || !destinationRegion) {
    return null;
  }

  // Find matching corridor
  const match = await findMatchingCorridor(originRegion, destinationRegion);

  if (!match) {
    return null;
  }

  const feeCalc = calculateFeeFromCorridor(
    match.corridor.distanceKm,
    match.corridor.pricePerKm,
    match.corridor.promoFlag,
    match.corridor.promoDiscountPct
  );

  return {
    corridorId: match.corridor.id,
    corridorName: match.corridor.name,
    originRegion: match.corridor.originRegion,
    destinationRegion: match.corridor.destinationRegion,
    distanceKm: match.corridor.distanceKm,
    pricePerKm: match.corridor.pricePerKm,
    direction: match.corridor.direction,
    ...feeCalc,
    promoDiscountPct: match.corridor.promoDiscountPct,
  };
}

/**
 * Get all active corridors with calculated fees
 */
export async function getAllCorridorsWithFees(): Promise<Array<{
  corridor: {
    id: string;
    name: string;
    originRegion: string;
    destinationRegion: string;
    distanceKm: number;
    pricePerKm: number;
    direction: CorridorDirection;
    promoFlag: boolean;
    promoDiscountPct: number | null;
  };
  fee: {
    baseFee: number;
    promoDiscount: number;
    finalFee: number;
    promoApplied: boolean;
  };
}>> {
  const corridors = await db.corridor.findMany({
    where: { isActive: true },
    orderBy: [
      { originRegion: 'asc' },
      { destinationRegion: 'asc' },
    ],
  });

  return corridors.map((corridor) => ({
    corridor: {
      id: corridor.id,
      name: corridor.name,
      originRegion: corridor.originRegion,
      destinationRegion: corridor.destinationRegion,
      distanceKm: Number(corridor.distanceKm),
      pricePerKm: Number(corridor.pricePerKm),
      direction: corridor.direction,
      promoFlag: corridor.promoFlag,
      promoDiscountPct: corridor.promoDiscountPct ? Number(corridor.promoDiscountPct) : null,
    },
    fee: calculateFeeFromCorridor(
      Number(corridor.distanceKm),
      Number(corridor.pricePerKm),
      corridor.promoFlag,
      corridor.promoDiscountPct ? Number(corridor.promoDiscountPct) : null
    ),
  }));
}

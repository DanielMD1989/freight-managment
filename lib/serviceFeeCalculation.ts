/**
 * Service Fee Calculation Module
 *
 * Calculates service fees based on corridor pricing
 * Supports separate rates for shipper and carrier
 */

import { db } from '@/lib/db';
import { CorridorDirection } from '@prisma/client';
import { Decimal } from 'decimal.js';
import { roundMoney } from './rounding';

export interface PartyFeeCalculation {
  baseFee: number;
  promoDiscount: number;
  finalFee: number;
  promoApplied: boolean;
  promoDiscountPct: number | null;
  pricePerKm: number;
}

export interface ServiceFeeCalculation {
  corridorId: string;
  corridorName: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: number;
  direction: CorridorDirection;

  // Shipper fee details
  shipper: PartyFeeCalculation;

  // Carrier fee details
  carrier: PartyFeeCalculation;

  // Total platform revenue
  totalPlatformFee: number;

  // Legacy fields for backward compatibility
  pricePerKm: number;
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
    direction: CorridorDirection;
    isActive: boolean;

    // Shipper pricing
    shipperPricePerKm: number;
    shipperPromoFlag: boolean;
    shipperPromoPct: number | null;

    // Carrier pricing
    carrierPricePerKm: number;
    carrierPromoFlag: boolean;
    carrierPromoPct: number | null;

    // Legacy fields
    pricePerKm: number;
    promoFlag: boolean;
    promoDiscountPct: number | null;
  };
  matchType: 'exact' | 'bidirectional' | 'none';
}

/** Corridor data from Prisma query with Decimal fields */
interface RawCorridor {
  id: string;
  name: string;
  originRegion: string;
  destinationRegion: string;
  distanceKm: { toNumber(): number } | number;
  direction: CorridorDirection;
  isActive: boolean;
  pricePerKm: { toNumber(): number } | number;
  promoFlag: boolean;
  promoDiscountPct: { toNumber(): number } | number | null;
  shipperPricePerKm?: { toNumber(): number } | number | null;
  shipperPromoFlag?: boolean;
  shipperPromoPct?: { toNumber(): number } | number | null;
  carrierPricePerKm?: { toNumber(): number } | number | null;
  carrierPromoFlag?: boolean;
  carrierPromoPct?: { toNumber(): number } | number | null;
}

/**
 * Helper to map corridor from DB to CorridorMatch format
 */
function mapCorridorToMatch(corridor: RawCorridor, matchType: 'exact' | 'bidirectional'): CorridorMatch {
  // Get shipper price (use new field or fall back to legacy)
  const shipperPricePerKm = corridor.shipperPricePerKm
    ? Number(corridor.shipperPricePerKm)
    : Number(corridor.pricePerKm);

  // Get carrier price (default to 0 if not set)
  const carrierPricePerKm = corridor.carrierPricePerKm
    ? Number(corridor.carrierPricePerKm)
    : 0;

  return {
    corridor: {
      id: corridor.id,
      name: corridor.name,
      originRegion: corridor.originRegion,
      destinationRegion: corridor.destinationRegion,
      distanceKm: Number(corridor.distanceKm),
      direction: corridor.direction,
      isActive: corridor.isActive,

      // Shipper pricing
      shipperPricePerKm,
      shipperPromoFlag: corridor.shipperPromoFlag || corridor.promoFlag || false,
      shipperPromoPct: corridor.shipperPromoPct
        ? Number(corridor.shipperPromoPct)
        : corridor.promoDiscountPct
          ? Number(corridor.promoDiscountPct)
          : null,

      // Carrier pricing
      carrierPricePerKm,
      carrierPromoFlag: corridor.carrierPromoFlag || false,
      carrierPromoPct: corridor.carrierPromoPct ? Number(corridor.carrierPromoPct) : null,

      // Legacy fields
      pricePerKm: Number(corridor.pricePerKm),
      promoFlag: corridor.promoFlag,
      promoDiscountPct: corridor.promoDiscountPct ? Number(corridor.promoDiscountPct) : null,
    },
    matchType,
  };
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
    return mapCorridorToMatch(exactMatch, 'exact');
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
    return mapCorridorToMatch(bidirectionalMatch, 'bidirectional');
  }

  return null;
}

/**
 * Calculate fee for a single party (shipper or carrier)
 */
export function calculatePartyFee(
  distanceKm: number,
  pricePerKm: number,
  promoFlag: boolean,
  promoDiscountPct: number | null
): PartyFeeCalculation {
  if (pricePerKm <= 0) {
    return {
      baseFee: 0,
      promoDiscount: 0,
      finalFee: 0,
      promoApplied: false,
      promoDiscountPct: null,
      pricePerKm: 0,
    };
  }

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
    promoDiscountPct,
    pricePerKm,
  };
}

/**
 * Calculate service fees for both shipper and carrier from corridor
 */
export function calculateFeesFromCorridor(corridor: CorridorMatch['corridor']): {
  shipper: PartyFeeCalculation;
  carrier: PartyFeeCalculation;
  totalPlatformFee: number;
} {
  const shipper = calculatePartyFee(
    corridor.distanceKm,
    corridor.shipperPricePerKm,
    corridor.shipperPromoFlag,
    corridor.shipperPromoPct
  );

  const carrier = calculatePartyFee(
    corridor.distanceKm,
    corridor.carrierPricePerKm,
    corridor.carrierPromoFlag,
    corridor.carrierPromoPct
  );

  return {
    shipper,
    carrier,
    totalPlatformFee: shipper.finalFee + carrier.finalFee,
  };
}

/**
 * Legacy: Calculate service fee for a given corridor (shipper only)
 * @deprecated Use calculateFeesFromCorridor for both parties
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
  const result = calculatePartyFee(distanceKm, pricePerKm, promoFlag, promoDiscountPct);
  return {
    baseFee: result.baseFee,
    promoDiscount: result.promoDiscount,
    finalFee: result.finalFee,
    promoApplied: result.promoApplied,
  };
}

/**
 * Calculate service fees for a load based on its route
 * Returns fees for both shipper and carrier
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
    const corridorData = mapCorridorToMatch(load.corridor, 'exact').corridor;
    const fees = calculateFeesFromCorridor(corridorData);

    // Legacy fee calculation for backward compatibility
    const legacyFee = calculateFeeFromCorridor(
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
      direction: load.corridor.direction,

      // New: separate fees
      shipper: fees.shipper,
      carrier: fees.carrier,
      totalPlatformFee: fees.totalPlatformFee,

      // Legacy fields
      pricePerKm: Number(load.corridor.pricePerKm),
      ...legacyFee,
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

  const fees = calculateFeesFromCorridor(match.corridor);

  // Legacy fee calculation
  const legacyFee = calculateFeeFromCorridor(
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
    direction: match.corridor.direction,

    // New: separate fees
    shipper: fees.shipper,
    carrier: fees.carrier,
    totalPlatformFee: fees.totalPlatformFee,

    // Legacy fields
    pricePerKm: match.corridor.pricePerKm,
    ...legacyFee,
    promoDiscountPct: match.corridor.promoDiscountPct,
  };
}

/**
 * Get all active corridors with calculated fees for both parties
 */
export async function getAllCorridorsWithFees(): Promise<Array<{
  corridor: CorridorMatch['corridor'];
  fees: {
    shipper: PartyFeeCalculation;
    carrier: PartyFeeCalculation;
    totalPlatformFee: number;
  };
  // Legacy format
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

  return corridors.map((corridor) => {
    const corridorData = mapCorridorToMatch(corridor, 'exact').corridor;
    const fees = calculateFeesFromCorridor(corridorData);

    return {
      corridor: corridorData,
      fees,
      // Legacy format
      fee: calculateFeeFromCorridor(
        Number(corridor.distanceKm),
        Number(corridor.pricePerKm),
        corridor.promoFlag,
        corridor.promoDiscountPct ? Number(corridor.promoDiscountPct) : null
      ),
    };
  });
}

// ============================================================================
// FEE PREVIEW FUNCTIONS
// Simplified interfaces for corridor management UI previews
//
// RELATIONSHIP TO calculatePartyFee:
// - calculatePartyFee uses Decimal.js for high precision (authoritative)
// - calculateFeePreview uses simple math for quick previews (UI display)
// - Both produce identical results - same formula, same 2 decimal rounding
// - Use calculatePartyFee for actual fee deduction, calculateFeePreview for display
// ============================================================================

export interface FeePreview {
  baseFee: number;
  discount: number;
  finalFee: number;
}

export interface DualPartyFeePreview {
  shipper: FeePreview;
  carrier: FeePreview;
  totalPlatformFee: number;
}

/**
 * THIS MODULE OWNS BUSINESS TRUTH FOR: SERVICE FEE CALCULATION
 *
 * OWNERSHIP DECLARATION (2026-02-06):
 * - calculateFeePreview() is the SINGLE SOURCE OF TRUTH for fee preview calculations
 * - calculateDualPartyFeePreview() is the SINGLE SOURCE OF TRUTH for dual-party fees
 * - Formula: baseFee = distanceKm × pricePerKm
 * - Rounding: delegated to lib/rounding.ts:roundMoney() (2 decimal places)
 *
 * Calculate a simple fee preview for a single party
 * Used by corridor management UI for quick fee display
 */
export function calculateFeePreview(
  distanceKm: number,
  pricePerKm: number,
  promoFlag: boolean,
  promoDiscountPct: number | null
): FeePreview {
  if (pricePerKm <= 0) {
    return { baseFee: 0, discount: 0, finalFee: 0 };
  }

  const baseFee = distanceKm * pricePerKm;
  let discount = 0;

  if (promoFlag && promoDiscountPct && promoDiscountPct > 0) {
    discount = baseFee * (promoDiscountPct / 100);
  }

  // Rounding delegated to lib/rounding.ts
  return {
    baseFee: roundMoney(baseFee),
    discount: roundMoney(discount),
    finalFee: roundMoney(baseFee - discount),
  };
}

/**
 * Calculate fee previews for both shipper and carrier
 * Used by corridor management UI for dual-party fee display
 */
export function calculateDualPartyFeePreview(
  distanceKm: number,
  shipperPricePerKm: number,
  shipperPromoFlag: boolean,
  shipperPromoPct: number | null,
  carrierPricePerKm: number,
  carrierPromoFlag: boolean,
  carrierPromoPct: number | null
): DualPartyFeePreview {
  const shipper = calculateFeePreview(distanceKm, shipperPricePerKm, shipperPromoFlag, shipperPromoPct);
  const carrier = calculateFeePreview(distanceKm, carrierPricePerKm, carrierPromoFlag, carrierPromoPct);

  return {
    shipper,
    carrier,
    totalPlatformFee: shipper.finalFee + carrier.finalFee,
  };
}

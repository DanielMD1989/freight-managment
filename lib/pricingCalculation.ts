/**
 * Pricing Calculation Utilities
 *
 * Sprint 16 - Story 16.1: Base + Per-KM Pricing Model
 *
 * Provides utilities for calculating freight pricing using the base + per-km model:
 * Total Fare = Base Fare + (Distance × Per-KM Rate)
 */

import Decimal from 'decimal.js';

/**
 * Calculate total fare from base fare and per-km components
 *
 * Formula: totalFare = baseFare + (tripKm × perKm)
 *
 * @param baseFare - Base fare component in ETB
 * @param perKm - Per-kilometer rate in ETB/km
 * @param tripKm - Trip distance in kilometers
 * @returns Total fare in ETB
 */
export function calculateTotalFare(
  baseFare: number | Decimal,
  perKm: number | Decimal,
  tripKm: number | Decimal
): Decimal {
  const baseFareDecimal = new Decimal(baseFare.toString());
  const perKmDecimal = new Decimal(perKm.toString());
  const tripKmDecimal = new Decimal(tripKm.toString());

  const kmComponent = perKmDecimal.mul(tripKmDecimal);
  const totalFare = baseFareDecimal.add(kmComponent);

  return totalFare;
}

/**
 * Calculate Revenue Per Mile (RPM)
 *
 * RPM = Total Fare / (Trip Distance in Miles)
 *
 * @param totalFare - Total fare in ETB
 * @param tripKm - Trip distance in kilometers
 * @returns Revenue per mile in ETB/mile
 */
export function calculateRPM(
  totalFare: number | Decimal,
  tripKm: number | Decimal
): Decimal {
  const totalFareDecimal = new Decimal(totalFare.toString());
  const tripKmDecimal = new Decimal(tripKm.toString());

  // Convert km to miles (1 km = 0.621371 miles)
  const tripMiles = tripKmDecimal.mul(0.621371);

  if (tripMiles.isZero()) {
    return new Decimal(0);
  }

  const rpm = totalFareDecimal.div(tripMiles);
  return rpm;
}

/**
 * Calculate Revenue Per Kilometer (RPK)
 *
 * RPK = Total Fare / Trip Distance
 *
 * @param totalFare - Total fare in ETB
 * @param tripKm - Trip distance in kilometers
 * @returns Revenue per kilometer in ETB/km
 */
export function calculateRPK(
  totalFare: number | Decimal,
  tripKm: number | Decimal
): Decimal {
  const totalFareDecimal = new Decimal(totalFare.toString());
  const tripKmDecimal = new Decimal(tripKm.toString());

  if (tripKmDecimal.isZero()) {
    return new Decimal(0);
  }

  const rpk = totalFareDecimal.div(tripKmDecimal);
  return rpk;
}

/**
 * Calculate True Revenue Per Mile including deadhead
 *
 * True RPM = Total Fare / (Trip Distance + DH Origin + DH Destination) in miles
 *
 * This gives a more accurate picture of revenue efficiency by including
 * unpaid deadhead miles.
 *
 * @param totalFare - Total fare in ETB
 * @param tripKm - Loaded trip distance in kilometers
 * @param dhOriginKm - Deadhead to origin in kilometers
 * @param dhDestKm - Deadhead after delivery in kilometers
 * @returns True revenue per mile in ETB/mile
 */
export function calculateTrueRPM(
  totalFare: number | Decimal,
  tripKm: number | Decimal,
  dhOriginKm: number | Decimal = 0,
  dhDestKm: number | Decimal = 0
): Decimal {
  const totalFareDecimal = new Decimal(totalFare.toString());
  const tripKmDecimal = new Decimal(tripKm.toString());
  const dhOriginKmDecimal = new Decimal(dhOriginKm.toString());
  const dhDestKmDecimal = new Decimal(dhDestKm.toString());

  // Total distance including deadhead
  const totalKm = tripKmDecimal.add(dhOriginKmDecimal).add(dhDestKmDecimal);

  // Convert to miles
  const totalMiles = totalKm.mul(0.621371);

  if (totalMiles.isZero()) {
    return new Decimal(0);
  }

  const trueRpm = totalFareDecimal.div(totalMiles);
  return trueRpm;
}

/**
 * Calculate True Revenue Per Kilometer including deadhead
 *
 * True RPK = Total Fare / (Trip Distance + DH Origin + DH Destination)
 *
 * @param totalFare - Total fare in ETB
 * @param tripKm - Loaded trip distance in kilometers
 * @param dhOriginKm - Deadhead to origin in kilometers
 * @param dhDestKm - Deadhead after delivery in kilometers
 * @returns True revenue per kilometer in ETB/km
 */
export function calculateTrueRPK(
  totalFare: number | Decimal,
  tripKm: number | Decimal,
  dhOriginKm: number | Decimal = 0,
  dhDestKm: number | Decimal = 0
): Decimal {
  const totalFareDecimal = new Decimal(totalFare.toString());
  const tripKmDecimal = new Decimal(tripKm.toString());
  const dhOriginKmDecimal = new Decimal(dhOriginKm.toString());
  const dhDestKmDecimal = new Decimal(dhDestKm.toString());

  // Total distance including deadhead
  const totalKm = tripKmDecimal.add(dhOriginKmDecimal).add(dhDestKmDecimal);

  if (totalKm.isZero()) {
    return new Decimal(0);
  }

  const trueRpk = totalFareDecimal.div(totalKm);
  return trueRpk;
}

/**
 * Validate pricing parameters
 *
 * @param baseFare - Base fare (must be > 0)
 * @param perKm - Per-km rate (must be > 0)
 * @param tripKm - Trip distance (must be > 0)
 * @throws Error if validation fails
 */
export function validatePricing(
  baseFare: number | Decimal,
  perKm: number | Decimal,
  tripKm?: number | Decimal
): void {
  const baseFareDecimal = new Decimal(baseFare.toString());
  const perKmDecimal = new Decimal(perKm.toString());

  if (baseFareDecimal.lessThanOrEqualTo(0)) {
    throw new Error('Base fare must be greater than 0');
  }

  if (perKmDecimal.lessThanOrEqualTo(0)) {
    throw new Error('Per-km rate must be greater than 0');
  }

  if (tripKm !== undefined) {
    const tripKmDecimal = new Decimal(tripKm.toString());
    if (tripKmDecimal.lessThan(0)) {
      throw new Error('Trip distance cannot be negative');
    }
  }
}

/**
 * Format currency for display
 *
 * @param amount - Amount in ETB
 * @param decimals - Number of decimal places (default 2)
 * @returns Formatted string
 */
export function formatCurrency(
  amount: number | Decimal,
  decimals: number = 2
): string {
  const amountDecimal = new Decimal(amount.toString());
  return amountDecimal.toFixed(decimals);
}

/**
 * Get pricing breakdown for display
 *
 * @param baseFare - Base fare in ETB
 * @param perKm - Per-km rate in ETB/km
 * @param tripKm - Trip distance in km
 * @param dhOriginKm - Deadhead to origin (optional)
 * @param dhDestKm - Deadhead after delivery (optional)
 * @returns Pricing breakdown object
 */
export function getPricingBreakdown(
  baseFare: number | Decimal,
  perKm: number | Decimal,
  tripKm: number | Decimal,
  dhOriginKm?: number | Decimal,
  dhDestKm?: number | Decimal
) {
  validatePricing(baseFare, perKm, tripKm);

  const totalFare = calculateTotalFare(baseFare, perKm, tripKm);
  const rpk = calculateRPK(totalFare, tripKm);
  const rpm = calculateRPM(totalFare, tripKm);

  const breakdown: any = {
    baseFare: formatCurrency(baseFare),
    perKm: formatCurrency(perKm),
    tripKm: formatCurrency(tripKm),
    kmComponent: formatCurrency(new Decimal(perKm.toString()).mul(tripKm.toString())),
    totalFare: formatCurrency(totalFare),
    rpk: formatCurrency(rpk),
    rpm: formatCurrency(rpm),
  };

  // Add true RPM/RPK if deadhead is provided
  if (dhOriginKm !== undefined || dhDestKm !== undefined) {
    const trueRpk = calculateTrueRPK(
      totalFare,
      tripKm,
      dhOriginKm || 0,
      dhDestKm || 0
    );
    const trueRpm = calculateTrueRPM(
      totalFare,
      tripKm,
      dhOriginKm || 0,
      dhDestKm || 0
    );

    breakdown.dhOriginKm = formatCurrency(dhOriginKm || 0);
    breakdown.dhDestKm = formatCurrency(dhDestKm || 0);
    breakdown.trueRpk = formatCurrency(trueRpk);
    breakdown.trueRpm = formatCurrency(trueRpm);
  }

  return breakdown;
}

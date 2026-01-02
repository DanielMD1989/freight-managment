/**
 * Pricing Guidance Helper
 *
 * Sprint 16 - Story 16.1: Base + Per-KM Pricing Model
 *
 * Provides market average pricing suggestions and warnings for below-market pricing
 */

import { TruckType } from '@prisma/client';
import Decimal from 'decimal.js';

/**
 * Market average per-km rates by truck type (ETB/km)
 *
 * These are baseline market rates for Ethiopian freight transport
 * Updated periodically based on market data
 */
const MARKET_RATES_PER_KM: Record<TruckType, number> = {
  DRY_VAN: 25.0, // Standard dry van - most common
  FLATBED: 28.0, // Flatbed - specialized loading
  REFRIGERATED: 35.0, // Reefer - requires fuel for cooling
  TANKER: 32.0, // Tanker - specialized equipment
  CONTAINER: 30.0, // Container - port/intermodal
  DUMP_TRUCK: 26.0, // Dump truck - construction
  LOWBOY: 34.0, // Lowboy - heavy equipment transport
  BOX_TRUCK: 24.0, // Box truck - smaller loads
};

/**
 * Market average base fares by truck type (ETB)
 *
 * Base fare covers initial costs: fuel for deadhead, setup, paperwork
 */
const MARKET_BASE_FARES: Record<TruckType, number> = {
  DRY_VAN: 1500.0,
  FLATBED: 1800.0,
  REFRIGERATED: 2500.0,
  TANKER: 2200.0,
  CONTAINER: 2000.0,
  DUMP_TRUCK: 1600.0,
  LOWBOY: 2400.0,
  BOX_TRUCK: 1400.0,
};

/**
 * Percentage below market rate that triggers a warning
 */
const WARNING_THRESHOLD_PERCENT = 20; // 20% below market

export interface PricingGuidance {
  suggestedPerKmRate: number;
  suggestedBaseFare: number;
  suggestedTotalFare: number;
  providedPerKmRate?: number;
  providedBaseFare?: number;
  providedTotalFare?: number;
  isBelowMarket: boolean;
  percentBelowMarket?: number;
  warning?: string;
  marketInsight: string;
}

/**
 * Get market average pricing suggestion for a load
 *
 * @param truckType - Type of truck required
 * @param estimatedTripKm - Estimated trip distance in kilometers
 * @param providedBaseFare - Optional: User's proposed base fare
 * @param providedPerKm - Optional: User's proposed per-km rate
 * @returns Pricing guidance with suggestions and warnings
 */
export function getPricingGuidance(
  truckType: TruckType,
  estimatedTripKm: number | Decimal,
  providedBaseFare?: number | Decimal,
  providedPerKm?: number | Decimal
): PricingGuidance {
  const tripKm = new Decimal(estimatedTripKm.toString());
  const suggestedPerKmRate = MARKET_RATES_PER_KM[truckType];
  const suggestedBaseFare = MARKET_BASE_FARES[truckType];

  // Calculate suggested total fare
  const suggestedTotalFare = new Decimal(suggestedBaseFare)
    .add(new Decimal(suggestedPerKmRate).mul(tripKm))
    .toNumber();

  const guidance: PricingGuidance = {
    suggestedPerKmRate,
    suggestedBaseFare,
    suggestedTotalFare,
    isBelowMarket: false,
    marketInsight: `Market average for ${getTruckTypeLabel(truckType)}: ${suggestedPerKmRate} ETB/km + ${suggestedBaseFare} ETB base`,
  };

  // If user provided pricing, analyze it
  if (providedBaseFare !== undefined && providedPerKm !== undefined) {
    const userBaseFare = new Decimal(providedBaseFare.toString());
    const userPerKm = new Decimal(providedPerKm.toString());

    const providedTotalFare = userBaseFare.add(userPerKm.mul(tripKm)).toNumber();

    guidance.providedBaseFare = userBaseFare.toNumber();
    guidance.providedPerKmRate = userPerKm.toNumber();
    guidance.providedTotalFare = providedTotalFare;

    // Calculate percentage below market
    const marketTotal = new Decimal(suggestedTotalFare);
    const userTotal = new Decimal(providedTotalFare);

    if (userTotal.lessThan(marketTotal)) {
      const percentBelow = marketTotal
        .sub(userTotal)
        .div(marketTotal)
        .mul(100)
        .toNumber();

      guidance.percentBelowMarket = percentBelow;

      if (percentBelow >= WARNING_THRESHOLD_PERCENT) {
        guidance.isBelowMarket = true;
        guidance.warning = `⚠️ Your pricing is ${percentBelow.toFixed(1)}% below market average. This may attract carriers quickly but could reduce profitability.`;
      } else if (percentBelow >= 10) {
        guidance.warning = `ℹ️ Your pricing is ${percentBelow.toFixed(1)}% below market average. Consider if this aligns with your budget.`;
      }
    } else if (userTotal.greaterThan(marketTotal)) {
      const percentAbove = userTotal
        .sub(marketTotal)
        .div(marketTotal)
        .mul(100)
        .toNumber();

      guidance.marketInsight = `Your pricing is ${percentAbove.toFixed(1)}% above market average. This may take longer to find carriers but ensures better margins.`;
    } else {
      guidance.marketInsight = `✓ Your pricing aligns with market average.`;
    }
  }

  return guidance;
}

/**
 * Get suggested base fare for a truck type
 *
 * @param truckType - Type of truck
 * @returns Suggested base fare in ETB
 */
export function getSuggestedBaseFare(truckType: TruckType): number {
  return MARKET_BASE_FARES[truckType];
}

/**
 * Get suggested per-km rate for a truck type
 *
 * @param truckType - Type of truck
 * @returns Suggested per-km rate in ETB/km
 */
export function getSuggestedPerKmRate(truckType: TruckType): number {
  return MARKET_RATES_PER_KM[truckType];
}

/**
 * Calculate suggested total fare for a load
 *
 * @param truckType - Type of truck required
 * @param estimatedTripKm - Estimated trip distance in kilometers
 * @returns Suggested total fare in ETB
 */
export function getSuggestedTotalFare(
  truckType: TruckType,
  estimatedTripKm: number | Decimal
): number {
  const tripKm = new Decimal(estimatedTripKm.toString());
  const baseFare = new Decimal(MARKET_BASE_FARES[truckType]);
  const perKmRate = new Decimal(MARKET_RATES_PER_KM[truckType]);

  return baseFare.add(perKmRate.mul(tripKm)).toNumber();
}

/**
 * Check if pricing is below market threshold
 *
 * @param truckType - Type of truck
 * @param baseFare - Proposed base fare
 * @param perKm - Proposed per-km rate
 * @param estimatedTripKm - Estimated trip distance
 * @returns True if pricing is significantly below market
 */
export function isBelowMarketThreshold(
  truckType: TruckType,
  baseFare: number | Decimal,
  perKm: number | Decimal,
  estimatedTripKm: number | Decimal
): boolean {
  const guidance = getPricingGuidance(truckType, estimatedTripKm, baseFare, perKm);
  return guidance.isBelowMarket;
}

/**
 * Get pricing range (min/max) for a truck type and distance
 *
 * @param truckType - Type of truck
 * @param estimatedTripKm - Estimated trip distance
 * @returns Min and max suggested fares
 */
export function getPricingRange(
  truckType: TruckType,
  estimatedTripKm: number | Decimal
): { min: number; max: number; market: number } {
  const market = getSuggestedTotalFare(truckType, estimatedTripKm);

  // Reasonable range: -30% to +50% of market
  const min = Math.round(market * 0.7);
  const max = Math.round(market * 1.5);

  return { min, max, market };
}

/**
 * Get human-readable truck type label
 *
 * @param truckType - Truck type enum
 * @returns Human-readable label
 */
function getTruckTypeLabel(truckType: TruckType): string {
  const labels: Record<TruckType, string> = {
    DRY_VAN: 'Dry Van',
    FLATBED: 'Flatbed',
    REFRIGERATED: 'Refrigerated',
    TANKER: 'Tanker',
    CONTAINER: 'Container',
    DUMP_TRUCK: 'Dump Truck',
    LOWBOY: 'Lowboy',
    BOX_TRUCK: 'Box Truck',
  };

  return labels[truckType] || truckType;
}

/**
 * Format pricing guidance as user-friendly message
 *
 * @param guidance - Pricing guidance object
 * @returns Formatted message for display
 */
export function formatPricingGuidance(guidance: PricingGuidance): string {
  let message = `${guidance.marketInsight}\n\n`;

  message += `Suggested pricing:\n`;
  message += `- Base Fare: ${guidance.suggestedBaseFare} ETB\n`;
  message += `- Per KM Rate: ${guidance.suggestedPerKmRate} ETB/km\n`;
  message += `- Total: ${guidance.suggestedTotalFare.toFixed(2)} ETB\n`;

  if (guidance.providedTotalFare !== undefined) {
    message += `\nYour pricing: ${guidance.providedTotalFare.toFixed(2)} ETB\n`;
  }

  if (guidance.warning) {
    message += `\n${guidance.warning}`;
  }

  return message;
}

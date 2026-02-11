/**
 * THIS MODULE OWNS BUSINESS TRUTH FOR: ROUNDING STRATEGIES
 *
 * All rounding across the system MUST delegate to this module.
 * This ensures consistent rounding behavior for:
 * - Money values (2 decimal places)
 * - Percentages (1-2 decimal places)
 * - Distances (0-1 decimal places)
 * - Coordinates (4-6 decimal places)
 *
 * BEHAVIOR FREEZE DATE: 2026-02-07
 * DO NOT MODIFY FORMULAS WITHOUT SNAPSHOT TEST COVERAGE
 *
 * Rounding Strategy Documentation:
 * --------------------------------
 * | Value Type  | Method                          | Decimals | Use Case                    |
 * |-------------|--------------------------------|----------|-----------------------------|
 * | MONEY       | Math.round(x * 100) / 100      | 2        | Fees, balances, payments    |
 * | PERCENTAGE  | Math.round(x * 10) / 10        | 1        | SLA rates, completion rates |
 * | PERCENTAGE2 | Math.round(x * 100) / 100      | 2        | Trust scores, detailed %    |
 * | DISTANCE    | Math.round(x)                  | 0        | UI display (km)             |
 * | DISTANCE1   | Math.round(x * 10) / 10        | 1        | Detailed distance (km)      |
 * | COORDINATE  | parseFloat(x.toFixed(4))       | 4        | GPS caching (~11m precision)|
 * | COORDINATE6 | parseFloat(x.toFixed(6))       | 6        | GPS display (~0.1m precision)|
 */

// ============================================================================
// MONEY ROUNDING (2 decimal places)
// ============================================================================

/**
 * Round money values to 2 decimal places
 *
 * Use for: service fees, balances, payments, prices
 *
 * @param value - The numeric value to round
 * @returns Rounded value with 2 decimal places
 */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Format money value as string with 2 decimal places
 *
 * Use for: display, logging, API responses
 *
 * @param value - The numeric value to format
 * @returns String formatted with 2 decimal places
 */
export function formatMoney(value: number): string {
  return value.toFixed(2);
}

// ============================================================================
// PERCENTAGE ROUNDING
// ============================================================================

/**
 * Round percentage to 1 decimal place
 *
 * Use for: SLA rates, completion rates, general percentages
 *
 * @param value - The percentage value (0-100)
 * @returns Rounded value with 1 decimal place
 */
export function roundPercentage(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Round percentage to 2 decimal places
 *
 * Use for: trust scores, detailed analytics
 *
 * @param value - The percentage value (0-100)
 * @returns Rounded value with 2 decimal places
 */
export function roundPercentage2(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Format percentage as string with 1 decimal place
 *
 * @param value - The percentage value
 * @returns String formatted with 1 decimal place
 */
export function formatPercentage(value: number): string {
  return value.toFixed(1);
}

/**
 * Format percentage as string with 2 decimal places
 *
 * @param value - The percentage value
 * @returns String formatted with 2 decimal places
 */
export function formatPercentage2(value: number): string {
  return value.toFixed(2);
}

// ============================================================================
// DISTANCE ROUNDING
// ============================================================================

/**
 * Round distance to integer (0 decimal places)
 *
 * Use for: UI display, summary views
 *
 * @param value - The distance in km
 * @returns Rounded integer distance
 */
export function roundDistance(value: number): number {
  return Math.round(value);
}

/**
 * Round distance to 1 decimal place
 *
 * Use for: detailed distance display, trip progress
 *
 * @param value - The distance in km
 * @returns Rounded value with 1 decimal place
 */
export function roundDistance1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Format distance as string with 0 decimal places
 *
 * @param value - The distance in km
 * @returns String formatted with 0 decimal places
 */
export function formatDistance(value: number): string {
  return value.toFixed(0);
}

/**
 * Format distance as string with 1 decimal place
 *
 * @param value - The distance in km
 * @returns String formatted with 1 decimal place
 */
export function formatDistance1(value: number): string {
  return value.toFixed(1);
}

// ============================================================================
// COORDINATE ROUNDING
// ============================================================================

/**
 * Round GPS coordinate to 4 decimal places (~11m precision)
 *
 * Use for: caching, API calls, general GPS operations
 *
 * @param value - The coordinate (latitude or longitude)
 * @returns Rounded coordinate with 4 decimal places
 */
export function roundCoordinate(value: number): number {
  return parseFloat(value.toFixed(4));
}

/**
 * Round GPS coordinate to 6 decimal places (~0.1m precision)
 *
 * Use for: high-precision GPS display, tracking
 *
 * @param value - The coordinate (latitude or longitude)
 * @returns Rounded coordinate with 6 decimal places
 */
export function roundCoordinate6(value: number): number {
  return parseFloat(value.toFixed(6));
}

/**
 * Format coordinate as string with 4 decimal places
 *
 * @param value - The coordinate
 * @returns String formatted with 4 decimal places
 */
export function formatCoordinate(value: number): string {
  return value.toFixed(4);
}

/**
 * Format coordinate as string with 6 decimal places
 *
 * @param value - The coordinate
 * @returns String formatted with 6 decimal places
 */
export function formatCoordinate6(value: number): string {
  return value.toFixed(6);
}

// ============================================================================
// GENERIC ROUNDING
// ============================================================================

/**
 * Round to arbitrary decimal places
 *
 * Use when specific rounding functions don't apply.
 * Prefer using specific functions (roundMoney, roundPercentage, etc.)
 *
 * @param value - The value to round
 * @param decimals - Number of decimal places (0-10)
 * @returns Rounded value
 */
export function roundToDecimals(value: number, decimals: number): number {
  if (decimals < 0 || decimals > 10) {
    throw new Error('Decimals must be between 0 and 10');
  }
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type RoundingType =
  | 'money'        // 2 decimals
  | 'percentage'   // 1 decimal
  | 'percentage2'  // 2 decimals
  | 'distance'     // 0 decimals
  | 'distance1'    // 1 decimal
  | 'coordinate'   // 4 decimals
  | 'coordinate6'; // 6 decimals

/**
 * Apply rounding based on type
 *
 * Utility function for dynamic rounding selection
 *
 * @param value - The value to round
 * @param type - The rounding type
 * @returns Rounded value
 */
export function round(value: number, type: RoundingType): number {
  switch (type) {
    case 'money':
      return roundMoney(value);
    case 'percentage':
      return roundPercentage(value);
    case 'percentage2':
      return roundPercentage2(value);
    case 'distance':
      return roundDistance(value);
    case 'distance1':
      return roundDistance1(value);
    case 'coordinate':
      return roundCoordinate(value);
    case 'coordinate6':
      return roundCoordinate6(value);
    default:
      return value;
  }
}

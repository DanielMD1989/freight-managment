/**
 * Geographic Utilities
 *
 * THIS MODULE OWNS BUSINESS TRUTH FOR: DISTANCE CALCULATION
 *
 * Shared utilities for distance calculations using the Haversine formula.
 * Centralizes coordinate-based distance calculations to avoid code duplication.
 *
 * OWNERSHIP DECLARATION (2026-02-06):
 * - calculateDistanceKm() is the SINGLE SOURCE OF TRUTH for distance
 * - All other distance implementations should import from this module
 * - Do NOT create new inline haversine implementations
 *
 * COLLAPSED DUPLICATES (2026-02-08):
 * - app/api/distance/route.ts — now imports calculateDistanceKm + roundDistance1
 * - app/api/gps/history/route.ts — now imports calculateDistanceKm
 * - app/api/trips/[tripId]/history/route.ts — now imports calculateDistanceKm
 * - app/api/trips/[tripId]/live/route.ts — now imports calculateDistanceKm
 * - lib/automationRules.ts — now imports calculateDistanceKm
 * - __tests__/foundation/marketplace.test.ts — now imports calculateDistanceKm
 *
 * KNOWN DEPRECATED DUPLICATES (marked as DEPRECATED — READ-ONLY):
 * - lib/gpsQuery.ts:176 — haversineDistance (duplicate)
 * - app/carrier/loadboard/SearchLoadsTab.tsx:28 — haversineDistance (duplicate, rounds to integer)
 * - app/carrier/loadboard/PostTrucksTab.tsx:258 — haversineDistance (duplicate, rounds to integer)
 */

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate distance between two GPS coordinates in kilometers
 * Using Haversine formula
 *
 * @param lat1 - Latitude of first point (-90 to 90)
 * @param lon1 - Longitude of first point (-180 to 180)
 * @param lat2 - Latitude of second point (-90 to 90)
 * @param lon2 - Longitude of second point (-180 to 180)
 * @returns Distance in kilometers (0 if invalid coordinates)
 */
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Validate inputs: return 0 for invalid coordinates
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2) ||
    lat1 < -90 ||
    lat1 > 90 ||
    lat2 < -90 ||
    lat2 > 90 ||
    lon1 < -180 ||
    lon1 > 180 ||
    lon2 < -180 ||
    lon2 > 180
  ) {
    return 0;
  }

  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate distance between two GPS coordinates in meters
 * Using Haversine formula
 *
 * @param lat1 - Latitude of first point (-90 to 90)
 * @param lon1 - Longitude of first point (-180 to 180)
 * @param lat2 - Latitude of second point (-90 to 90)
 * @param lon2 - Longitude of second point (-180 to 180)
 * @returns Distance in meters (0 if invalid coordinates)
 */
export function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  // Validate inputs: return 0 for invalid coordinates
  if (
    !Number.isFinite(lat1) ||
    !Number.isFinite(lon1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lon2) ||
    lat1 < -90 ||
    lat1 > 90 ||
    lat2 < -90 ||
    lat2 > 90 ||
    lon1 < -180 ||
    lon1 > 180 ||
    lon2 < -180 ||
    lon2 > 180
  ) {
    return 0;
  }

  const R = 6371000; // Earth's radius in meters
  const φ1 = toRadians(lat1);
  const φ2 = toRadians(lat2);
  const Δφ = toRadians(lat2 - lat1);
  const Δλ = toRadians(lon2 - lon1);

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Alias for calculateDistanceKm for backward compatibility
 * Use calculateDistanceKm for new code
 */
export const haversineDistance = calculateDistanceKm;

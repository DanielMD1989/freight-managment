/**
 * Distance Calculation Service
 *
 * Sprint 8 - Story 8.3: Map-Based Distance Calculation
 * PHASE 3: Redis Caching for Performance
 *
 * Provides distance calculation between Ethiopian locations using:
 * - Haversine formula (straight-line distance)
 * - Optional: Road distance via routing APIs (future)
 * - Redis caching for performance (24hr TTL for geodata)
 */

import { db } from '@/lib/db';
import { getLocationById } from '@/lib/locationService';
import { GeoCache, CacheTTL } from '@/lib/cache';

/**
 * Calculate distance between two locations
 *
 * Currently uses Haversine formula for straight-line distance.
 * Future: Can be enhanced with routing APIs for road distance.
 *
 * @param originId Origin location ID
 * @param destinationId Destination location ID
 * @param useCache Whether to use/update cache (default: true)
 * @returns Distance in kilometers or null if locations not found
 */
export async function calculateDistance(
  originId: string,
  destinationId: string,
  useCache: boolean = true
): Promise<number | null> {
  // Validate input
  if (!originId || !destinationId) {
    return null;
  }

  // Same location = 0 distance
  if (originId === destinationId) {
    return 0;
  }

  // Check cache if enabled
  if (useCache) {
    const cachedDistance = await getCachedDistance(originId, destinationId);
    if (cachedDistance !== null) {
      return cachedDistance;
    }
  }

  // Get locations
  const [origin, destination] = await Promise.all([
    getLocationById(originId),
    getLocationById(destinationId),
  ]);

  if (!origin || !destination) {
    return null;
  }

  // Calculate Haversine distance
  const distance = calculateHaversineDistance(
    Number(origin.latitude),
    Number(origin.longitude),
    Number(destination.latitude),
    Number(destination.longitude)
  );

  // Cache result if enabled
  if (useCache) {
    await cacheDistance(originId, destinationId, distance);
  }

  return distance;
}

/**
 * Calculate Haversine distance between two coordinates
 *
 * @param lat1 Origin latitude
 * @param lon1 Origin longitude
 * @param lat2 Destination latitude
 * @param lon2 Destination longitude
 * @returns Distance in kilometers (rounded to 1 decimal)
 */
export function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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

  const distance = R * c;

  return Math.round(distance * 10) / 10; // Round to 1 decimal place
}

/**
 * Convert degrees to radians
 */
function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Get cached distance between two locations
 *
 * Uses Redis cache (Phase 3) with automatic fallback to in-memory.
 * Checks both directions (origin->destination and destination->origin)
 * since distance is symmetric.
 *
 * @param originId Origin location ID
 * @param destinationId Destination location ID
 * @returns Cached distance or null if not found
 */
async function getCachedDistance(
  originId: string,
  destinationId: string
): Promise<number | null> {
  try {
    // Try Redis cache first (both directions)
    const cached = await GeoCache.getDistance(originId, destinationId);
    if (cached) {
      return cached.distanceKm;
    }

    // Try reverse direction
    const cachedReverse = await GeoCache.getDistance(destinationId, originId);
    if (cachedReverse) {
      return cachedReverse.distanceKm;
    }

    // Fallback: Check database cache (legacy)
    const cacheKeys = [
      `distance:${originId}:${destinationId}`,
      `distance:${destinationId}:${originId}`,
    ];

    for (const key of cacheKeys) {
      const dbCached = await db.systemConfig.findUnique({
        where: { key },
      });

      if (dbCached) {
        const distance = parseFloat(dbCached.value);
        if (!isNaN(distance)) {
          // Migrate to Redis cache
          await GeoCache.setDistance(originId, destinationId, { distanceKm: distance });
          return distance;
        }
      }
    }

    return null;
  } catch (error) {
    console.error('Error getting cached distance:', error);
    return null;
  }
}

/**
 * Cache calculated distance
 *
 * Uses Redis cache (Phase 3) for high-performance distributed caching.
 * Falls back to database storage for persistence.
 *
 * @param originId Origin location ID
 * @param destinationId Destination location ID
 * @param distance Distance in kilometers
 */
async function cacheDistance(
  originId: string,
  destinationId: string,
  distance: number
): Promise<void> {
  try {
    // Cache in Redis (24hr TTL - geodata rarely changes)
    await GeoCache.setDistance(originId, destinationId, { distanceKm: distance });

    // Also persist to database for long-term storage (background, non-blocking)
    const key = `distance:${originId}:${destinationId}`;
    db.systemConfig.upsert({
      where: { key },
      update: { value: distance.toString() },
      create: {
        key,
        value: distance.toString(),
        description: `Cached distance between ${originId} and ${destinationId}`,
      },
    }).catch((error) => {
      console.error('Error persisting distance to database:', error);
    });
  } catch (error) {
    // Cache failure shouldn't break the app
    console.error('Error caching distance:', error);
  }
}

/**
 * Calculate route distance (future implementation)
 *
 * This would use a routing API (e.g., OSRM, Mapbox, Google Maps)
 * to get actual road distance instead of straight-line distance.
 *
 * For MVP, we use Haversine distance.
 * For production, this can be implemented using:
 * - OSRM (open-source routing)
 * - Mapbox Directions API
 * - Google Maps Distance Matrix API
 *
 * @param originId Origin location ID
 * @param destinationId Destination location ID
 * @returns Road distance in kilometers or null
 */
export async function calculateRoutingDistance(
  originId: string,
  destinationId: string
): Promise<number | null> {
  // Future implementation
  // For now, fall back to Haversine
  return calculateDistance(originId, destinationId);
}

/**
 * Batch calculate distances for multiple origin-destination pairs
 *
 * More efficient than calling calculateDistance multiple times.
 *
 * @param pairs Array of [originId, destinationId] tuples
 * @param useCache Whether to use caching
 * @returns Array of distances (null for invalid pairs)
 */
export async function batchCalculateDistances(
  pairs: Array<[string, string]>,
  useCache: boolean = true
): Promise<Array<number | null>> {
  return Promise.all(
    pairs.map(([originId, destinationId]) =>
      calculateDistance(originId, destinationId, useCache)
    )
  );
}

/**
 * Clear distance cache (admin utility)
 *
 * Removes all cached distance calculations from both Redis and database.
 * Useful after location data updates.
 */
export async function clearDistanceCache(): Promise<void> {
  try {
    // Clear Redis cache
    const { cache } = await import('@/lib/cache');
    await cache.deletePattern('geodata:distance:*');

    // Clear database cache
    await db.systemConfig.deleteMany({
      where: {
        key: {
          startsWith: 'distance:',
        },
      },
    });

    console.log('[DistanceService] Distance cache cleared');
  } catch (error) {
    console.error('Error clearing distance cache:', error);
  }
}

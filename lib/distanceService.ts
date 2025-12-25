/**
 * Distance Calculation Service
 *
 * Sprint 8 - Story 8.3: Map-Based Distance Calculation
 *
 * Provides distance calculation between Ethiopian locations using:
 * - Haversine formula (straight-line distance)
 * - Optional: Road distance via routing APIs (future)
 * - Distance caching for performance
 */

import { db } from '@/lib/db';
import { getLocationById } from '@/lib/locationService';

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
    // Check if we have a system config cache for distances
    // Format: "distance:locationId1:locationId2" -> distance value
    const cacheKeys = [
      `distance:${originId}:${destinationId}`,
      `distance:${destinationId}:${originId}`, // Check reverse too
    ];

    for (const key of cacheKeys) {
      const cached = await db.systemConfig.findUnique({
        where: { key },
      });

      if (cached) {
        const distance = parseFloat(cached.value);
        if (!isNaN(distance)) {
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
 * Stores distance in SystemConfig table for future lookups.
 * This is a simple in-database cache. For production, consider Redis.
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
    const key = `distance:${originId}:${destinationId}`;

    await db.systemConfig.upsert({
      where: { key },
      update: { value: distance.toString() },
      create: {
        key,
        value: distance.toString(),
        description: `Cached distance between ${originId} and ${destinationId}`,
      },
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
 * Removes all cached distance calculations.
 * Useful after location data updates.
 */
export async function clearDistanceCache(): Promise<void> {
  try {
    await db.systemConfig.deleteMany({
      where: {
        key: {
          startsWith: 'distance:',
        },
      },
    });
  } catch (error) {
    console.error('Error clearing distance cache:', error);
  }
}

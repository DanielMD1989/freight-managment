/**
 * Location Service Utility
 *
 * Helper functions for Ethiopian location management, validation, and search.
 *
 * Sprint 8 - Story 8.2: Ethiopian Location Management
 */

import { db } from '@/lib/db';
import { EthiopianLocation } from '@prisma/client';
import { calculateDistanceKm } from '@/lib/geo';

/**
 * Validate that a location ID exists and is active
 *
 * @param locationId - Location ID to validate
 * @returns true if valid, false otherwise
 *
 * Security: Validates location exists before using in FK relationships
 */
export async function validateLocation(locationId: string): Promise<boolean> {
  if (!locationId || typeof locationId !== 'string') {
    return false;
  }

  try {
    const location = await db.ethiopianLocation.findUnique({
      where: { id: locationId },
      select: { isActive: true },
    });

    return location?.isActive === true;
  } catch (error) {
    console.error('Error validating location:', error);
    return false;
  }
}

/**
 * Search locations by query string (fuzzy matching)
 *
 * Searches across name, nameEthiopic, and aliases.
 * Case-insensitive and supports partial matches.
 *
 * @param query - Search query string
 * @param limit - Max results (default: 20, max: 100)
 * @returns Array of matching locations
 *
 * Security: Input sanitization to prevent injection
 */
export async function searchLocations(
  query: string,
  limit: number = 20
): Promise<EthiopianLocation[]> {
  if (!query || typeof query !== 'string') {
    return [];
  }

  // Sanitize query: allow letters, numbers, spaces, hyphens, and Ethiopian characters
  const sanitizedQuery = query.trim().replace(/[^\w\s\u1200-\u137F-]/g, '');

  if (sanitizedQuery.length === 0) {
    return [];
  }

  // Limit results (max 100)
  const safeLimit = Math.min(Math.max(limit, 1), 100);

  try {
    const locations = await db.ethiopianLocation.findMany({
      where: {
        isActive: true,
        OR: [
          {
            name: {
              contains: sanitizedQuery,
              mode: 'insensitive',
            },
          },
          {
            nameEthiopic: {
              contains: sanitizedQuery,
              mode: 'insensitive',
            },
          },
          {
            aliases: {
              hasSome: [sanitizedQuery],
            },
          },
        ],
      },
      orderBy: [
        { type: 'asc' }, // Cities first
        { population: 'desc' }, // Larger cities first
        { name: 'asc' },
      ],
      take: safeLimit,
    });

    return locations;
  } catch (error) {
    console.error('Error searching locations:', error);
    return [];
  }
}

/**
 * Get nearby locations within a radius
 *
 * Uses Haversine formula for distance calculation.
 * Returns locations sorted by distance (closest first).
 *
 * @param locationId - Center location ID
 * @param radiusKm - Radius in kilometers (default: 100km, max: 1000km)
 * @returns Array of nearby locations with distance
 *
 * Note: For production, consider using PostGIS for better performance
 */
export async function getNearbyLocations(
  locationId: string,
  radiusKm: number = 100
): Promise<Array<EthiopianLocation & { distanceKm: number }>> {
  if (!locationId || typeof locationId !== 'string') {
    return [];
  }

  // Limit radius (max 1000km)
  const safeRadius = Math.min(Math.max(radiusKm, 1), 1000);

  try {
    // Get center location
    const centerLocation = await db.ethiopianLocation.findUnique({
      where: { id: locationId },
      select: { latitude: true, longitude: true, isActive: true },
    });

    if (!centerLocation || !centerLocation.isActive) {
      return [];
    }

    const centerLat = Number(centerLocation.latitude);
    const centerLon = Number(centerLocation.longitude);

    // Get all active locations
    const allLocations = await db.ethiopianLocation.findMany({
      where: {
        isActive: true,
        NOT: { id: locationId }, // Exclude center location
      },
    });

    // Calculate distances and filter by radius
    const locationsWithDistance = allLocations
      .map((location) => {
        const distance = calculateDistanceKm(
          centerLat,
          centerLon,
          Number(location.latitude),
          Number(location.longitude)
        );

        return {
          ...location,
          distanceKm: Math.round(distance * 10) / 10, // Round to 1 decimal
        };
      })
      .filter((loc) => loc.distanceKm <= safeRadius)
      .sort((a, b) => a.distanceKm - b.distanceKm);

    return locationsWithDistance;
  } catch (error) {
    console.error('Error getting nearby locations:', error);
    return [];
  }
}

/**
 * Get location by ID
 *
 * @param locationId - Location ID
 * @returns Location object or null
 */
export async function getLocationById(
  locationId: string
): Promise<EthiopianLocation | null> {
  if (!locationId || typeof locationId !== 'string') {
    return null;
  }

  try {
    const location = await db.ethiopianLocation.findUnique({
      where: { id: locationId },
    });

    if (!location || !location.isActive) {
      return null;
    }

    return location;
  } catch (error) {
    console.error('Error getting location by ID:', error);
    return null;
  }
}

/**
 * Get all unique regions
 *
 * @returns Array of region names
 */
export async function getAllRegions(): Promise<string[]> {
  try {
    const locations = await db.ethiopianLocation.findMany({
      where: { isActive: true },
      select: { region: true },
      distinct: ['region'],
      orderBy: { region: 'asc' },
    });

    return locations.map((loc) => loc.region);
  } catch (error) {
    console.error('Error getting regions:', error);
    return [];
  }
}

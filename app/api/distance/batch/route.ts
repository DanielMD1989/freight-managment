/**
 * Batch Distance Calculation API
 *
 * POST /api/distance/batch - Calculate distances for multiple origin-destination pairs
 *
 * Request body:
 * {
 *   pairs: [
 *     { origin: { lat, lng }, destination: { lat, lng } },
 *     ...
 *   ]
 * }
 *
 * Useful for:
 * - Calculating DH-O for multiple trucks to a load
 * - Calculating DH-D for multiple loads from a truck
 * - Bulk route planning
 *
 * MAP + GPS Implementation - Phase 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL = 24 * 60 * 60 * 1000;

// In-memory cache
const distanceCache = new Map<string, { distance: number; duration: number; timestamp: number }>();

const coordinateSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const pairSchema = z.object({
  id: z.string().optional(), // Optional ID to identify the pair in response
  origin: coordinateSchema,
  destination: coordinateSchema,
});

const batchRequestSchema = z.object({
  pairs: z.array(pairSchema).min(1).max(25), // Max 25 pairs per batch (Google API limit)
});

/**
 * Calculate Haversine (straight-line) distance
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Generate cache key
 */
function getCacheKey(oLat: number, oLng: number, dLat: number, dLng: number): string {
  return `${oLat.toFixed(4)},${oLng.toFixed(4)}-${dLat.toFixed(4)},${dLng.toFixed(4)}`;
}

/**
 * Fetch distances from Google Distance Matrix API (batch)
 */
async function getGoogleDistances(
  pairs: Array<{ origin: { lat: number; lng: number }; destination: { lat: number; lng: number } }>
): Promise<Map<string, { distance: number; duration: number } | null>> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const results = new Map<string, { distance: number; duration: number } | null>();

  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not configured');
    return results;
  }

  try {
    // Group by unique origins (Google API allows multiple destinations per origin)
    const originGroups = new Map<string, typeof pairs>();

    for (const pair of pairs) {
      const originKey = `${pair.origin.lat},${pair.origin.lng}`;
      if (!originGroups.has(originKey)) {
        originGroups.set(originKey, []);
      }
      originGroups.get(originKey)!.push(pair);
    }

    // Make API calls for each origin group
    for (const [originKey, group] of originGroups) {
      const destinations = group.map((p) => `${p.destination.lat},${p.destination.lng}`).join('|');

      const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
      url.searchParams.set('origins', originKey);
      url.searchParams.set('destinations', destinations);
      url.searchParams.set('mode', 'driving');
      url.searchParams.set('units', 'metric');
      url.searchParams.set('key', apiKey);

      const response = await fetch(url.toString());
      const data = await response.json();

      if (data.status !== 'OK') {
        console.error('Google API error:', data.status, data.error_message);
        continue;
      }

      const elements = data.rows?.[0]?.elements || [];
      for (let i = 0; i < group.length; i++) {
        const pair = group[i];
        const element = elements[i];
        const cacheKey = getCacheKey(
          pair.origin.lat,
          pair.origin.lng,
          pair.destination.lat,
          pair.destination.lng
        );

        if (element?.status === 'OK') {
          results.set(cacheKey, {
            distance: element.distance.value / 1000,
            duration: element.duration.value / 60,
          });
        } else {
          results.set(cacheKey, null);
        }
      }
    }

    return results;
  } catch (error) {
    console.error('Google batch distance error:', error);
    return results;
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAuth();

    const body = await request.json();
    const data = batchRequestSchema.parse(body);

    // Separate cached and uncached pairs
    const cachedResults: Array<{
      id?: string;
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
      distance: number;
      duration: number;
      source: string;
      cached: boolean;
    }> = [];

    const uncachedPairs: Array<{
      id?: string;
      origin: { lat: number; lng: number };
      destination: { lat: number; lng: number };
    }> = [];

    // Check cache first
    for (const pair of data.pairs) {
      const cacheKey = getCacheKey(
        pair.origin.lat,
        pair.origin.lng,
        pair.destination.lat,
        pair.destination.lng
      );
      const cached = distanceCache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        cachedResults.push({
          id: pair.id,
          origin: pair.origin,
          destination: pair.destination,
          distance: Math.round(cached.distance * 100) / 100,
          duration: Math.round(cached.duration),
          source: 'google',
          cached: true,
        });
      } else {
        uncachedPairs.push(pair);
      }
    }

    // Fetch uncached distances from Google
    const googleResults = uncachedPairs.length > 0
      ? await getGoogleDistances(uncachedPairs)
      : new Map();

    // Process uncached pairs
    const newResults: typeof cachedResults = [];

    for (const pair of uncachedPairs) {
      const cacheKey = getCacheKey(
        pair.origin.lat,
        pair.origin.lng,
        pair.destination.lat,
        pair.destination.lng
      );
      const googleResult = googleResults.get(cacheKey);

      if (googleResult) {
        // Cache the result
        distanceCache.set(cacheKey, {
          ...googleResult,
          timestamp: Date.now(),
        });

        newResults.push({
          id: pair.id,
          origin: pair.origin,
          destination: pair.destination,
          distance: Math.round(googleResult.distance * 100) / 100,
          duration: Math.round(googleResult.duration),
          source: 'google',
          cached: false,
        });
      } else {
        // Fallback to Haversine estimate
        const haversine = haversineDistance(
          pair.origin.lat,
          pair.origin.lng,
          pair.destination.lat,
          pair.destination.lng
        );
        const estimatedRoadDistance = haversine * 1.3;
        const estimatedDuration = (haversine / 50) * 60;

        newResults.push({
          id: pair.id,
          origin: pair.origin,
          destination: pair.destination,
          distance: Math.round(estimatedRoadDistance * 100) / 100,
          duration: Math.round(estimatedDuration),
          source: 'estimate',
          cached: false,
        });
      }
    }

    // Combine results
    const allResults = [...cachedResults, ...newResults];

    // Sort by original order if IDs were provided
    if (data.pairs.some((p) => p.id)) {
      const orderMap = new Map(data.pairs.map((p, i) => [p.id || i.toString(), i]));
      allResults.sort((a, b) => {
        const aOrder = orderMap.get(a.id || '') ?? 999;
        const bOrder = orderMap.get(b.id || '') ?? 999;
        return aOrder - bOrder;
      });
    }

    return NextResponse.json({
      results: allResults,
      count: allResults.length,
      cached: cachedResults.length,
      calculated: newResults.length,
    });
  } catch (error) {
    console.error('Batch distance error:', error);

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

/**
 * Google Routes API Service
 *
 * MAP + GPS Implementation - Story 5.2
 *
 * Calculates road distances and ETAs using Google Routes API.
 * Includes caching and fallback to Haversine calculation.
 *
 * Required environment variable:
 * - NEXT_PUBLIC_GOOGLE_MAPS_API_KEY or GOOGLE_ROUTES_API_KEY
 */

import { db } from "@/lib/db";
import { calculateDistance } from "@/lib/gpsTracking";

// Cache duration in milliseconds (24 hours)
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000;

export interface RouteResult {
  distanceMeters: number;
  distanceKm: number;
  durationSeconds: number;
  durationMinutes: number;
  estimatedArrival: Date | null;
  source: "google" | "haversine" | "cache";
}

export interface Coordinates {
  lat: number;
  lng: number;
}

/**
 * Calculate road distance between two points using Google Routes API
 *
 * Falls back to Haversine (straight-line) calculation if API unavailable.
 *
 * @param origin - Start coordinates
 * @param destination - End coordinates
 * @param useCache - Whether to check cache first (default: true)
 * @returns Route result with distance and duration
 */
export async function calculateRoadDistance(
  origin: Coordinates,
  destination: Coordinates,
  useCache = true
): Promise<RouteResult> {
  // Generate cache key from coordinates (rounded to 4 decimal places)
  const cacheKey = generateCacheKey(origin, destination);

  // Check cache first
  if (useCache) {
    const cached = await getCachedRoute(cacheKey);
    if (cached) {
      return {
        ...cached,
        source: "cache",
      };
    }
  }

  // Try Google Routes API
  const apiKey =
    process.env.GOOGLE_ROUTES_API_KEY ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  if (
    apiKey &&
    apiKey !== "YOUR_GOOGLE_MAPS_API_KEY_HERE" &&
    apiKey.length > 10
  ) {
    try {
      const result = await callGoogleRoutesApi(origin, destination, apiKey);

      // Cache the result
      await cacheRouteResult(cacheKey, result);

      return {
        ...result,
        source: "google",
      };
    } catch (error) {
      console.error(
        "Google Routes API error, falling back to Haversine:",
        error
      );
    }
  }

  // Fallback to Haversine calculation
  return calculateHaversineRoute(origin, destination);
}

/**
 * Calculate ETA based on current position, destination, and speed
 */
export async function calculateETA(
  currentPosition: Coordinates,
  destination: Coordinates,
  currentSpeedKmh?: number
): Promise<Date | null> {
  const route = await calculateRoadDistance(currentPosition, destination);

  if (route.durationSeconds > 0) {
    return new Date(Date.now() + route.durationSeconds * 1000);
  }

  // If no duration from API, calculate based on speed
  if (currentSpeedKmh && currentSpeedKmh > 0) {
    const hoursRemaining = route.distanceKm / currentSpeedKmh;
    return new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);
  }

  // Default average speed assumption (50 km/h for trucks)
  const avgSpeedKmh = 50;
  const hoursRemaining = route.distanceKm / avgSpeedKmh;
  return new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);
}

/**
 * Calculate DH-O (Deadhead Origin) - Distance from truck to pickup
 */
export async function calculateDeadheadOrigin(
  truckLocation: Coordinates,
  pickupLocation: Coordinates
): Promise<RouteResult> {
  return calculateRoadDistance(truckLocation, pickupLocation);
}

/**
 * Calculate DH-D (Deadhead Destination) - Distance from delivery to next destination
 */
export async function calculateDeadheadDestination(
  deliveryLocation: Coordinates,
  nextDestination: Coordinates
): Promise<RouteResult> {
  return calculateRoadDistance(deliveryLocation, nextDestination);
}

/**
 * Batch calculate distances for multiple origin-destination pairs
 */
export async function batchCalculateDistances(
  pairs: Array<{ origin: Coordinates; destination: Coordinates }>
): Promise<RouteResult[]> {
  // Process in parallel but limit concurrency
  const results: RouteResult[] = [];
  const batchSize = 5;

  for (let i = 0; i < pairs.length; i += batchSize) {
    const batch = pairs.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((pair) => calculateRoadDistance(pair.origin, pair.destination))
    );
    results.push(...batchResults);
  }

  return results;
}

// ============ Private Functions ============

/**
 * Call Google Routes API
 */
async function callGoogleRoutesApi(
  origin: Coordinates,
  destination: Coordinates,
  apiKey: string
): Promise<RouteResult> {
  // Using Google Directions API (simpler than Routes API)
  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${origin.lat},${origin.lng}`);
  url.searchParams.set("destination", `${destination.lat},${destination.lng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("key", apiKey);

  const response = await fetch(url.toString());

  if (!response.ok) {
    throw new Error(`Google API returned ${response.status}`);
  }

  const data = await response.json();

  if (data.status !== "OK" || !data.routes?.[0]?.legs?.[0]) {
    throw new Error(`Google API returned status: ${data.status}`);
  }

  const leg = data.routes[0].legs[0];
  const distanceMeters = leg.distance.value;
  const durationSeconds = leg.duration.value;

  return {
    distanceMeters,
    distanceKm: distanceMeters / 1000,
    durationSeconds,
    durationMinutes: Math.ceil(durationSeconds / 60),
    estimatedArrival: new Date(Date.now() + durationSeconds * 1000),
    source: "google",
  };
}

/**
 * Calculate route using Haversine formula (straight-line distance)
 */
function calculateHaversineRoute(
  origin: Coordinates,
  destination: Coordinates
): RouteResult {
  const distanceMeters = calculateDistance(
    origin.lat,
    origin.lng,
    destination.lat,
    destination.lng
  );

  const distanceKm = distanceMeters / 1000;

  // Estimate road distance as 1.3x straight-line distance (typical road factor)
  const roadDistanceKm = distanceKm * 1.3;

  // Assume average truck speed of 50 km/h
  const avgSpeedKmh = 50;
  const durationHours = roadDistanceKm / avgSpeedKmh;
  const durationSeconds = durationHours * 3600;

  return {
    distanceMeters: roadDistanceKm * 1000,
    distanceKm: roadDistanceKm,
    durationSeconds: Math.round(durationSeconds),
    durationMinutes: Math.ceil(durationSeconds / 60),
    estimatedArrival: new Date(Date.now() + durationSeconds * 1000),
    source: "haversine",
  };
}

/**
 * Generate cache key from coordinates
 */
function generateCacheKey(
  origin: Coordinates,
  destination: Coordinates
): string {
  // Round to 4 decimal places (~11m precision)
  const o = `${origin.lat.toFixed(4)},${origin.lng.toFixed(4)}`;
  const d = `${destination.lat.toFixed(4)},${destination.lng.toFixed(4)}`;
  return `route:${o}:${d}`;
}

/**
 * Get cached route from database
 */
async function getCachedRoute(cacheKey: string): Promise<RouteResult | null> {
  try {
    const cached = await db.routeCache.findUnique({
      where: { cacheKey },
    });

    if (!cached) return null;

    // Check if cache is still valid
    const age = Date.now() - cached.createdAt.getTime();
    if (age > CACHE_DURATION_MS) {
      // Cache expired, delete and return null
      await db.routeCache.delete({ where: { cacheKey } }).catch(() => {});
      return null;
    }

    return {
      distanceMeters: Number(cached.distanceMeters),
      distanceKm: Number(cached.distanceKm),
      durationSeconds: cached.durationSeconds,
      durationMinutes: Math.ceil(cached.durationSeconds / 60),
      estimatedArrival: new Date(Date.now() + cached.durationSeconds * 1000),
      source: "cache",
    };
  } catch {
    // Table might not exist yet, ignore error
    return null;
  }
}

/**
 * Cache route result in database
 */
async function cacheRouteResult(
  cacheKey: string,
  result: RouteResult
): Promise<void> {
  try {
    await db.routeCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        distanceMeters: result.distanceMeters,
        distanceKm: result.distanceKm,
        durationSeconds: result.durationSeconds,
      },
      update: {
        distanceMeters: result.distanceMeters,
        distanceKm: result.distanceKm,
        durationSeconds: result.durationSeconds,
      },
    });
  } catch {
    // Table might not exist yet, ignore error
    console.warn("Route cache table not available, skipping cache");
  }
}

export default {
  calculateRoadDistance,
  calculateETA,
  calculateDeadheadOrigin,
  calculateDeadheadDestination,
  batchCalculateDistances,
};

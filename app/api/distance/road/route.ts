/**
 * Road Distance Calculation API
 *
 * GET /api/distance/road - Calculate road distance between two points
 *
 * Query params:
 * - origin: Origin coordinates (lat,lng)
 * - destination: Destination coordinates (lat,lng)
 * - mode: Travel mode (driving, walking, bicycling, transit) - default: driving
 *
 * Returns road distance and estimated travel time using Google Routes API.
 * Falls back to Haversine (straight-line) if Google API fails.
 *
 * MAP + GPS Implementation - Phase 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';

// Cache TTL in milliseconds (24 hours)
const CACHE_TTL = 24 * 60 * 60 * 1000;

// In-memory cache for distance calculations
const distanceCache = new Map<string, { distance: number; duration: number; timestamp: number }>();

/**
 * Calculate Haversine (straight-line) distance
 * Used as fallback when Google API is unavailable
 */
function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
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
 * Generate cache key from coordinates
 */
function getCacheKey(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): string {
  // Round to 4 decimal places for caching (about 11m precision)
  const oLat = originLat.toFixed(4);
  const oLng = originLng.toFixed(4);
  const dLat = destLat.toFixed(4);
  const dLng = destLng.toFixed(4);
  return `${oLat},${oLng}-${dLat},${dLng}`;
}

/**
 * Fetch distance from Google Distance Matrix API
 */
async function getGoogleDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ distance: number; duration: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;

  if (!apiKey) {
    console.warn('GOOGLE_MAPS_API_KEY not configured');
    return null;
  }

  try {
    // Use Google Distance Matrix API
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${originLat},${originLng}`);
    url.searchParams.set('destinations', `${destLat},${destLng}`);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('Google Distance Matrix API error:', data.status, data.error_message);
      return null;
    }

    const element = data.rows?.[0]?.elements?.[0];
    if (element?.status !== 'OK') {
      console.error('Distance calculation failed:', element?.status);
      return null;
    }

    return {
      distance: element.distance.value / 1000, // Convert meters to km
      duration: element.duration.value / 60, // Convert seconds to minutes
    };
  } catch (error) {
    console.error('Google Distance API error:', error);
    return null;
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = request.nextUrl;
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const useCache = searchParams.get('cache') !== 'false';

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'origin and destination are required (format: lat,lng)' },
        { status: 400 }
      );
    }

    // Parse coordinates
    const [originLat, originLng] = origin.split(',').map(Number);
    const [destLat, destLng] = destination.split(',').map(Number);

    if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
      return NextResponse.json(
        { error: 'Invalid coordinates format. Use: lat,lng' },
        { status: 400 }
      );
    }

    // Validate coordinate ranges
    if (originLat < -90 || originLat > 90 || destLat < -90 || destLat > 90) {
      return NextResponse.json(
        { error: 'Latitude must be between -90 and 90' },
        { status: 400 }
      );
    }

    if (originLng < -180 || originLng > 180 || destLng < -180 || destLng > 180) {
      return NextResponse.json(
        { error: 'Longitude must be between -180 and 180' },
        { status: 400 }
      );
    }

    // Check cache
    const cacheKey = getCacheKey(originLat, originLng, destLat, destLng);
    if (useCache) {
      const cached = distanceCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json({
          distance: Math.round(cached.distance * 100) / 100,
          distanceKm: Math.round(cached.distance * 100) / 100,
          duration: Math.round(cached.duration),
          durationMinutes: Math.round(cached.duration),
          durationText: formatDuration(cached.duration),
          source: 'google',
          cached: true,
          origin: { lat: originLat, lng: originLng },
          destination: { lat: destLat, lng: destLng },
        });
      }
    }

    // Try Google API first
    const googleResult = await getGoogleDistance(originLat, originLng, destLat, destLng);

    if (googleResult) {
      // Cache the result
      distanceCache.set(cacheKey, {
        distance: googleResult.distance,
        duration: googleResult.duration,
        timestamp: Date.now(),
      });

      return NextResponse.json({
        distance: Math.round(googleResult.distance * 100) / 100,
        distanceKm: Math.round(googleResult.distance * 100) / 100,
        duration: Math.round(googleResult.duration),
        durationMinutes: Math.round(googleResult.duration),
        durationText: formatDuration(googleResult.duration),
        source: 'google',
        cached: false,
        origin: { lat: originLat, lng: originLng },
        destination: { lat: destLat, lng: destLng },
      });
    }

    // Fallback to Haversine
    const haversine = haversineDistance(originLat, originLng, destLat, destLng);
    // Estimate duration based on average speed of 50 km/h (accounting for stops, traffic)
    const estimatedDuration = (haversine / 50) * 60; // minutes
    // Road distance is typically 1.3x straight-line distance
    const estimatedRoadDistance = haversine * 1.3;

    return NextResponse.json({
      distance: Math.round(estimatedRoadDistance * 100) / 100,
      distanceKm: Math.round(estimatedRoadDistance * 100) / 100,
      straightLineDistance: Math.round(haversine * 100) / 100,
      duration: Math.round(estimatedDuration),
      durationMinutes: Math.round(estimatedDuration),
      durationText: formatDuration(estimatedDuration),
      source: 'estimate',
      cached: false,
      origin: { lat: originLat, lng: originLng },
      destination: { lat: destLat, lng: destLng },
      warning: 'Road distance estimated (Google API unavailable). Actual distance may vary.',
    });
  } catch (error) {
    console.error('Distance calculation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Format duration in human-readable format
 */
function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (mins === 0) {
    return `${hours} hr`;
  }

  return `${hours} hr ${mins} min`;
}

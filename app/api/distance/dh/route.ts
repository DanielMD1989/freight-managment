/**
 * Deadhead Distance Calculation API
 *
 * GET /api/distance/dh - Calculate DH-O (deadhead to origin) and DH-D (deadhead after delivery)
 *
 * Query params:
 * - truckId: Truck ID to calculate DH from
 * - loadId: Load ID to calculate DH to
 * - type: 'dho' (deadhead to origin) or 'dhd' (deadhead after delivery) or 'both'
 *
 * DH-O = Distance from truck's current location to load's pickup location
 * DH-D = Distance from load's delivery location to truck's preferred destination
 *
 * MAP + GPS Implementation - Phase 3
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// Cache for distance calculations
const distanceCache = new Map<string, { distance: number; duration: number; timestamp: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000;

/**
 * Calculate Haversine distance
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
 * Fetch distance from Google API
 */
async function getGoogleDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ distance: number; duration: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  const cacheKey = `${originLat.toFixed(4)},${originLng.toFixed(4)}-${destLat.toFixed(4)},${destLng.toFixed(4)}`;
  const cached = distanceCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return { distance: cached.distance, duration: cached.duration };
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${originLat},${originLng}`);
    url.searchParams.set('destinations', `${destLat},${destLng}`);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || data.rows?.[0]?.elements?.[0]?.status !== 'OK') {
      return null;
    }

    const element = data.rows[0].elements[0];
    const result = {
      distance: element.distance.value / 1000,
      duration: element.duration.value / 60,
    };

    distanceCache.set(cacheKey, { ...result, timestamp: Date.now() });
    return result;
  } catch {
    return null;
  }
}

/**
 * Calculate distance with fallback
 */
async function calculateDistance(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ distance: number; duration: number; source: string }> {
  const googleResult = await getGoogleDistance(originLat, originLng, destLat, destLng);

  if (googleResult) {
    return { ...googleResult, source: 'google' };
  }

  // Fallback to Haversine with road factor
  const straightLine = haversineDistance(originLat, originLng, destLat, destLng);
  return {
    distance: straightLine * 1.3,
    duration: (straightLine / 50) * 60,
    source: 'estimate',
  };
}

export async function GET(request: NextRequest) {
  try {
    await requireAuth();

    const { searchParams } = request.nextUrl;
    const truckId = searchParams.get('truckId');
    const loadId = searchParams.get('loadId');
    const type = searchParams.get('type') || 'both';

    if (!truckId || !loadId) {
      return NextResponse.json(
        { error: 'truckId and loadId are required' },
        { status: 400 }
      );
    }

    // Fetch truck with location
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: {
        id: true,
        licensePlate: true,
        currentLocationLat: true,
        currentLocationLon: true,
        currentCity: true,
        // Get truck's preferred destination from active posting
        postings: {
          where: { status: 'ACTIVE' },
          select: {
            destinationCity: {
              select: {
                latitude: true,
                longitude: true,
                name: true,
              },
            },
          },
          take: 1,
        },
      },
    });

    if (!truck) {
      return NextResponse.json({ error: 'Truck not found' }, { status: 404 });
    }

    // Fetch load with locations
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
                pickupCity: true,
        originLat: true,
        originLon: true,
        deliveryCity: true,
        destinationLat: true,
        destinationLon: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    const result: any = {
      truckId: truck.id,
      truckPlate: truck.licensePlate,
      loadId: load.id,
      loadRef: load.id,
    };

    // Calculate DH-O (truck current location → load pickup)
    if (type === 'dho' || type === 'both') {
      if (truck.currentLocationLat && truck.currentLocationLon && load.originLat && load.originLon) {
        const dhoResult = await calculateDistance(
          Number(truck.currentLocationLat),
          Number(truck.currentLocationLon),
          Number(load.originLat),
          Number(load.originLon)
        );

        result.dhO = {
          distanceKm: Math.round(dhoResult.distance * 100) / 100,
          durationMinutes: Math.round(dhoResult.duration),
          source: dhoResult.source,
          from: {
            lat: Number(truck.currentLocationLat),
            lng: Number(truck.currentLocationLon),
            city: truck.currentCity,
          },
          to: {
            lat: Number(load.originLat),
            lng: Number(load.originLon),
            city: load.pickupCity,
          },
        };
      } else {
        result.dhO = {
          error: 'Missing location data',
          truckHasLocation: !!(truck.currentLocationLat && truck.currentLocationLon),
          loadHasPickupLocation: !!(load.originLat && load.originLon),
        };
      }
    }

    // Calculate DH-D (load delivery → truck preferred destination)
    if (type === 'dhd' || type === 'both') {
      const truckDestination = truck.postings?.[0]?.destinationCity;

      if (load.destinationLat && load.destinationLon && truckDestination?.latitude && truckDestination?.longitude) {
        const dhdResult = await calculateDistance(
          Number(load.destinationLat),
          Number(load.destinationLon),
          Number(truckDestination.latitude),
          Number(truckDestination.longitude)
        );

        result.dhD = {
          distanceKm: Math.round(dhdResult.distance * 100) / 100,
          durationMinutes: Math.round(dhdResult.duration),
          source: dhdResult.source,
          from: {
            lat: Number(load.destinationLat),
            lng: Number(load.destinationLon),
            city: load.deliveryCity,
          },
          to: {
            lat: Number(truckDestination.latitude),
            lng: Number(truckDestination.longitude),
            city: truckDestination.name,
          },
        };
      } else {
        result.dhD = {
          error: 'Missing location data',
          loadHasDeliveryLocation: !!(load.destinationLat && load.destinationLon),
          truckHasPreferredDestination: !!(truckDestination?.latitude && truckDestination?.longitude),
        };
      }
    }

    // Calculate total deadhead
    if (result.dhO?.distanceKm && result.dhD?.distanceKm) {
      result.totalDeadhead = {
        distanceKm: Math.round((result.dhO.distanceKm + result.dhD.distanceKm) * 100) / 100,
        durationMinutes: result.dhO.durationMinutes + result.dhD.durationMinutes,
      };
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('DH calculation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

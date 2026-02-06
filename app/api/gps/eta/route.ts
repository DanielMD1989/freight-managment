/**
 * ETA Calculation API
 *
 * GET /api/gps/eta - Calculate estimated time of arrival for a trip
 *
 * Query params:
 * - loadId: Load/trip ID to calculate ETA for
 *
 * Uses:
 * - Current truck position
 * - Delivery location
 * - Google Routes API for driving time
 * - Fallback to distance-based estimate
 *
 * MAP + GPS Implementation - Phase 4
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calculateDistanceKm } from '@/lib/geo';

// Cache for ETA calculations (5 minute TTL)
const etaCache = new Map<string, { eta: Date; distanceKm: number; durationMinutes: number; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// Use centralized haversine from lib/geo.ts
const haversineDistance = calculateDistanceKm;

/**
 * Get driving ETA from Google Routes API
 */
async function getGoogleETA(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ distanceKm: number; durationMinutes: number } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', `${originLat},${originLng}`);
    url.searchParams.set('destinations', `${destLat},${destLng}`);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('departure_time', 'now');
    url.searchParams.set('traffic_model', 'best_guess');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('key', apiKey);

    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK' || data.rows?.[0]?.elements?.[0]?.status !== 'OK') {
      return null;
    }

    const element = data.rows[0].elements[0];

    // Use duration_in_traffic if available, otherwise use duration
    const durationSeconds = element.duration_in_traffic?.value || element.duration.value;

    return {
      distanceKm: element.distance.value / 1000,
      durationMinutes: durationSeconds / 60,
    };
  } catch (error) {
    console.error('Google ETA calculation error:', error);
    return null;
  }
}

/**
 * Calculate ETA with fallback
 */
async function calculateETA(
  originLat: number,
  originLng: number,
  destLat: number,
  destLng: number
): Promise<{ eta: Date; distanceKm: number; durationMinutes: number; source: string }> {
  // Try Google first
  const googleResult = await getGoogleETA(originLat, originLng, destLat, destLng);

  if (googleResult) {
    const eta = new Date(Date.now() + googleResult.durationMinutes * 60 * 1000);
    return {
      eta,
      distanceKm: googleResult.distanceKm,
      durationMinutes: googleResult.durationMinutes,
      source: 'google',
    };
  }

  // Fallback to Haversine estimate
  const straightLine = haversineDistance(originLat, originLng, destLat, destLng);
  const estimatedRoadDistance = straightLine * 1.3; // Road factor
  const averageSpeedKmh = 50; // Average truck speed in Ethiopia
  const estimatedDuration = (estimatedRoadDistance / averageSpeedKmh) * 60; // in minutes
  const eta = new Date(Date.now() + estimatedDuration * 60 * 1000);

  return {
    eta,
    distanceKm: estimatedRoadDistance,
    durationMinutes: estimatedDuration,
    source: 'estimate',
  };
}

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;
    const loadId = searchParams.get('loadId');

    if (!loadId) {
      return NextResponse.json(
        { error: 'loadId is required' },
        { status: 400 }
      );
    }

    // Get user's organization for access control
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    // Fetch load with truck and locations
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        deliveryCity: true,
        destinationLat: true,
        destinationLon: true,
        pickupCity: true,
        assignedTruck: {
          select: {
            id: true,
            licensePlate: true,
            currentLocationLat: true,
            currentLocationLon: true,
            locationUpdatedAt: true,
            gpsStatus: true,
            carrierId: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Access control
    if (session.role === 'CARRIER') {
      if (load.assignedTruck?.carrierId !== user?.organizationId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    } else if (session.role === 'SHIPPER') {
      if (load.shipperId !== user?.organizationId) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
    }

    // Check if trip is in transit
    if (load.status !== 'IN_TRANSIT') {
      return NextResponse.json({
        loadId: load.id,
        status: load.status,
        eta: null,
        message: 'ETA is only available for trips IN_TRANSIT',
      });
    }

    // Check if truck has GPS position
    const truck = load.assignedTruck;
    if (!truck || !truck.currentLocationLat || !truck.currentLocationLon) {
      return NextResponse.json({
        loadId: load.id,
        status: load.status,
        eta: null,
        message: 'No GPS position available for this truck',
      });
    }

    // Check if delivery location is available
    if (!load.destinationLat || !load.destinationLon) {
      return NextResponse.json({
        loadId: load.id,
        status: load.status,
        eta: null,
        message: 'Delivery location not available',
      });
    }

    // Check cache
    const cacheKey = `${loadId}-${truck.currentLocationLat.toFixed(3)}-${truck.currentLocationLon.toFixed(3)}`;
    const cached = etaCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        loadId: load.id,
        status: load.status,
        truck: {
          id: truck.id,
          plateNumber: truck.licensePlate,
          currentPosition: {
            lat: Number(truck.currentLocationLat),
            lng: Number(truck.currentLocationLon),
            updatedAt: truck.locationUpdatedAt?.toISOString(),
          },
        },
        destination: {
          city: load.deliveryCity,
          lat: Number(load.destinationLat),
          lng: Number(load.destinationLon),
        },
        eta: {
          arrivalTime: cached.eta.toISOString(),
          remainingDistanceKm: Math.round(cached.distanceKm * 10) / 10,
          remainingDurationMinutes: Math.round(cached.durationMinutes),
          source: 'cached',
        },
        calculatedAt: new Date(cached.timestamp).toISOString(),
      });
    }

    // Calculate ETA
    const etaResult = await calculateETA(
      Number(truck.currentLocationLat),
      Number(truck.currentLocationLon),
      Number(load.destinationLat),
      Number(load.destinationLon)
    );

    // Cache result
    etaCache.set(cacheKey, {
      eta: etaResult.eta,
      distanceKm: etaResult.distanceKm,
      durationMinutes: etaResult.durationMinutes,
      timestamp: Date.now(),
    });

    return NextResponse.json({
      loadId: load.id,
      status: load.status,
      truck: {
        id: truck.id,
        plateNumber: truck.licensePlate,
        currentPosition: {
          lat: Number(truck.currentLocationLat),
          lng: Number(truck.currentLocationLon),
          updatedAt: truck.locationUpdatedAt?.toISOString(),
        },
      },
      destination: {
        city: load.deliveryCity,
        lat: Number(load.destinationLat),
        lng: Number(load.destinationLon),
      },
      eta: {
        arrivalTime: etaResult.eta.toISOString(),
        remainingDistanceKm: Math.round(etaResult.distanceKm * 10) / 10,
        remainingDurationMinutes: Math.round(etaResult.durationMinutes),
        source: etaResult.source,
      },
      calculatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('ETA calculation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

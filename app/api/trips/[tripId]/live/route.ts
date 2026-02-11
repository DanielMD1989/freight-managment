/**
 * Trip Live Position API
 *
 * GET /api/trips/[tripId]/live - Get live position
 *
 * This endpoint returns the current live position of a trip.
 * Used for real-time tracking on the map.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calculateDistanceKm } from '@/lib/geo';

/**
 * GET /api/trips/[tripId]/live
 *
 * Get current live position for a trip
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await requireAuth();
    const { tripId } = await params;

    // Get trip with current location
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        status: true,
        trackingEnabled: true,
        currentLat: true,
        currentLng: true,
        currentLocationUpdatedAt: true,
        pickupLat: true,
        pickupLng: true,
        pickupCity: true,
        pickupAddress: true,
        deliveryLat: true,
        deliveryLng: true,
        deliveryCity: true,
        deliveryAddress: true,
        estimatedDistanceKm: true,
        actualDistanceKm: true,
        startedAt: true,
        pickedUpAt: true,
        deliveredAt: true,
        carrierId: true,
        shipperId: true,
        truck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
            gpsStatus: true,
            gpsLastSeenAt: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';
    const isDispatcher = session.role === 'DISPATCHER';
    const isCarrier = session.role === 'CARRIER' && trip.carrierId === session.organizationId;
    const isShipper = session.role === 'SHIPPER' && trip.shipperId === session.organizationId;

    if (!isAdmin && !isDispatcher && !isCarrier && !isShipper) {
      return NextResponse.json(
        { error: 'You do not have permission to view this trip' },
        { status: 403 }
      );
    }

    // For shippers, only allow access when trip is IN_TRANSIT (per spec)
    if (isShipper && trip.status !== 'IN_TRANSIT' && trip.status !== 'DELIVERED' && trip.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Live tracking is only available when the trip is in transit' },
        { status: 403 }
      );
    }

    // Get the latest GPS position
    const latestPosition = await db.gpsPosition.findFirst({
      where: { tripId },
      orderBy: { timestamp: 'desc' },
      select: {
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        timestamp: true,
      },
    });

    // Calculate ETA if possible
    let etaMinutes: number | null = null;
    if (
      trip.status === 'IN_TRANSIT' &&
      trip.currentLat &&
      trip.currentLng &&
      trip.deliveryLat &&
      trip.deliveryLng
    ) {
      // Simple estimate: assume average speed of 50 km/h (delegated to lib/geo.ts)
      const remainingDistanceKm = calculateDistanceKm(
        Number(trip.currentLat),
        Number(trip.currentLng),
        Number(trip.deliveryLat),
        Number(trip.deliveryLng)
      );
      // Use actual speed if available, otherwise assume 50 km/h
      const avgSpeedKmh = latestPosition?.speed ? Number(latestPosition.speed) : 50;
      etaMinutes = Math.round((remainingDistanceKm / avgSpeedKmh) * 60);
    }

    // Determine GPS signal status
    let gpsStatus: 'active' | 'stale' | 'offline' = 'offline';
    if (trip.currentLocationUpdatedAt) {
      const lastUpdateMs = Date.now() - trip.currentLocationUpdatedAt.getTime();
      if (lastUpdateMs < 5 * 60 * 1000) {
        // Less than 5 minutes
        gpsStatus = 'active';
      } else if (lastUpdateMs < 30 * 60 * 1000) {
        // Less than 30 minutes
        gpsStatus = 'stale';
      }
    }

    return NextResponse.json({
      tripId: trip.id,
      status: trip.status,
      trackingEnabled: trip.trackingEnabled,
      gpsStatus,
      currentLocation: trip.currentLat && trip.currentLng ? {
        latitude: Number(trip.currentLat),
        longitude: Number(trip.currentLng),
        speed: latestPosition?.speed ? Number(latestPosition.speed) : null,
        heading: latestPosition?.heading ? Number(latestPosition.heading) : null,
        updatedAt: trip.currentLocationUpdatedAt?.toISOString() || null,
      } : null,
      pickup: {
        latitude: trip.pickupLat ? Number(trip.pickupLat) : null,
        longitude: trip.pickupLng ? Number(trip.pickupLng) : null,
        city: trip.pickupCity,
        address: trip.pickupAddress,
      },
      delivery: {
        latitude: trip.deliveryLat ? Number(trip.deliveryLat) : null,
        longitude: trip.deliveryLng ? Number(trip.deliveryLng) : null,
        city: trip.deliveryCity,
        address: trip.deliveryAddress,
      },
      distance: {
        estimated: trip.estimatedDistanceKm ? Number(trip.estimatedDistanceKm) : null,
        actual: trip.actualDistanceKm ? Number(trip.actualDistanceKm) : null,
      },
      timing: {
        startedAt: trip.startedAt?.toISOString() || null,
        pickedUpAt: trip.pickedUpAt?.toISOString() || null,
        deliveredAt: trip.deliveredAt?.toISOString() || null,
        etaMinutes,
      },
      truck: {
        id: trip.truck.id,
        licensePlate: trip.truck.licensePlate,
        type: trip.truck.truckType,
      },
      carrier: {
        id: trip.carrier.id,
        name: trip.carrier.name,
      },
    });
  } catch (error) {
    console.error('Get live position error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch live position' },
      { status: 500 }
    );
  }
}


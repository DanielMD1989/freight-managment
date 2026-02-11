/**
 * Trip History API - Route History Playback
 *
 * GET /api/trips/[tripId]/history - Get route history for playback
 *
 * Used for historical trip playback on the map.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { calculateDistanceKm } from '@/lib/geo';
import { roundToDecimals, roundDistance1 } from '@/lib/rounding';

/**
 * GET /api/trips/[tripId]/history
 *
 * Get route history for a trip (for playback)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await requireAuth();
    const { tripId } = await params;
    const { searchParams } = new URL(request.url);

    const startTime = searchParams.get('start'); // ISO timestamp
    const endTime = searchParams.get('end'); // ISO timestamp
    const resolution = searchParams.get('resolution') || 'full'; // 'full' | 'simplified'

    // Get trip
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            pickupDate: true,
            deliveryDate: true,
            cargoDescription: true,
          },
        },
        truck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
          },
        },
        shipper: {
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
        { error: 'You do not have permission to view this trip history' },
        { status: 403 }
      );
    }

    // Build query for GPS positions
    const whereClause: any = { tripId };

    if (startTime) {
      whereClause.timestamp = { ...whereClause.timestamp, gte: new Date(startTime) };
    }
    if (endTime) {
      whereClause.timestamp = { ...whereClause.timestamp, lte: new Date(endTime) };
    }

    // Get all GPS positions for the trip
    const positions = await db.gpsPosition.findMany({
      where: whereClause,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        altitude: true,
        timestamp: true,
      },
      orderBy: { timestamp: 'asc' },
    });

    // Calculate total distance traveled (delegated to lib/geo.ts)
    let totalDistanceKm = 0;
    if (positions.length > 1) {
      for (let i = 1; i < positions.length; i++) {
        totalDistanceKm += calculateDistanceKm(
          Number(positions[i - 1].latitude),
          Number(positions[i - 1].longitude),
          Number(positions[i].latitude),
          Number(positions[i].longitude)
        );
      }
    }

    // Simplify route if requested (reduce number of points)
    let route = positions.map(p => ({
      id: p.id,
      latitude: Number(p.latitude),
      longitude: Number(p.longitude),
      speed: p.speed ? Number(p.speed) : null,
      heading: p.heading ? Number(p.heading) : null,
      altitude: p.altitude ? Number(p.altitude) : null,
      timestamp: p.timestamp.toISOString(),
    }));

    if (resolution === 'simplified' && route.length > 100) {
      // Reduce to ~100 points using Douglas-Peucker or simple sampling
      route = simplifyRoute(route, 100);
    }

    // Calculate average speed
    let avgSpeedKmh: number | null = null;
    if (positions.length > 0) {
      const speeds = positions.filter(p => p.speed !== null).map(p => Number(p.speed));
      if (speeds.length > 0) {
        avgSpeedKmh = speeds.reduce((a, b) => a + b, 0) / speeds.length;
      }
    }

    // Calculate trip duration
    let durationMinutes: number | null = null;
    if (trip.startedAt && (trip.completedAt || trip.deliveredAt)) {
      const endDate = trip.completedAt || trip.deliveredAt;
      durationMinutes = Math.round((endDate!.getTime() - trip.startedAt.getTime()) / (1000 * 60));
    }

    return NextResponse.json({
      tripId: trip.id,
      status: trip.status,
      load: trip.load,
      truck: trip.truck,
      carrier: trip.carrier,
      shipper: trip.shipper,
      origin: {
        latitude: trip.pickupLat ? Number(trip.pickupLat) : null,
        longitude: trip.pickupLng ? Number(trip.pickupLng) : null,
        city: trip.pickupCity,
        address: trip.pickupAddress,
      },
      destination: {
        latitude: trip.deliveryLat ? Number(trip.deliveryLat) : null,
        longitude: trip.deliveryLng ? Number(trip.deliveryLng) : null,
        city: trip.deliveryCity,
        address: trip.deliveryAddress,
      },
      timing: {
        createdAt: trip.createdAt.toISOString(),
        startedAt: trip.startedAt?.toISOString() || null,
        pickedUpAt: trip.pickedUpAt?.toISOString() || null,
        deliveredAt: trip.deliveredAt?.toISOString() || null,
        completedAt: trip.completedAt?.toISOString() || null,
        durationMinutes,
      },
      // Rounding delegated to lib/rounding.ts
      distance: {
        estimatedKm: trip.estimatedDistanceKm ? Number(trip.estimatedDistanceKm) : null,
        actualKm: roundToDecimals(totalDistanceKm, 2),
      },
      stats: {
        positionCount: positions.length,
        avgSpeedKmh: avgSpeedKmh ? roundDistance1(avgSpeedKmh) : null,
      },
      route,
      // Also include 'positions' for mobile app compatibility
      positions: route,
    });
  } catch (error) {
    console.error('Get trip history error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trip history' },
      { status: 500 }
    );
  }
}

// Simple route simplification by sampling
function simplifyRoute(
  route: Array<{ id: string; latitude: number; longitude: number; speed: number | null; heading: number | null; altitude: number | null; timestamp: string }>,
  targetPoints: number
): typeof route {
  if (route.length <= targetPoints) return route;

  const step = route.length / targetPoints;
  const simplified: typeof route = [];

  for (let i = 0; i < targetPoints; i++) {
    const index = Math.floor(i * step);
    simplified.push(route[index]);
  }

  // Always include the last point
  if (simplified[simplified.length - 1] !== route[route.length - 1]) {
    simplified.push(route[route.length - 1]);
  }

  return simplified;
}

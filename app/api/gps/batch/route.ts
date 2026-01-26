/**
 * GPS Batch Update API
 *
 * POST /api/gps/batch - Submit multiple GPS positions at once
 *
 * This is useful for:
 * - Mobile apps that queue updates while offline
 * - GPS devices that batch updates
 * - Reducing API calls for frequent position updates
 *
 * MAP + GPS Implementation - Phase 2
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { broadcastGpsPosition } from '@/lib/websocket-server';
import { z } from 'zod';
import { withRpsLimit, RPS_CONFIGS } from '@/lib/rateLimit';

const positionSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  altitude: z.number().optional(),
  accuracy: z.number().min(0).optional(),
  timestamp: z.string().datetime(),
});

const batchUpdateSchema = z.object({
  truckId: z.string().min(1),
  positions: z.array(positionSchema).min(1).max(100), // Max 100 positions per batch
});

async function postHandler(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only carriers can update GPS positions
    if (session.role !== 'CARRIER') {
      return NextResponse.json(
        { error: 'Only carriers can update GPS positions' },
        { status: 403 }
      );
    }

    // Get user's organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'User does not belong to an organization' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const data = batchUpdateSchema.parse(body);

    // Verify truck belongs to carrier's organization
    const truck = await db.truck.findFirst({
      where: {
        id: data.truckId,
        carrierId: user.organizationId,
      },
      select: {
        id: true,
        licensePlate: true,
        gpsDeviceId: true,
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found or does not belong to your organization' },
        { status: 404 }
      );
    }

    if (!truck.gpsDeviceId) {
      return NextResponse.json(
        { error: 'Truck does not have a GPS device registered' },
        { status: 400 }
      );
    }

    // Find active load (trip) for this truck
    const activeLoad = await db.load.findFirst({
      where: {
        assignedTruckId: data.truckId,
        status: 'IN_TRANSIT',
      },
      select: { id: true },
    });

    // Sort positions by timestamp (oldest first)
    const sortedPositions = [...data.positions].sort(
      (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Create GPS position records
    const createData = sortedPositions.map((pos) => ({
      truckId: data.truckId,
      deviceId: truck.gpsDeviceId!,
      latitude: pos.latitude,
      longitude: pos.longitude,
      speed: pos.speed,
      heading: pos.heading,
      altitude: pos.altitude,
      accuracy: pos.accuracy,
      timestamp: new Date(pos.timestamp),
      loadId: activeLoad?.id || null,
    }));

    await db.gpsPosition.createMany({
      data: createData,
    });

    // Update truck's current location with the most recent position
    const latestPosition = sortedPositions[sortedPositions.length - 1];
    await db.truck.update({
      where: { id: data.truckId },
      data: {
        currentLocationLat: latestPosition.latitude,
        currentLocationLon: latestPosition.longitude,
        locationUpdatedAt: new Date(latestPosition.timestamp),
        gpsLastSeenAt: new Date(),
        gpsStatus: 'ACTIVE',
      },
    });

    // Broadcast the latest position via WebSocket
    await broadcastGpsPosition(
      data.truckId,
      activeLoad?.id || null,
      user.organizationId,
      {
        truckId: data.truckId,
        loadId: activeLoad?.id,
        lat: latestPosition.latitude,
        lng: latestPosition.longitude,
        speed: latestPosition.speed,
        heading: latestPosition.heading,
        timestamp: latestPosition.timestamp,
      }
    );

    return NextResponse.json({
      success: true,
      message: `${data.positions.length} GPS positions recorded`,
      truckId: data.truckId,
      loadId: activeLoad?.id || null,
      positionsRecorded: data.positions.length,
      latestPosition: {
        lat: latestPosition.latitude,
        lng: latestPosition.longitude,
        timestamp: latestPosition.timestamp,
      },
    });
  } catch (error) {
    console.error('GPS batch update error:', error);

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

// Apply RPS rate limiting (100 RPS with 20 burst)
export const POST = withRpsLimit(RPS_CONFIGS.gps, postHandler);

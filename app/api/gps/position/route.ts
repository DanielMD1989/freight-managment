/**
 * GPS Position Update API
 *
 * POST /api/gps/position - Update truck GPS position (Carrier only)
 *
 * GPS Rules:
 * - Only carriers can update GPS positions
 * - Truck must belong to carrier's organization
 * - If truck is on an active trip (IN_TRANSIT), position is linked to load
 *
 * MAP + GPS Implementation - Phase 2
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { broadcastGpsPosition } from '@/lib/websocket-server';
import { withRpsLimit, RPS_CONFIGS } from '@/lib/rateLimit';
import { zodErrorResponse } from '@/lib/validation';

const gpsUpdateSchema = z.object({
  truckId: z.string().min(1),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  altitude: z.number().optional(),
  accuracy: z.number().min(0).optional(),
  timestamp: z.string().datetime().optional(),
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
    const data = gpsUpdateSchema.parse(body);

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
        gpsDevice: {
          select: { id: true },
        },
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found or does not belong to your organization' },
        { status: 404 }
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

    // HIGH FIX #2: Wrap truck update + GPS position in transaction for atomicity
    const positionRecord = await db.$transaction(async (tx) => {
      // Update truck's current location
      await tx.truck.update({
        where: { id: data.truckId },
        data: {
          currentLocationLat: data.latitude,
          currentLocationLon: data.longitude,
          locationUpdatedAt: new Date(),
          gpsLastSeenAt: new Date(),
          gpsStatus: 'ACTIVE',
        },
      });

      // Create GPS position record if device exists
      if (truck.gpsDeviceId) {
        return await tx.gpsPosition.create({
          data: {
            truckId: data.truckId,
            deviceId: truck.gpsDeviceId,
            latitude: data.latitude,
            longitude: data.longitude,
            speed: data.speed,
            heading: data.heading,
            altitude: data.altitude,
            accuracy: data.accuracy,
            timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
            loadId: activeLoad?.id || null,
          },
          select: { id: true },
        });
      }

      return null;
    });

    // Broadcast GPS position update via WebSocket (Phase 3)
    try {
      await broadcastGpsPosition(
        data.truckId,
        activeLoad?.id || null,
        user.organizationId,
        {
          truckId: data.truckId,
          loadId: activeLoad?.id,
          lat: data.latitude,
          lng: data.longitude,
          speed: data.speed,
          heading: data.heading,
          timestamp: data.timestamp || new Date().toISOString(),
        }
      );
    } catch (broadcastError) {
      // Don't fail the request if broadcast fails
      console.error('GPS broadcast error:', broadcastError);
    }

    return NextResponse.json({
      success: true,
      message: 'GPS position updated',
      truckId: data.truckId,
      loadId: activeLoad?.id || null,
      position: {
        lat: data.latitude,
        lng: data.longitude,
        timestamp: data.timestamp || new Date().toISOString(),
      },
      positionId: positionRecord?.id,
    });
  } catch (error) {
    console.error('GPS position update error:', error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    // Handle specific error types
    if (error instanceof Error) {
      if (error.message === 'Unauthorized' || error.name === 'UnauthorizedError') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      if (error.name === 'ForbiddenError') {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Apply RPS rate limiting (100 RPS with 20 burst)
export const POST = withRpsLimit(RPS_CONFIGS.gps, postHandler);

/**
 * GET /api/gps/position - Get current position for a truck
 *
 * Query params:
 * - truckId: Truck ID to get position for
 */
async function getHandler(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;
    const truckId = searchParams.get('truckId');

    if (!truckId) {
      return NextResponse.json(
        { error: 'truckId is required' },
        { status: 400 }
      );
    }

    // Get user's organization for access control
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    // Build where clause based on role
    const truckWhere: any = { id: truckId };

    if (session.role === 'CARRIER') {
      if (!user?.organizationId) {
        return NextResponse.json(
          { error: 'User not associated with an organization' },
          { status: 403 }
        );
      }
      // Carrier can only see their own trucks
      truckWhere.carrierId = user.organizationId;
    } else if (session.role === 'SHIPPER') {
      if (!user?.organizationId) {
        return NextResponse.json(
          { error: 'User not associated with an organization' },
          { status: 403 }
        );
      }
      // Shipper can only see truck if it's on their load
      const activeLoad = await db.load.findFirst({
        where: {
          assignedTruckId: truckId,
          shipperId: user.organizationId,
          status: 'IN_TRANSIT',
        },
      });

      if (!activeLoad) {
        return NextResponse.json(
          { error: 'You do not have access to this truck\'s position' },
          { status: 403 }
        );
      }
    }
    // Admin/Dispatcher can see any truck

    const truck = await db.truck.findFirst({
      where: truckWhere,
      select: {
        id: true,
        licensePlate: true,
        truckType: true,
        currentLocationLat: true,
        currentLocationLon: true,
        locationUpdatedAt: true,
        gpsStatus: true,
        gpsLastSeenAt: true,
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found or access denied' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      truckId: truck.id,
      plateNumber: truck.licensePlate,
      truckType: truck.truckType,
      currentLocation: truck.currentLocationLat && truck.currentLocationLon ? {
        lat: Number(truck.currentLocationLat),
        lng: Number(truck.currentLocationLon),
        updatedAt: truck.locationUpdatedAt?.toISOString(),
      } : null,
      gpsStatus: truck.gpsStatus || 'INACTIVE',
      lastSeen: truck.gpsLastSeenAt?.toISOString(),
    });
  } catch (error) {
    console.error('GPS position get error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// Apply RPS rate limiting (100 RPS with 20 burst)
export const GET = withRpsLimit(RPS_CONFIGS.gps, getHandler);

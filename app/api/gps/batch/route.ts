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

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { broadcastGpsPosition } from "@/lib/websocket-server";
import { z } from "zod";
import { withRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { zodErrorResponse } from "@/lib/validation";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";

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
    // Fix 12: CSRF protection for web clients
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Fix 13: requireActiveUser for ACTIVE status check
    const session = await requireActiveUser();

    // Only carriers can update GPS positions
    if (session.role !== "CARRIER") {
      return NextResponse.json(
        { error: "Only carriers can update GPS positions" },
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
        { error: "User does not belong to an organization" },
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
        { error: "Truck not found or does not belong to your organization" },
        { status: 404 }
      );
    }

    if (!truck.gpsDeviceId) {
      return NextResponse.json(
        { error: "Truck does not have a GPS device registered" },
        { status: 400 }
      );
    }

    // Find active load (trip) for this truck (include DELIVERED for final-mile GPS linkage)
    const activeLoad = await db.load.findFirst({
      where: {
        assignedTruckId: data.truckId,
        status: { in: ["IN_TRANSIT", "DELIVERED"] },
      },
      select: { id: true },
    });

    // G-M21-2: Find active trip for tripId linkage (batch GPS was missing tripId)
    const activeTrip = await db.trip.findFirst({
      where: {
        truckId: data.truckId,
        status: { in: ["PICKUP_PENDING", "IN_TRANSIT", "DELIVERED"] },
      },
      select: { id: true },
    });

    // Sort positions by timestamp (oldest first)
    const sortedPositions = [...data.positions].sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
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
      tripId: activeTrip?.id || null,
    }));

    // HIGH FIX #1: Wrap GPS batch + truck update in transaction for atomicity
    const latestPosition = sortedPositions[sortedPositions.length - 1];
    await db.$transaction(async (tx) => {
      await tx.gpsPosition.createMany({
        data: createData,
      });

      // Update truck's current location with the most recent position
      await tx.truck.update({
        where: { id: data.truckId },
        data: {
          currentLocationLat: latestPosition.latitude,
          currentLocationLon: latestPosition.longitude,
          locationUpdatedAt: new Date(latestPosition.timestamp),
          gpsLastSeenAt: new Date(),
          gpsStatus: "ACTIVE",
        },
      });
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
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }
    return handleApiError(error, "GPS batch update error");
  }
}

// Apply RPS rate limiting (100 RPS with 20 burst)
export const POST = withRpsLimit(RPS_CONFIGS.gps, postHandler);

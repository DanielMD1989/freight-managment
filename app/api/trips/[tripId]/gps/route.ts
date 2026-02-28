/**
 * Trip GPS API - Update GPS Position
 *
 * POST /api/trips/[tripId]/gps - Update GPS position (Carrier only)
 *
 * GPS Rules (from MAP_GPS_USER_STORIES.md):
 * - GPS updates come ONLY from carrier side (driver/truck)
 * - GPS is ACTIVE when: Trip status = IN_TRANSIT
 * - GPS STOPS when: Trip status = COMPLETED
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import {
  checkRateLimit,
  withRpsLimit,
  RATE_LIMIT_GPS_UPDATE,
  RPS_CONFIGS,
} from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";

const gpsUpdateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  speed: z.number().min(0).optional(),
  heading: z.number().min(0).max(360).optional(),
  altitude: z.number().optional(),
  accuracy: z.number().min(0).optional(),
  timestamp: z.string().datetime().optional(),
});

/**
 * POST /api/trips/[tripId]/gps
 *
 * Update GPS position for a trip (Carrier only)
 */
async function postHandler(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await requireAuth();
    const { tripId } = await params;

    // PHASE 4: Enforce GPS rate limiting to prevent DoS
    // Rate limit by tripId - 12 requests per hour per trip
    const rateLimitResult = await checkRateLimit(
      { ...RATE_LIMIT_GPS_UPDATE, keyGenerator: () => `trip:${tripId}` },
      tripId
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error:
            "GPS update rate limit exceeded. Maximum 12 updates per hour per trip.",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(
              rateLimitResult.resetTime
            ).toISOString(),
            "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
          },
        }
      );
    }

    const body = await request.json();
    const validatedData = gpsUpdateSchema.parse(body);

    // Validate GPS timestamp is within 5 minutes of server time
    if (validatedData.timestamp) {
      const submitted = new Date(validatedData.timestamp);
      const now = new Date();
      const drift = Math.abs(now.getTime() - submitted.getTime());
      if (drift > 5 * 60 * 1000) {
        return NextResponse.json(
          { error: "GPS timestamp must be within 5 minutes of current time" },
          { status: 400 }
        );
      }
    }

    // Get trip with truck info
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        truck: {
          select: {
            id: true,
            gpsDeviceId: true,
            carrierId: true,
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // GPS writes are restricted to carrier only (from spec)
    const isCarrier =
      session.role === "CARRIER" && trip.carrierId === session.organizationId;
    if (!isCarrier) {
      return NextResponse.json(
        { error: "Only the carrier can update GPS position" },
        { status: 403 }
      );
    }

    // Check if GPS tracking is enabled for this trip
    if (!trip.trackingEnabled) {
      return NextResponse.json(
        { error: "GPS tracking is not enabled for this trip" },
        { status: 400 }
      );
    }

    // GPS is only active when trip is IN_TRANSIT (per spec)
    if (trip.status !== "IN_TRANSIT" && trip.status !== "PICKUP_PENDING") {
      return NextResponse.json(
        {
          error: `GPS updates are only accepted when trip is IN_TRANSIT or PICKUP_PENDING. Current status: ${trip.status}`,
        },
        { status: 400 }
      );
    }

    const now = validatedData.timestamp
      ? new Date(validatedData.timestamp)
      : new Date();

    // TD-002 FIX: Wrap all GPS updates in a transaction for atomicity
    const gpsPosition = await db.$transaction(async (tx) => {
      // Get or create GPS device ID (use truck's GPS device or create placeholder)
      let deviceId = trip.truck.gpsDeviceId;
      if (!deviceId) {
        // Create a placeholder GPS device for this truck
        const device = await tx.gpsDevice.create({
          data: {
            imei: `TRUCK-${trip.truck.id}`,
            status: "ACTIVE",
            lastSeenAt: now,
          },
        });
        deviceId = device.id;

        // Link device to truck
        await tx.truck.update({
          where: { id: trip.truck.id },
          data: { gpsDeviceId: device.id },
        });
      }

      // Create GPS position record linked to trip
      const position = await tx.gpsPosition.create({
        data: {
          truckId: trip.truckId,
          tripId: tripId,
          loadId: trip.loadId,
          deviceId: deviceId,
          latitude: new Prisma.Decimal(validatedData.latitude),
          longitude: new Prisma.Decimal(validatedData.longitude),
          speed: validatedData.speed
            ? new Prisma.Decimal(validatedData.speed)
            : null,
          heading: validatedData.heading
            ? new Prisma.Decimal(validatedData.heading)
            : null,
          altitude: validatedData.altitude
            ? new Prisma.Decimal(validatedData.altitude)
            : null,
          accuracy: validatedData.accuracy
            ? new Prisma.Decimal(validatedData.accuracy)
            : null,
          timestamp: now,
        },
      });

      // Update trip's current location
      await tx.trip.update({
        where: { id: tripId },
        data: {
          currentLat: new Prisma.Decimal(validatedData.latitude),
          currentLng: new Prisma.Decimal(validatedData.longitude),
          currentLocationUpdatedAt: now,
        },
      });

      // Update truck's current location
      await tx.truck.update({
        where: { id: trip.truckId },
        data: {
          currentLocationLat: new Prisma.Decimal(validatedData.latitude),
          currentLocationLon: new Prisma.Decimal(validatedData.longitude),
          locationUpdatedAt: now,
          gpsLastSeenAt: now,
          gpsStatus: "ACTIVE",
        },
      });

      // Update GPS device last seen
      await tx.gpsDevice.update({
        where: { id: deviceId },
        data: {
          lastSeenAt: now,
          status: "ACTIVE",
        },
      });

      return position;
    });

    return NextResponse.json({
      message: "GPS position updated",
      position: {
        id: gpsPosition.id,
        latitude: validatedData.latitude,
        longitude: validatedData.longitude,
        speed: validatedData.speed,
        heading: validatedData.heading,
        timestamp: now.toISOString(),
      },
    });
  } catch (error) {
    return handleApiError(error, "GPS update error");
  }
}

// Apply RPS rate limiting to POST (100 RPS with 20 burst)
export const POST = withRpsLimit(RPS_CONFIGS.gps, postHandler);

/**
 * GET /api/trips/[tripId]/gps
 *
 * Get all GPS positions for a trip (route history)
 */
async function getHandler(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await requireAuth();
    const { tripId } = await params;
    const { searchParams } = new URL(request.url);

    const limit = parseInt(searchParams.get("limit") || "1000");
    const since = searchParams.get("since"); // ISO timestamp

    // Get trip
    const trip = await db.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check permissions
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isDispatcher = session.role === "DISPATCHER";
    const isCarrier =
      session.role === "CARRIER" && trip.carrierId === session.organizationId;
    const isShipper =
      session.role === "SHIPPER" && trip.shipperId === session.organizationId;

    if (!isAdmin && !isDispatcher && !isCarrier && !isShipper) {
      return NextResponse.json(
        { error: "You do not have permission to view this trip" },
        { status: 403 }
      );
    }

    // For shippers, only allow access when trip is IN_TRANSIT or later
    if (isShipper && trip.status === "ASSIGNED") {
      return NextResponse.json(
        { error: "GPS data is not available until trip is in transit" },
        { status: 403 }
      );
    }

    // Build query
    const whereClause: Prisma.GpsPositionWhereInput = { tripId };
    if (since) {
      whereClause.timestamp = { gt: new Date(since) };
    }

    // Get GPS positions
    const positions = await db.gpsPosition.findMany({
      where: whereClause,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        altitude: true,
        accuracy: true,
        timestamp: true,
      },
      orderBy: { timestamp: "asc" },
      take: limit,
    });

    return NextResponse.json({
      tripId,
      tripStatus: trip.status,
      currentLocation:
        trip.currentLat && trip.currentLng
          ? {
              latitude: Number(trip.currentLat),
              longitude: Number(trip.currentLng),
              updatedAt: trip.currentLocationUpdatedAt,
            }
          : null,
      positions: positions.map((p) => ({
        id: p.id,
        latitude: Number(p.latitude),
        longitude: Number(p.longitude),
        speed: p.speed ? Number(p.speed) : null,
        heading: p.heading ? Number(p.heading) : null,
        altitude: p.altitude ? Number(p.altitude) : null,
        accuracy: p.accuracy ? Number(p.accuracy) : null,
        timestamp: p.timestamp.toISOString(),
      })),
      count: positions.length,
    });
  } catch (error) {
    return handleApiError(error, "Get GPS positions error");
  }
}

// Apply RPS rate limiting to GET (100 RPS with 20 burst)
export const GET = withRpsLimit(RPS_CONFIGS.gps, getHandler);

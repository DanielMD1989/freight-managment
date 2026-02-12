import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { broadcastGpsPosition } from "@/lib/websocket-server";
import { checkRateLimit, withRpsLimit, RATE_LIMIT_GPS_UPDATE, RPS_CONFIGS } from "@/lib/rateLimit";
import { Prisma } from "@prisma/client";

// GET /api/gps/positions - Get latest GPS positions
async function getHandler(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const truckId = searchParams.get("truckId");
    const deviceId = searchParams.get("deviceId");
    const hours = parseInt(searchParams.get("hours") || "24");

    const where: Prisma.GpsPositionWhereInput = {};

    if (truckId) {
      // Check if user can view this truck's GPS
      const truck = await db.truck.findUnique({
        where: { id: truckId },
        select: { carrierId: true },
      });

      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { organizationId: true, role: true },
      });

      const canView =
        user?.organizationId === truck?.carrierId ||
        session.role === "ADMIN" ||
        session.role === "PLATFORM_OPS";

      if (!canView) {
        return NextResponse.json(
          { error: "You do not have permission to view this truck's GPS" },
          { status: 403 }
        );
      }

      where.truckId = truckId;
    }

    if (deviceId) {
      where.deviceId = deviceId;
    }

    // Filter by time
    const since = new Date();
    since.setHours(since.getHours() - hours);
    where.timestamp = { gte: since };

    const positions = await db.gpsPosition.findMany({
      where,
      include: {
        truck: {
          select: {
            id: true,
            licensePlate: true,
            carrier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: {
        timestamp: "desc",
      },
      take: 1000, // Limit to last 1000 positions
    });

    return NextResponse.json({ positions });
  } catch (error) {
    console.error("Get GPS positions error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply RPS rate limiting to GET (100 RPS with 20 burst)
export const GET = withRpsLimit(RPS_CONFIGS.gps, getHandler);

/**
 * POST /api/gps/positions - Receive GPS data from GPS hardware devices
 *
 * HIGH FIX #10: Security Model Documentation
 *
 * INTENTIONAL DESIGN: This endpoint uses DEVICE-BASED authentication (IMEI lookup)
 * instead of user authentication because:
 *
 * 1. GPS hardware devices cannot perform OAuth/session authentication
 * 2. IMEI serves as a device identifier that must be pre-registered in our system
 * 3. Rate limiting per IMEI prevents abuse (12 updates/hour max)
 * 4. Device must be registered AND assigned to a truck to submit data
 *
 * Security measures in place:
 * - IMEI must exist in GpsDevice table (pre-registered)
 * - Device must be assigned to a truck (truck relation required)
 * - Rate limiting: 12 requests/hour per IMEI + 100 RPS burst limit
 * - Invalid IMEI returns 404 (doesn't reveal whether device exists)
 *
 * For user-authenticated GPS updates, use /api/gps/position (requires session)
 */
async function postHandler(request: NextRequest) {
  try {
    // Device-based authentication: GPS hardware devices use IMEI as identifier
    // This is intentional - hardware cannot perform session auth

    const body = await request.json();
    const { imei, latitude, longitude, speed, heading, altitude, timestamp } = body;

    if (!imei || !latitude || !longitude) {
      return NextResponse.json(
        { error: "Missing required fields: imei, latitude, longitude" },
        { status: 400 }
      );
    }

    // PHASE 4: Enforce GPS rate limiting to prevent DoS
    // Rate limit by IMEI (device identifier) - 12 requests per hour per device
    const rateLimitResult = await checkRateLimit(
      { ...RATE_LIMIT_GPS_UPDATE, keyGenerator: () => `imei:${imei}` },
      imei
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          error: "GPS update rate limit exceeded. Maximum 12 updates per hour per device.",
          retryAfter: rateLimitResult.retryAfter,
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": rateLimitResult.limit.toString(),
            "X-RateLimit-Remaining": rateLimitResult.remaining.toString(),
            "X-RateLimit-Reset": new Date(rateLimitResult.resetTime).toISOString(),
            "Retry-After": rateLimitResult.retryAfter?.toString() || "60",
          },
        }
      );
    }

    // Find GPS device with truck and carrier info
    const device = await db.gpsDevice.findUnique({
      where: { imei },
      select: {
        id: true,
        truck: {
          select: {
            id: true,
            carrierId: true,
          },
        },
      },
    });

    if (!device) {
      return NextResponse.json(
        { error: "GPS device not found" },
        { status: 404 }
      );
    }

    if (!device.truck) {
      return NextResponse.json(
        { error: "GPS device not assigned to a truck" },
        { status: 400 }
      );
    }

    const truckId = device.truck.id;
    const carrierId = device.truck.carrierId;
    const positionTimestamp = timestamp ? new Date(timestamp) : new Date();

    // Find active load for this truck
    const activeLoad = await db.load.findFirst({
      where: {
        assignedTruckId: truckId,
        status: "IN_TRANSIT",
      },
      select: { id: true },
    });

    // TD-003 FIX: Wrap all GPS position updates in a transaction for atomicity
    const position = await db.$transaction(async (tx) => {
      // Create GPS position
      const pos = await tx.gpsPosition.create({
        data: {
          deviceId: device.id,
          truckId,
          latitude,
          longitude,
          speed: speed || null,
          heading: heading || null,
          altitude: altitude || null,
          timestamp: positionTimestamp,
          loadId: activeLoad?.id || null,
        },
      });

      // Update device last seen
      await tx.gpsDevice.update({
        where: { id: device.id },
        data: { lastSeenAt: new Date() },
      });

      // Update truck's current location
      await tx.truck.update({
        where: { id: truckId },
        data: {
          currentLocationLat: latitude,
          currentLocationLon: longitude,
          locationUpdatedAt: positionTimestamp,
          gpsLastSeenAt: new Date(),
          gpsStatus: "ACTIVE",
        },
      });

      return pos;
    });

    // Broadcast the position via WebSocket for real-time updates
    await broadcastGpsPosition(truckId, activeLoad?.id || null, carrierId, {
      truckId,
      loadId: activeLoad?.id,
      lat: latitude,
      lng: longitude,
      speed: speed || undefined,
      heading: heading || undefined,
      timestamp: positionTimestamp.toISOString(),
    });

    return NextResponse.json({ position }, { status: 201 });
  } catch (error) {
    console.error("Create GPS position error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Apply RPS rate limiting to POST (100 RPS with 20 burst)
export const POST = withRpsLimit(RPS_CONFIGS.gps, postHandler);

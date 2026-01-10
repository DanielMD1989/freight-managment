import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { broadcastGpsPosition } from "@/lib/websocket-server";

// GET /api/gps/positions - Get latest GPS positions
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const truckId = searchParams.get("truckId");
    const deviceId = searchParams.get("deviceId");
    const hours = parseInt(searchParams.get("hours") || "24");

    const where: any = {};

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

// POST /api/gps/positions - Receive GPS data from devices
export async function POST(request: NextRequest) {
  try {
    // This would be called by GPS hardware devices
    // For MVP, we'll allow simple position updates

    const body = await request.json();
    const { imei, latitude, longitude, speed, heading, altitude, timestamp } = body;

    if (!imei || !latitude || !longitude) {
      return NextResponse.json(
        { error: "Missing required fields: imei, latitude, longitude" },
        { status: 400 }
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

    // Create GPS position
    const position = await db.gpsPosition.create({
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
    await db.gpsDevice.update({
      where: { id: device.id },
      data: { lastSeenAt: new Date() },
    });

    // Update truck's current location
    await db.truck.update({
      where: { id: truckId },
      data: {
        currentLocationLat: latitude,
        currentLocationLon: longitude,
        locationUpdatedAt: positionTimestamp,
        gpsLastSeenAt: new Date(),
        gpsStatus: "ACTIVE",
      },
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

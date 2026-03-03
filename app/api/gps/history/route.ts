/**
 * GPS History API
 *
 * GET /api/gps/history - Get GPS position history for a trip/load or truck
 *
 * Query params:
 * - loadId: Get history for a specific load/trip
 * - truckId: Get history for a specific truck
 * - from: Start date (ISO string)
 * - to: End date (ISO string)
 * - limit: Max positions to return (default 1000)
 *
 * MAP + GPS Implementation - Phase 2
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { calculateDistanceKm } from "@/lib/geo";
import { roundToDecimals } from "@/lib/rounding";
import { withRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";
import { Prisma } from "@prisma/client";

async function getHandler(request: NextRequest) {
  try {
    // Fix 26: requireActiveUser for ACTIVE status check
    const session = await requireActiveUser();
    const { searchParams } = request.nextUrl;

    const loadId = searchParams.get("loadId");
    const truckId = searchParams.get("truckId");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const limit = Math.max(
      1,
      Math.min(parseInt(searchParams.get("limit") || "1000", 10), 1000)
    );

    if (!loadId && !truckId) {
      return NextResponse.json(
        { error: "Either loadId or truckId is required" },
        { status: 400 }
      );
    }

    // Get user's organization for access control
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    // Build where clause
    const where: Prisma.GpsPositionWhereInput = {};

    if (loadId) {
      // Verify access to load
      const load = await db.load.findUnique({
        where: { id: loadId },
        select: {
          id: true,
          shipperId: true,
          assignedTruck: {
            select: {
              carrierId: true,
            },
          },
        },
      });

      if (!load) {
        return NextResponse.json({ error: "Load not found" }, { status: 404 });
      }

      // Fix 24: 403→404 resource cloaking for access denied
      if (session.role === "CARRIER") {
        if (load.assignedTruck?.carrierId !== user?.organizationId) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      } else if (session.role === "SHIPPER") {
        if (load.shipperId !== user?.organizationId) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      }
      // Admin/Dispatcher can access any load

      where.loadId = loadId;
    }

    if (truckId) {
      // Verify access to truck
      if (session.role === "CARRIER") {
        if (!user?.organizationId) {
          // Fix 24: 403→404 resource cloaking
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        const truck = await db.truck.findFirst({
          where: {
            id: truckId,
            carrierId: user.organizationId,
          },
        });

        if (!truck) {
          // Fix 24: 403→404 resource cloaking
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      } else if (session.role === "SHIPPER") {
        // Shipper cannot access truck history directly
        return NextResponse.json(
          { error: "Shippers cannot access truck history directly" },
          { status: 403 }
        );
      }
      // Admin/Dispatcher can access any truck

      where.truckId = truckId;
    }

    // Date range filter
    if (from || to) {
      where.timestamp = {};
      if (from) {
        where.timestamp.gte = new Date(from);
      }
      if (to) {
        where.timestamp.lte = new Date(to);
      }
    }

    // Fetch GPS positions
    const positions = await db.gpsPosition.findMany({
      where,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        altitude: true,
        accuracy: true,
        timestamp: true,
        loadId: true,
        truckId: true,
      },
      orderBy: {
        timestamp: "asc",
      },
      // Fix 25: cap at 1000 (down from 5000) to prevent expensive queries
      take: Math.min(limit, 1000),
    });

    // Transform for response
    const history = positions.map((pos) => ({
      id: pos.id,
      lat: Number(pos.latitude),
      lng: Number(pos.longitude),
      speed: pos.speed ? Number(pos.speed) : null,
      heading: pos.heading ? Number(pos.heading) : null,
      altitude: pos.altitude ? Number(pos.altitude) : null,
      accuracy: pos.accuracy ? Number(pos.accuracy) : null,
      timestamp: pos.timestamp.toISOString(),
      loadId: pos.loadId,
      truckId: pos.truckId,
    }));

    // Calculate route statistics
    let totalDistance = 0;
    let totalTime = 0;
    let avgSpeed = 0;

    if (history.length > 1) {
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];

        // Haversine distance (delegated to lib/geo.ts)
        totalDistance += calculateDistanceKm(
          prev.lat,
          prev.lng,
          curr.lat,
          curr.lng
        );
      }

      const startTime = new Date(history[0].timestamp).getTime();
      const endTime = new Date(history[history.length - 1].timestamp).getTime();
      totalTime = (endTime - startTime) / 1000 / 60 / 60; // in hours

      if (totalTime > 0) {
        avgSpeed = totalDistance / totalTime;
      }
    }

    // Rounding delegated to lib/rounding.ts
    return NextResponse.json({
      positions: history,
      count: history.length,
      stats: {
        totalDistanceKm: roundToDecimals(totalDistance, 2),
        totalTimeHours: roundToDecimals(totalTime, 2),
        avgSpeedKmh: roundToDecimals(avgSpeed, 2),
        startTime: history.length > 0 ? history[0].timestamp : null,
        endTime:
          history.length > 0 ? history[history.length - 1].timestamp : null,
      },
    });
  } catch (error) {
    return handleApiError(error, "GPS history error");
  }
}

// Fix 23: Apply RPS rate limiting — expensive query (up to 1000 positions)
export const GET = withRpsLimit(RPS_CONFIGS.gps, getHandler);

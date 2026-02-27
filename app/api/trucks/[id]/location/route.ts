/**
 * Sprint 6: Truck Location Management
 * Update and retrieve truck current location for DH-O calculations
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { getTruckCurrentLocation } from "@/lib/deadheadOptimization";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  currentCity: z.string().optional(),
  currentRegion: z.string().optional(),
});

// PATCH /api/trucks/[id]/location - Update truck location
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting: GPS endpoints need higher limits for real-time tracking
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      RPS_CONFIGS.gps.endpoint,
      ip,
      RPS_CONFIGS.gps.rps,
      RPS_CONFIGS.gps.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: 1 },
        { status: 429, headers: { "Retry-After": "1" } }
      );
    }

    const session = await requireAuth();

    // CSRF protection with mobile client handling
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: truckId } = await params;

    const body = await request.json();
    const { latitude, longitude, currentCity, currentRegion } =
      updateLocationSchema.parse(body);

    // Get truck to check ownership
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: {
        id: true,
        carrierId: true,
      },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Permission check: Only carrier who owns truck or admin
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isOwner = user?.organizationId === truck.carrierId;
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to update this truck location" },
        { status: 403 }
      );
    }

    // Update truck location
    const updatedTruck = await db.truck.update({
      where: { id: truckId },
      data: {
        currentLocationLat: latitude,
        currentLocationLon: longitude,
        currentCity: currentCity || undefined,
        currentRegion: currentRegion || undefined,
        locationUpdatedAt: new Date(),
      },
      select: {
        id: true,
        licensePlate: true,
        currentLocationLat: true,
        currentLocationLon: true,
        currentCity: true,
        currentRegion: true,
        locationUpdatedAt: true,
      },
    });

    return NextResponse.json({
      message: "Truck location updated successfully",
      truck: updatedTruck,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      // FIX: Use zodErrorResponse for consistent sanitization
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(error);
    }

    console.error("Update truck location error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// GET /api/trucks/[id]/location - Get truck current location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting: GPS endpoints need higher limits for real-time tracking
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      RPS_CONFIGS.gps.endpoint,
      ip,
      RPS_CONFIGS.gps.rps,
      RPS_CONFIGS.gps.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: 1 },
        { status: 429, headers: { "Retry-After": "1" } }
      );
    }

    const session = await requireAuth();
    const { id: truckId } = await params;

    // Get truck details and verify ownership
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: {
        id: true,
        licensePlate: true,
        carrierId: true,
        currentCity: true,
        currentRegion: true,
        locationUpdatedAt: true,
      },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Check ownership: carrier who owns truck, shipper with active load, or admin
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isOwner = user?.organizationId === truck.carrierId;
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

    // Shippers can view location if truck is on their active load
    let isShipperWithActiveLoad = false;
    if (user?.role === "SHIPPER" && user?.organizationId) {
      const activeLoad = await db.load.findFirst({
        where: {
          assignedTruckId: truckId,
          shipperId: user.organizationId,
          status: "IN_TRANSIT",
        },
      });
      isShipperWithActiveLoad = !!activeLoad;
    }

    if (!isOwner && !isAdmin && !isShipperWithActiveLoad) {
      return NextResponse.json(
        { error: "You do not have permission to view this truck's location" },
        { status: 403 }
      );
    }

    // Get truck location (from GPS or database)
    const location = await getTruckCurrentLocation(truckId);

    if (!location) {
      return NextResponse.json(
        { error: "Truck location not available" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      truckId,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        source: location.source,
        timestamp: location.timestamp || truck?.locationUpdatedAt,
        city: truck?.currentCity,
        region: truck?.currentRegion,
      },
    });
  } catch (error) {
    console.error("Get truck location error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * Sprint 6: Truck Location Management
 * Update and retrieve truck current location for DH-O calculations
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { getTruckCurrentLocation } from "@/lib/deadheadOptimization";
import { handleApiError } from "@/lib/apiErrors";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { CacheInvalidation } from "@/lib/cache";

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
    const { id: truckId } = await params;

    // Rate limiting: Per-truck scoping prevents one carrier's fleet from exhausting limits
    const rpsResult = await checkRpsLimit(
      `${RPS_CONFIGS.gps.endpoint}:${truckId}`,
      truckId,
      RPS_CONFIGS.gps.rps,
      RPS_CONFIGS.gps.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: 1 },
        { status: 429, headers: { "Retry-After": "1" } }
      );
    }

    const session = await requireActiveUser();

    // CSRF protection with mobile client handling
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const body = await request.json();
    const parseResult = updateLocationSchema.safeParse(body);
    if (!parseResult.success) {
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(parseResult.error);
    }
    const { latitude, longitude, currentCity, currentRegion } =
      parseResult.data;

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
    const isOwner =
      session.role === "CARRIER" && session.organizationId === truck.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
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

    // M8 FIX: Invalidate cache after location update
    await CacheInvalidation.truck(truckId, truck.carrierId);

    return NextResponse.json({
      message: "Truck location updated successfully",
      truck: updatedTruck,
    });
  } catch (error) {
    return handleApiError(error, "Update truck location error");
  }
}

// GET /api/trucks/[id]/location - Get truck current location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireActiveUser();
    const { id: truckId } = await params;

    // Rate limiting: Per-truck scoping prevents one carrier's fleet from exhausting limits
    const rpsResult = await checkRpsLimit(
      `${RPS_CONFIGS.gps.endpoint}:${truckId}`,
      truckId,
      RPS_CONFIGS.gps.rps,
      RPS_CONFIGS.gps.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded", retryAfter: 1 },
        { status: 429, headers: { "Retry-After": "1" } }
      );
    }

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
    const isOwner =
      session.role === "CARRIER" && session.organizationId === truck.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    // Shippers can view location if truck is on their active load
    let isShipperWithActiveLoad = false;
    if (session.role === "SHIPPER" && session.organizationId) {
      const activeLoad = await db.load.findFirst({
        where: {
          assignedTruckId: truckId,
          shipperId: session.organizationId,
          status: "IN_TRANSIT",
        },
      });
      isShipperWithActiveLoad = !!activeLoad;
    }

    if (!isOwner && !isAdmin && !isShipperWithActiveLoad) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
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
    return handleApiError(error, "Get truck location error");
  }
}

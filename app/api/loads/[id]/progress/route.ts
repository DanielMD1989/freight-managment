/**
 * Load Trip Progress API
 *
 * Service Fee Implementation - Task 6
 *
 * Get trip progress for a specific load
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { calculateTripProgress } from "@/lib/tripProgress";

/**
 * GET /api/loads/[id]/progress
 *
 * Get trip progress for a load
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    const load = await db.load.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        shipperId: true,
        trackingEnabled: true,
        tripProgressPercent: true,
        remainingDistanceKm: true,
        lastProgressUpdateAt: true,
        enteredDestGeofence: true,
        enteredDestGeofenceAt: true,
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

    // Check access - must be shipper, carrier, or admin
    const hasAccess =
      session.role === "ADMIN" ||
      session.role === "SUPER_ADMIN" ||
      session.role === "DISPATCHER" ||
      session.organizationId === load.shipperId ||
      session.organizationId === load.assignedTruck?.carrierId;

    if (!hasAccess) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get live progress if tracking enabled and IN_TRANSIT
    let liveProgress = null;
    if (load.status === "IN_TRANSIT" && load.trackingEnabled) {
      liveProgress = await calculateTripProgress(id);
    }

    return NextResponse.json({
      loadId: load.id,
      status: load.status,
      trackingEnabled: load.trackingEnabled,
      progress: {
        percent: liveProgress?.progressPercent ?? load.tripProgressPercent ?? 0,
        remainingKm:
          liveProgress?.remainingKm ??
          (load.remainingDistanceKm ? Number(load.remainingDistanceKm) : null),
        totalDistanceKm: liveProgress?.totalDistanceKm ?? null,
        travelledKm: liveProgress?.travelledKm ?? null,
        estimatedArrival: liveProgress?.estimatedArrival ?? null,
        isNearDestination: liveProgress?.isNearDestination ?? false,
        enteredDestGeofence:
          liveProgress?.enteredDestGeofence ?? load.enteredDestGeofence,
        enteredDestGeofenceAt: load.enteredDestGeofenceAt,
        lastUpdate: load.lastProgressUpdateAt,
      },
    });
  } catch (error) {
    console.error("Get trip progress error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

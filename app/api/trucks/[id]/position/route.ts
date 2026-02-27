/**
 * Truck GPS Position API
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 *
 * Get latest GPS position for a truck
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { getLatestPosition } from "@/lib/gpsQuery";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";

/**
 * GET /api/trucks/[id]/position
 *
 * Get latest GPS position for a truck
 */
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

    const { id: truckId } = await params;
    const session = await requireAuth();

    // Verify truck exists and user has access
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: { id: true, carrierId: true },
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

    // Shippers can view position if truck is on their active load
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
        { error: "You do not have permission to view this truck's position" },
        { status: 403 }
      );
    }

    const position = await getLatestPosition(truckId);

    if (!position) {
      return NextResponse.json(
        { error: "No GPS position data found for this truck" },
        { status: 404 }
      );
    }

    return NextResponse.json({ position });
  } catch (error) {
    console.error("Get truck position error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

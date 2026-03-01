/**
 * Sprint 6: DH-D Optimized Load Chaining
 * Find next loads from current load's delivery location with minimal deadhead
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { findNextLoadsWithMinimalDHD } from "@/lib/deadheadOptimization";
import { handleApiError } from "@/lib/apiErrors";

// GET /api/loads/[id]/next-loads - Find next loads with minimal DH-D
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: loadId } = await params;

    // H5 FIX: Get user's organization for authorization check
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    // H5 FIX: Verify load exists and check authorization
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        shipperId: true,
        assignedTruck: { select: { carrierId: true } },
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // H5 FIX: Only shipper, assigned carrier, dispatcher, or admin can access
    const isShipper = user?.organizationId === load.shipperId;
    const isAssignedCarrier =
      load.assignedTruck?.carrierId === user?.organizationId;
    const isDispatcher = user?.role === "DISPATCHER";
    const isAdmin = user?.role === "ADMIN" || user?.role === "SUPER_ADMIN";

    if (!isShipper && !isAssignedCarrier && !isDispatcher && !isAdmin) {
      return NextResponse.json(
        {
          error: "You do not have permission to view next loads for this load",
        },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const maxDHD = parseInt(searchParams.get("maxDHD") || "200", 10); // km
    const truckType = searchParams.get("truckType") || undefined;
    const minTripKm = searchParams.get("minTripKm")
      ? parseFloat(searchParams.get("minTripKm")!)
      : undefined;
    const maxTripKm = searchParams.get("maxTripKm")
      ? parseFloat(searchParams.get("maxTripKm")!)
      : undefined;
    const pickupAfter = searchParams.get("pickupAfter")
      ? new Date(searchParams.get("pickupAfter")!)
      : undefined;

    // Find next loads with minimal DH-D
    const nextLoads = await findNextLoadsWithMinimalDHD(loadId, maxDHD, {
      truckType,
      minTripKm,
      maxTripKm,
      pickupAfter,
    });

    return NextResponse.json({
      currentLoadId: loadId,
      maxDHD,
      nextLoads,
      count: nextLoads.length,
      filters: {
        maxDHD,
        truckType,
        minTripKm,
        maxTripKm,
        pickupAfter,
      },
    });
  } catch (error) {
    return handleApiError(error, "Next loads error");
  }
}

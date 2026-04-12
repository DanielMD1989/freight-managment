export const dynamic = "force-dynamic";
/**
 * Unassign Driver from Trip — Task 15
 *
 * POST /api/trips/[tripId]/unassign-driver
 *
 * Carrier (same org) or Admin removes the assigned driver from a trip.
 * Only allowed when the trip is in ASSIGNED status — once the driver has
 * started pickup/transit, the carrier must use reassign-truck (Task 9) or
 * the explicit assign-driver endpoint to swap instead.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/apiErrors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { tripId } = await params;

    // 1. Fetch trip
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        status: true,
        carrierId: true,
        driverId: true,
        load: {
          select: { pickupCity: true, deliveryCity: true },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 2. Role check
    const isCarrier =
      session.role === "CARRIER" && session.organizationId === trip.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    if (!isCarrier && !isAdmin) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 3. ASSIGNED only
    if (trip.status !== "ASSIGNED") {
      return NextResponse.json(
        { error: "Can only unassign driver from ASSIGNED trips" },
        { status: 400 }
      );
    }

    // 4. Must have a driver
    if (!trip.driverId) {
      return NextResponse.json(
        { error: "No driver assigned to this trip" },
        { status: 400 }
      );
    }

    const removedDriverId = trip.driverId;

    await db.trip.update({
      where: { id: tripId },
      data: { driverId: null },
    });

    // Notify removed driver
    const route =
      trip.load?.pickupCity && trip.load?.deliveryCity
        ? `${trip.load.pickupCity} → ${trip.load.deliveryCity}`
        : "a trip";
    createNotification({
      userId: removedDriverId,
      type: "TRIP_DRIVER_UNASSIGNED",
      title: "You have been unassigned from a trip",
      message: `You have been unassigned from trip ${route}.`,
      metadata: { tripId, unassignedBy: session.userId },
    }).catch((err) =>
      console.warn("TRIP_DRIVER_UNASSIGNED notification failed:", err?.message)
    );

    return NextResponse.json({
      success: true,
      tripId,
      removedDriverId,
    });
  } catch (error) {
    return handleApiError(error, "Unassign driver error");
  }
}

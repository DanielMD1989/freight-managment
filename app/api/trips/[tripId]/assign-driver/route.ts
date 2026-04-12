export const dynamic = "force-dynamic";
/**
 * Assign Driver to Trip — Task 15
 *
 * POST /api/trips/[tripId]/assign-driver
 *
 * Carrier (same org) or Admin assigns a DRIVER to a trip. The driver must
 * be ACTIVE, belong to the same carrier org, be isAvailable, and must NOT
 * already have another active trip (validated via checkDriverConflicts).
 *
 * If the trip already has a driver, the old one is replaced and the audit
 * fields (previousDriverId, driverReassignedAt, driverReassignReason) are
 * set, plus both old and new drivers are notified.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { createNotification } from "@/lib/notifications";
import { checkDriverConflicts } from "@/lib/assignmentConflictDetection";
import { handleApiError } from "@/lib/apiErrors";
import { zodErrorResponse } from "@/lib/validation";

const assignDriverSchema = z.object({
  driverId: z.string().min(1, "driverId is required"),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { tripId } = await params;

    const body = await request.json();
    const parsed = assignDriverSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }
    const { driverId } = parsed.data;

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

    // 3. Trip must be ASSIGNED or PICKUP_PENDING
    if (trip.status !== "ASSIGNED" && trip.status !== "PICKUP_PENDING") {
      return NextResponse.json(
        {
          error: `Driver can only be assigned to ASSIGNED or PICKUP_PENDING trips. Current status: ${trip.status}`,
        },
        { status: 400 }
      );
    }

    // 4. Fetch driver
    const driver = await db.user.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        role: true,
        status: true,
        organizationId: true,
        firstName: true,
        lastName: true,
        driverProfile: { select: { isAvailable: true } },
      },
    });

    if (!driver || driver.role !== "DRIVER") {
      return NextResponse.json({ error: "Driver not found" }, { status: 400 });
    }

    // 5. Driver must be ACTIVE
    if (driver.status !== "ACTIVE") {
      return NextResponse.json(
        { error: "Driver is not active" },
        { status: 400 }
      );
    }

    // 6. Same carrier org
    if (driver.organizationId !== trip.carrierId) {
      return NextResponse.json(
        { error: "Driver must belong to same carrier organization" },
        { status: 400 }
      );
    }

    // 7. isAvailable
    if (!driver.driverProfile?.isAvailable) {
      return NextResponse.json(
        { error: "Driver is not available" },
        { status: 400 }
      );
    }

    // 8. Conflict check
    const conflictCheck = await checkDriverConflicts(driverId, tripId);
    if (conflictCheck.hasConflict) {
      return NextResponse.json(
        {
          error: conflictCheck.conflicts[0].message,
          conflicts: conflictCheck.conflicts,
        },
        { status: 400 }
      );
    }

    // Build update data
    const isReplacing = !!trip.driverId && trip.driverId !== driverId;
    const previousDriverId = trip.driverId;
    const now = new Date();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = {
      driverId,
    };
    if (isReplacing) {
      updateData.previousDriverId = previousDriverId;
      updateData.driverReassignedAt = now;
      updateData.driverReassignReason = "Reassigned by carrier";
    }

    await db.trip.update({
      where: { id: tripId },
      data: updateData,
    });

    // Notify new driver
    const route =
      trip.load?.pickupCity && trip.load?.deliveryCity
        ? `${trip.load.pickupCity} → ${trip.load.deliveryCity}`
        : "a trip";
    createNotification({
      userId: driverId,
      type: "TRIP_DRIVER_ASSIGNED",
      title: "You have been assigned to a trip",
      message: `You have been assigned to trip ${route}.`,
      metadata: { tripId, assignedBy: session.userId },
    }).catch((err) =>
      console.warn("TRIP_DRIVER_ASSIGNED notification failed:", err?.message)
    );

    // Notify old driver if replacing
    if (isReplacing && previousDriverId) {
      createNotification({
        userId: previousDriverId,
        type: "TRIP_DRIVER_UNASSIGNED",
        title: "You have been unassigned from a trip",
        message: `You have been unassigned from trip ${route}. A new driver has been assigned.`,
        metadata: { tripId, unassignedBy: session.userId },
      }).catch((err) =>
        console.warn(
          "TRIP_DRIVER_UNASSIGNED notification failed:",
          err?.message
        )
      );
    }

    return NextResponse.json({
      success: true,
      tripId,
      driverId,
      previousDriverId: previousDriverId || null,
    });
  } catch (error) {
    return handleApiError(error, "Assign driver error");
  }
}

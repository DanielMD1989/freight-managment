/**
 * Truck Reassignment API
 *
 * POST /api/trips/[tripId]/reassign-truck
 *
 * Swap a truck mid-trip without cancelling. Blueprint §7 — Truck Reassignment.
 * Only Admin or Dispatcher can reassign. Trip must be in EXCEPTION status.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { handleApiError } from "@/lib/apiErrors";
import { Prisma } from "@prisma/client";
import {
  notifyOrganization,
  createNotificationForRole,
  NotificationType,
} from "@/lib/notifications";

const reassignTruckSchema = z.object({
  newTruckId: z.string().min(1),
  reason: z.string().min(1).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    // 1. CSRF
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // 2. Auth
    const { tripId } = await params;
    const session = await requireActiveUser();

    // 3. Parse + validate body
    const body = await request.json();
    const { newTruckId, reason } = reassignTruckSchema.parse(body);

    // 4. Fetch trip
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            shipperId: true,
          },
        },
        truck: {
          select: {
            id: true,
            carrierId: true,
            licensePlate: true,
          },
        },
      },
    });

    // 5. Trip not found
    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 6. Role check — Admin or Dispatcher only
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isDispatcher = session.role === "DISPATCHER";
    if (!isAdmin && !isDispatcher) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // 7. Trip must be EXCEPTION
    if (trip.status !== "EXCEPTION") {
      return NextResponse.json(
        { error: "Trip must be in EXCEPTION status to reassign truck" },
        { status: 400 }
      );
    }

    // 8. Fetch new truck
    const newTruck = await db.truck.findUnique({
      where: { id: newTruckId },
      select: {
        id: true,
        carrierId: true,
        isAvailable: true,
        licensePlate: true,
        gpsDeviceId: true,
      },
    });

    // 9. New truck not found
    if (!newTruck) {
      return NextResponse.json(
        { error: "Replacement truck not found" },
        { status: 400 }
      );
    }

    // 10. Same carrier org
    if (newTruck.carrierId !== trip.truck?.carrierId) {
      return NextResponse.json(
        { error: "Replacement truck must belong to same carrier organization" },
        { status: 400 }
      );
    }

    // 11. Must be available
    if (!newTruck.isAvailable) {
      return NextResponse.json(
        { error: "Replacement truck is not available" },
        { status: 400 }
      );
    }

    // 12. Must differ from current
    if (newTruckId === trip.truckId) {
      return NextResponse.json(
        { error: "New truck must be different from current truck" },
        { status: 400 }
      );
    }

    // Transaction
    const reassignedAt = new Date();

    await db.$transaction(async (tx) => {
      // a) Update trip
      await tx.trip.update({
        where: {
          id: tripId,
          status: "EXCEPTION", // optimistic lock
        },
        data: {
          truckId: newTruckId,
          previousTruckId: trip.truckId,
          reassignedAt,
          reassignmentReason: reason,
          status: "IN_TRANSIT",
          trackingEnabled: true,
        },
      });

      // b) Count other active trips on OLD truck
      const otherActiveTrips = await tx.trip.count({
        where: {
          truckId: trip.truckId,
          id: { not: tripId },
          status: {
            in: [
              "ASSIGNED",
              "PICKUP_PENDING",
              "IN_TRANSIT",
              "DELIVERED",
              "EXCEPTION",
            ],
          },
        },
      });

      // c) Free old truck if no other active trips
      if (otherActiveTrips === 0) {
        await tx.truck.update({
          where: { id: trip.truckId },
          data: { isAvailable: true },
        });
      }
      // Old truck posting MATCHED → ACTIVE
      await tx.truckPosting.updateMany({
        where: { truckId: trip.truckId, status: "MATCHED" },
        data: { status: "ACTIVE" },
      });

      // d) Lock new truck
      await tx.truck.update({
        where: { id: newTruckId },
        data: { isAvailable: false },
      });
      // New truck posting ACTIVE → MATCHED
      await tx.truckPosting.updateMany({
        where: { truckId: newTruckId, status: "ACTIVE" },
        data: { status: "MATCHED" },
      });

      // e) Sync load back to IN_TRANSIT + update assignedTruckId
      await tx.load.update({
        where: { id: trip.load!.id },
        data: {
          status: "IN_TRANSIT",
          assignedTruckId: newTruckId,
        },
      });

      // f) Audit loadEvent
      await tx.loadEvent.create({
        data: {
          loadId: trip.load!.id,
          eventType: "TRIP_REASSIGNED",
          description: `Truck reassigned from ${trip.truck?.licensePlate} to ${newTruck.licensePlate}. Reason: ${reason}`,
          userId: session.userId,
          metadata: {
            previousTruckId: trip.truckId,
            newTruckId,
            reassignedBy: session.userId,
            reassignedByRole: session.role,
          },
        },
      });
    });

    // Post-transaction notifications (fire-and-forget)

    // 1. Notify shipper
    if (trip.load?.shipperId) {
      notifyOrganization({
        organizationId: trip.load.shipperId,
        type: NotificationType.TRIP_REASSIGNED,
        title: "Truck replacement — tracking resumed",
        message: `Your cargo for ${trip.load.pickupCity} → ${trip.load.deliveryCity} has been transferred to a replacement truck (${newTruck.licensePlate}) due to a breakdown. Tracking has resumed.`,
        metadata: {
          tripId,
          loadId: trip.load.id,
          newTruckId,
          previousTruckId: trip.truckId,
        },
      }).catch(() => {});
    }

    // 2. Notify carrier org
    if (trip.truck?.carrierId) {
      notifyOrganization({
        organizationId: trip.truck.carrierId,
        type: NotificationType.TRIP_REASSIGNED,
        title: "Trip reassigned to replacement truck",
        message: `Trip for ${trip.load?.pickupCity} → ${trip.load?.deliveryCity} has been reassigned to truck ${newTruck.licensePlate}. Please ensure the new driver has all load details.`,
        metadata: {
          tripId,
          loadId: trip.load?.id,
          previousTruckId: trip.truckId,
          newTruckId,
        },
      }).catch(() => {});
    }

    // 3. If Dispatcher initiated — notify Admin
    if (isDispatcher) {
      createNotificationForRole({
        role: "ADMIN",
        type: NotificationType.TRIP_REASSIGNED,
        title: "Dispatcher performed truck reassignment",
        message: `Dispatcher reassigned trip ${tripId} from truck ${trip.truck?.licensePlate} to ${newTruck.licensePlate}. Reason: ${reason}`,
        metadata: {
          tripId,
          previousTruckId: trip.truckId,
          newTruckId,
          reassignedBy: session.userId,
        },
      }).catch(() => {});
    }

    return NextResponse.json({
      success: true,
      tripId,
      newTruckId,
      previousTruckId: trip.truckId,
      reassignedAt,
    });
  } catch (error) {
    // P2025: optimistic lock failed — trip status changed concurrently
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        {
          error:
            "Trip status was modified concurrently. Please refresh and retry.",
        },
        { status: 409 }
      );
    }
    return handleApiError(error, "Reassign truck error");
  }
}

export const dynamic = "force-dynamic";
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
  createNotification,
  NotificationType,
} from "@/lib/notifications";

const reassignTruckSchema = z.object({
  newTruckId: z.string().min(1),
  reason: z.string().min(1).max(500),
  // Task 9: optional driver reassignment alongside truck swap
  newDriverId: z.string().min(1).optional(),
  driverReassignReason: z.string().max(500).optional(),
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
    const { newTruckId, reason, newDriverId, driverReassignReason } =
      reassignTruckSchema.parse(body);

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
        driver: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            phone: true,
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

    // 13. Task 9: Optional driver reassignment validation.
    // Only run when the caller explicitly supplied newDriverId. If omitted,
    // the existing driver (if any) stays on the trip with the new truck.
    if (newDriverId) {
      // a) Driver must exist, have role=DRIVER, and be ACTIVE.
      const newDriver = await db.user.findUnique({
        where: { id: newDriverId },
        select: {
          id: true,
          role: true,
          status: true,
          organizationId: true,
        },
      });

      if (
        !newDriver ||
        newDriver.role !== "DRIVER" ||
        newDriver.status !== "ACTIVE"
      ) {
        return NextResponse.json(
          { error: "Driver not found or not active" },
          { status: 400 }
        );
      }

      // b) Driver must belong to the same carrier org as the (new) truck.
      // trip.truck.carrierId === newTruck.carrierId at this point.
      if (newDriver.organizationId !== trip.truck?.carrierId) {
        return NextResponse.json(
          { error: "Driver must belong to same carrier organization" },
          { status: 400 }
        );
      }

      // c) Driver must not already have another active trip.
      const driverConflict = await db.trip.findFirst({
        where: {
          driverId: newDriverId,
          id: { not: tripId },
          status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
        },
        select: { id: true },
      });
      if (driverConflict) {
        return NextResponse.json(
          { error: "Driver already has an active trip" },
          { status: 400 }
        );
      }
    }

    // Transaction
    const reassignedAt = new Date();

    await db.$transaction(async (tx) => {
      // a) Update trip
      // Task 9: when newDriverId is provided, also swap the driver and
      // record the audit fields. When omitted, driverId stays untouched —
      // the existing driver (if any) continues on the new truck. Using
      // TripUncheckedUpdateInput so FK scalars (truckId, driverId) can be
      // written directly — matches the pre-Task-9 pattern in this file.
      const tripUpdateData: Prisma.TripUncheckedUpdateInput = {
        truckId: newTruckId,
        previousTruckId: trip.truckId,
        reassignedAt,
        reassignmentReason: reason,
        status: "IN_TRANSIT",
        trackingEnabled: true,
      };

      if (newDriverId) {
        tripUpdateData.driverId = newDriverId;
        tripUpdateData.previousDriverId = trip.driverId ?? null;
        tripUpdateData.driverReassignedAt = reassignedAt;
        tripUpdateData.driverReassignReason = driverReassignReason ?? reason;
      }

      await tx.trip.update({
        where: {
          id: tripId,
          status: "EXCEPTION", // optimistic lock
        },
        data: tripUpdateData,
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

      // d2) Auto-availability: driver swap (mirrors truck pattern above)
      if (newDriverId) {
        // New driver becomes unavailable
        await tx.driverProfile.update({
          where: { userId: newDriverId },
          data: { isAvailable: false },
        });

        // Old driver restored if no other active trips
        const driverChanged = newDriverId !== trip.driverId;
        if (driverChanged && trip.driverId) {
          const oldDriverTrips = await tx.trip.count({
            where: {
              driverId: trip.driverId,
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
          if (oldDriverTrips === 0) {
            await tx.driverProfile.update({
              where: { userId: trip.driverId },
              data: { isAvailable: true },
            });
          }
        }
      }

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
            // Task 9: driver audit fields
            previousDriverId: trip.driverId ?? null,
            newDriverId: newDriverId ?? null,
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
      }).catch((err) => console.warn("Notification failed:", err?.message));
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
      }).catch((err) => console.warn("Notification failed:", err?.message));
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
      }).catch((err) => console.warn("Notification failed:", err?.message));
    }

    // 4. Task 9: driver-side notifications
    const route =
      trip.load?.pickupCity && trip.load?.deliveryCity
        ? `${trip.load.pickupCity} → ${trip.load.deliveryCity}`
        : "your trip";
    const driverChanged = !!newDriverId && newDriverId !== trip.driverId;

    // 4a. The driver who stays on the trip (not replaced) gets a
    //     "your truck changed" heads-up. Fires only when the trip already
    //     had a driver AND that driver is still on the trip post-reassign.
    if (trip.driverId && !driverChanged) {
      createNotification({
        userId: trip.driverId,
        type: NotificationType.TRIP_REASSIGNED,
        title: "Your trip truck has been changed",
        message: `Your trip (${route}) is now on truck ${newTruck.licensePlate} after a breakdown. Tracking has resumed.`,
        metadata: {
          tripId,
          loadId: trip.load?.id,
          previousTruckId: trip.truckId,
          newTruckId,
        },
      }).catch((err) => console.warn("Notification failed:", err?.message));
    }

    // 4b. Driver replacement: notify new driver (assigned) and, if one
    //     existed, the old driver (unassigned).
    if (driverChanged) {
      createNotification({
        userId: newDriverId!,
        type: "TRIP_DRIVER_ASSIGNED",
        title: "You have been assigned to a trip",
        message: `You have been assigned to trip ${route} on truck ${newTruck.licensePlate}.`,
        metadata: {
          tripId,
          loadId: trip.load?.id,
          truckId: newTruckId,
        },
      }).catch((err) => console.warn("Notification failed:", err?.message));

      if (trip.driverId) {
        createNotification({
          userId: trip.driverId,
          type: "TRIP_DRIVER_UNASSIGNED",
          title: "You have been unassigned from a trip",
          message: `You have been unassigned from trip ${route}. Reason: ${driverReassignReason ?? reason}`,
          metadata: {
            tripId,
            loadId: trip.load?.id,
            previousTruckId: trip.truckId,
            newTruckId,
          },
        }).catch((err) => console.warn("Notification failed:", err?.message));
      }
    }

    return NextResponse.json({
      success: true,
      tripId,
      newTruckId,
      previousTruckId: trip.truckId,
      reassignedAt,
      // Task 9: driver reassignment info
      driverReassigned: !!newDriverId,
      newDriverId: newDriverId ?? null,
      previousDriverId: trip.driverId ?? null,
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

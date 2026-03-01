/**
 * Trip Cancellation API
 *
 * POST /api/trips/[tripId]/cancel - Cancel a trip
 *
 * Trips can be cancelled by carrier or shipper before COMPLETED status
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { createNotification, NotificationType } from "@/lib/notifications";
import { z } from "zod";
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";

const cancelTripSchema = z.object({
  reason: z.string().min(1, "Cancellation reason is required").max(500),
});

/**
 * POST /api/trips/[tripId]/cancel
 *
 * Cancel a trip
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "trip-cancel",
      ip,
      RPS_CONFIGS.write.rps,
      RPS_CONFIGS.write.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { tripId } = await params;
    const session = await requireActiveUser();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = cancelTripSchema.parse(body);

    // Get trip details
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
            users: {
              select: { id: true },
              take: 1,
            },
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
            users: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Cannot cancel COMPLETED, CANCELLED, or IN_TRANSIT trips
    if (trip.status === "COMPLETED") {
      return NextResponse.json(
        { error: "Cannot cancel a completed trip" },
        { status: 400 }
      );
    }

    if (trip.status === "CANCELLED") {
      return NextResponse.json(
        { error: "Trip is already cancelled" },
        { status: 400 }
      );
    }

    // H4 FIX: Block IN_TRANSIT cancellation — must go through EXCEPTION workflow
    if (trip.status === "IN_TRANSIT") {
      return NextResponse.json(
        {
          error:
            "Cannot cancel a trip that is in transit. Use the exception workflow instead.",
        },
        { status: 400 }
      );
    }

    // Check if user has permission to cancel
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isCarrier = user?.organizationId === trip.carrierId;
    const isShipper = user?.organizationId === trip.shipperId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isCarrier && !isShipper && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to cancel this trip" },
        { status: 403 }
      );
    }

    // Determine who is cancelling for notification purposes
    const cancelledByRole = isCarrier
      ? "Carrier"
      : isShipper
        ? "Shipper"
        : "Admin";

    // H2 FIX: If carrier/admin cancels, set load back to POSTED so shipper can find new carrier.
    // Only set to CANCELLED if shipper initiated the cancellation.
    const loadStatusAfterCancel = isShipper ? "CANCELLED" : "POSTED";

    // CRITICAL FIX: Wrap all state changes in a transaction for atomicity
    const updatedTrip = await db.$transaction(async (tx) => {
      // Update trip status to CANCELLED
      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: {
          status: "CANCELLED",
          cancelledAt: new Date(),
          cancelledBy: session.userId,
          cancelReason: validatedData.reason,
          trackingEnabled: false,
        },
      });

      // H2 FIX: Update Load status based on who cancelled
      await tx.load.update({
        where: { id: trip.loadId },
        data: {
          status: loadStatusAfterCancel,
          assignedTruckId: null,
          assignedAt: null,
          ...(loadStatusAfterCancel === "POSTED" && { postedAt: new Date() }),
        },
      });

      // H3 FIX: Restore truck availability after cancellation
      if (trip.truckId) {
        const otherActiveTrips = await tx.trip.count({
          where: {
            truckId: trip.truckId,
            id: { not: tripId },
            status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
          },
        });
        if (otherActiveTrips === 0) {
          await tx.truck.update({
            where: { id: trip.truckId },
            data: { isAvailable: true },
          });
        }
        // Revert MATCHED postings to ACTIVE so truck appears in searches again
        await tx.truckPosting.updateMany({
          where: { truckId: trip.truckId, status: "MATCHED" },
          data: { status: "ACTIVE", updatedAt: new Date() },
        });
      }

      // Create load event inside transaction
      await tx.loadEvent.create({
        data: {
          loadId: trip.loadId,
          eventType: "TRIP_CANCELLED",
          description: `Trip cancelled by ${cancelledByRole}. Load set to ${loadStatusAfterCancel}. Reason: ${validatedData.reason}`,
          userId: session.userId,
          metadata: {
            tripId,
            cancelledBy: cancelledByRole,
            reason: validatedData.reason,
            previousStatus: trip.status,
            loadStatusAfterCancel,
          },
        },
      });

      return updatedTrip;
    });

    // Cache invalidation after transaction commits
    await CacheInvalidation.trip(tripId, trip.carrierId, trip.shipperId);
    await CacheInvalidation.load(trip.loadId, trip.shipperId);

    // Notify the other party
    if (isCarrier || isAdmin) {
      // Notify shipper
      const shipperUserId = trip.shipper?.users?.[0]?.id;
      if (shipperUserId) {
        await createNotification({
          userId: shipperUserId,
          type: NotificationType.TRIP_CANCELLED,
          title: "Trip Cancelled",
          message: `${trip.carrier?.name || "Carrier"} has cancelled the trip ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}. Reason: ${validatedData.reason}`,
          metadata: { tripId, loadId: trip.loadId },
        });
      }
    }

    if (isShipper || isAdmin) {
      // Notify carrier
      const carrierUserId = trip.carrier?.users?.[0]?.id;
      if (carrierUserId) {
        await createNotification({
          userId: carrierUserId,
          type: NotificationType.TRIP_CANCELLED,
          title: "Trip Cancelled",
          message: `${trip.shipper?.name || "Shipper"} has cancelled the trip ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}. Reason: ${validatedData.reason}`,
          metadata: { tripId, loadId: trip.loadId },
        });
      }
    }

    return NextResponse.json({
      message: "Trip cancelled successfully",
      trip: {
        id: updatedTrip.id,
        status: updatedTrip.status,
        cancelledAt: updatedTrip.cancelledAt,
        cancelReason: updatedTrip.cancelReason,
      },
    });
  } catch (error) {
    return handleApiError(error, "Cancel trip error");
  }
}

/**
 * Trip Cancellation API
 *
 * POST /api/trips/[tripId]/cancel - Cancel a trip
 *
 * Trips can be cancelled by CARRIER or DISPATCHER per blueprint §7
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { notifyOrganization, NotificationType } from "@/lib/notifications";
import { z } from "zod";
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { Prisma } from "@prisma/client";
import { refundServiceFee } from "@/lib/serviceFeeManagement";

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
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
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

    // G-A11-2: DELIVERED is terminal-protection — cargo was already delivered.
    // State machine forbids DELIVERED→CANCELLED; cancel route must enforce same.
    if (trip.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Cannot cancel a delivered trip" },
        { status: 400 }
      );
    }

    // Check if user has permission to cancel
    // Blueprint §7: CARRIER or DISPATCHER can cancel. SHIPPER is not a cancel actor.
    const isCarrier =
      session.role === "CARRIER" && session.organizationId === trip.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    // Dispatchers are platform-level — they have their own org, not the carrier/shipper org
    const isDispatcher = session.role === "DISPATCHER";

    if (!isCarrier && !isAdmin && !isDispatcher) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Determine who is cancelling for notification purposes
    const cancelledByRole = isCarrier
      ? "Carrier"
      : isDispatcher
        ? "Dispatcher"
        : "Admin";

    // Blueprint §7: carrier/dispatcher/admin cancel reverts load to POSTED
    // so shipper can find a new carrier. Load is never set to CANCELLED by this route.
    const loadStatusAfterCancel = "POSTED";

    // CRITICAL FIX: Wrap all state changes in a transaction for atomicity
    const updatedTrip = await db.$transaction(async (tx) => {
      // Update trip status to CANCELLED — include status guard to prevent race condition
      const updatedTrip = await tx.trip.update({
        where: {
          id: tripId,
          status: {
            notIn: ["COMPLETED", "CANCELLED", "IN_TRANSIT", "DELIVERED"],
          },
        },
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

    // Refund service fee if fees were already deducted before this cancellation.
    // refundServiceFee() owns its own $transaction — must run outside this route's tx.
    // Non-blocking: trip is already cancelled; ops team handles via audit log.
    const loadFeeStatus = await db.load.findUnique({
      where: { id: trip.loadId },
      select: { shipperFeeStatus: true },
    });
    if (loadFeeStatus?.shipperFeeStatus === "DEDUCTED") {
      try {
        await refundServiceFee(trip.loadId);
      } catch (refundError) {
        console.error("Refund failed after trip cancellation:", refundError);
      }
    }

    // Blueprint §7 notification intent:
    // - Carrier cancels → notify shipper (carrier is the initiator, shipper is the other party)
    // - Dispatcher cancels → notify BOTH shipper AND carrier (dispatcher acts for platform)
    // - Admin cancels → notify BOTH shipper AND carrier
    // G-N3-9: Use notifyOrganization() to reach ALL active org users (not just first).

    const cancelMsg = `${cancelledByRole} has cancelled the trip ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}. Reason: ${validatedData.reason}`;
    const cancelMeta = { tripId, loadId: trip.loadId };

    // Notify shipper: when carrier, dispatcher, or admin cancels
    if (trip.shipperId) {
      await notifyOrganization({
        organizationId: trip.shipperId,
        type: NotificationType.TRIP_CANCELLED,
        title: "Trip Cancelled",
        message: cancelMsg,
        metadata: cancelMeta,
      });
    }

    // Notify carrier: when dispatcher or admin cancels (carrier cancels their own trip — they know)
    if ((isAdmin || isDispatcher) && trip.carrierId) {
      await notifyOrganization({
        organizationId: trip.carrierId,
        type: NotificationType.TRIP_CANCELLED,
        title: "Trip Cancelled",
        message: cancelMsg,
        metadata: cancelMeta,
      });
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
    // P2025: Trip status changed concurrently (e.g., completed while cancelling)
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
    return handleApiError(error, "Cancel trip error");
  }
}

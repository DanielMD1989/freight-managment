/**
 * Trip Delivery Confirmation API
 *
 * POST /api/trips/[tripId]/confirm - Shipper confirms delivery
 *
 * Blueprint v1.5: Shipper confirmation acts as proof of delivery acceptance.
 * POD upload by carrier is preferred but not required.
 * Shipper's digital confirmation is sufficient to close the trip.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import {
  notifyOrganization,
  createNotificationForRole,
  NotificationType,
} from "@/lib/notifications";
import { CacheInvalidation } from "@/lib/cache";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";
import { handleApiError } from "@/lib/apiErrors";
import { deductServiceFee } from "@/lib/serviceFeeManagement";

const confirmSchema = z.object({
  notes: z.string().max(1000).optional(),
});

/**
 * POST /api/trips/[tripId]/confirm
 *
 * Shipper confirms delivery after reviewing POD
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    // C15 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { tripId } = await params;
    const session = await requireActiveUser();

    // Parse request body for optional notes
    let confirmationNotes: string | null = null;
    try {
      const body = await request.json();
      const result = confirmSchema.safeParse(body);
      if (!result.success) {
        return zodErrorResponse(result.error);
      }
      confirmationNotes = result.data.notes || null;
    } catch {
      // No body provided - that's fine
    }

    // Get trip details
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            podSubmitted: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
          },
        },
        shipper: {
          select: { id: true },
        },
        podDocuments: {
          select: { id: true },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check authorization BEFORE business logic to avoid leaking trip state
    const isShipper =
      session.role === "SHIPPER" && session.organizationId === trip.shipperId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isShipper && !isAdmin) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // G-M21-9: Active trips always have loadId; capture as non-null
    const tripLoadId = trip.loadId!;

    // Only DELIVERED trips can be confirmed
    if (trip.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Trip must be in DELIVERED status to confirm" },
        { status: 400 }
      );
    }

    // Check if already confirmed
    if (trip.shipperConfirmed) {
      return NextResponse.json(
        { error: "Delivery has already been confirmed" },
        { status: 400 }
      );
    }

    // Blueprint v1.5: Shipper confirmation acts as proof of delivery acceptance.
    // POD upload by carrier is preferred but not required.
    // Shipper's digital confirmation is sufficient to close the trip.
    const hasPod = trip.podDocuments.length > 0 || trip.load?.podSubmitted;

    // CRITICAL FIX: Deduct service fee BEFORE transaction (blocking pattern)
    // Matches loads/[id]/status/route.ts which blocks completion on fee failure
    let serviceFeeResult: Awaited<ReturnType<typeof deductServiceFee>> | null =
      null;
    try {
      serviceFeeResult = await deductServiceFee(tripLoadId);
      if (!serviceFeeResult.success) {
        // "Service fees already deducted" is treated as success (idempotency)
        if (serviceFeeResult.error !== "Service fees already deducted") {
          // G-M21-8: Notify admin of fee failure
          createNotificationForRole({
            role: "ADMIN",
            type: NotificationType.SERVICE_FEE_FAILED,
            title: "Service fee deduction failed",
            message: `Fee deduction failed on confirm for trip ${tripId}: ${serviceFeeResult.error}`,
            metadata: { tripId, loadId: tripLoadId },
          }).catch(() => {});
          return NextResponse.json(
            {
              error: "Cannot confirm delivery: fee deduction failed",
              details: serviceFeeResult.error || "Unknown fee deduction error",
            },
            { status: 400 }
          );
        }
      }
    } catch (feeError: unknown) {
      console.error("Service fee deduction exception on confirm:", feeError);
      // G-M21-8: Notify admin of fee failure
      createNotificationForRole({
        role: "ADMIN",
        type: NotificationType.SERVICE_FEE_FAILED,
        title: "Service fee deduction failed",
        message: `Fee deduction exception on confirm for trip ${tripId}: ${feeError instanceof Error ? feeError.message : "Unknown error"}`,
        metadata: { tripId, loadId: tripLoadId },
      }).catch(() => {});
      return NextResponse.json(
        {
          error: "Cannot confirm delivery: fee deduction failed",
          details:
            feeError instanceof Error
              ? feeError.message
              : "Fee deduction exception",
        },
        { status: 400 }
      );
    }

    // Wrap all state changes in a transaction for atomicity
    const updatedTrip = await db.$transaction(async (tx) => {
      // H18 FIX: Re-check trip state inside transaction to prevent double-confirm
      const freshTrip = await tx.trip.findUnique({
        where: { id: tripId },
        select: { status: true, shipperConfirmed: true },
      });
      if (
        !freshTrip ||
        freshTrip.status !== "DELIVERED" ||
        freshTrip.shipperConfirmed
      ) {
        throw new Error("CONFIRM_CONFLICT");
      }

      // Update trip with confirmation
      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: {
          shipperConfirmed: true,
          shipperConfirmedAt: new Date(),
          shipperConfirmedBy: session.userId,
          status: "COMPLETED",
          completedAt: new Date(),
          trackingEnabled: false, // GPS stops on completion
        },
      });

      // Update Load model for backward compatibility
      await tx.load.update({
        where: { id: tripLoadId },
        data: {
          status: "COMPLETED",
          podVerified: true,
          podVerifiedAt: new Date(),
        },
      });

      // Create load event inside transaction
      await tx.loadEvent.create({
        data: {
          loadId: tripLoadId,
          eventType: "DELIVERY_CONFIRMED",
          description: confirmationNotes
            ? `Delivery confirmed by shipper. Notes: ${confirmationNotes}`
            : "Delivery confirmed by shipper",
          userId: session.userId,
          metadata: {
            tripId,
            confirmedAt: new Date().toISOString(),
          },
        },
      });

      // M12 FIX: Restore truck availability after trip completion
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
        // Revert MATCHED postings to ACTIVE
        await tx.truckPosting.updateMany({
          where: { truckId: trip.truckId, status: "MATCHED" },
          data: { status: "ACTIVE", updatedAt: new Date() },
        });
      }

      // G-A15-1: Only mark PAID when fees were actually collected (platformRevenue > 0)
      // or when the load is fee-waived (totalPlatformFee = 0, e.g. no corridor).
      // Using totalPlatformFee >= 0 was a bug: it was always true, marking PAID even
      // when wallets were empty and platformRevenue = 0 (nothing actually collected).
      const feeActuallySettled =
        serviceFeeResult?.success &&
        (serviceFeeResult.platformRevenue?.greaterThan(0) ||
          serviceFeeResult.totalPlatformFee === 0);
      if (feeActuallySettled) {
        await tx.load.update({
          where: { id: tripLoadId },
          data: { settlementStatus: "PAID", settledAt: new Date() },
        });
      }

      return updatedTrip;
    });

    // Fire-and-forget: Log fee event after transaction commits
    if (
      serviceFeeResult?.success &&
      serviceFeeResult.platformRevenue?.greaterThan(0)
    ) {
      db.loadEvent
        .create({
          data: {
            loadId: tripLoadId,
            eventType: "SERVICE_FEE_DEDUCTED",
            description: `Service fee deducted on delivery confirmation: Shipper ${serviceFeeResult.shipperFee.toFixed(2)} ETB, Carrier ${serviceFeeResult.carrierFee.toFixed(2)} ETB`,
            userId: session.userId,
            metadata: {
              shipperFee: serviceFeeResult.shipperFee,
              carrierFee: serviceFeeResult.carrierFee,
              totalPlatformFee: serviceFeeResult.totalPlatformFee,
              transactionId: serviceFeeResult.transactionId,
              trigger: "delivery_confirmation",
            },
          },
        })
        .catch((err: unknown) =>
          console.error("Failed to log fee event:", err)
        );
    }

    // Cache invalidation after transaction commits
    await CacheInvalidation.trip(
      tripId,
      trip.carrier?.id || "",
      trip.shipperId || ""
    );
    await CacheInvalidation.load(tripLoadId, trip.shipperId || "");

    // G-N3-8: Notify ALL active carrier org users that delivery has been confirmed (not just first)
    if (trip.carrier?.id) {
      await notifyOrganization({
        organizationId: trip.carrier.id,
        type: NotificationType.POD_VERIFIED,
        title: "Delivery Confirmed",
        message: `Shipper has confirmed delivery for trip ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}. Settlement can now proceed.`,
        metadata: { tripId, loadId: tripLoadId },
      });
    }

    // G-M21-7: If shipper confirmed without carrier POD, notify both parties
    if (!hasPod) {
      if (trip.carrier?.id) {
        notifyOrganization({
          organizationId: trip.carrier.id,
          type: NotificationType.DELIVERY_CONFIRMED,
          title: "Delivery confirmed without POD",
          message: `Shipper confirmed delivery of ${trip.load?.pickupCity} → ${trip.load?.deliveryCity} without POD upload. Trip is now COMPLETED.`,
          metadata: { tripId, loadId: tripLoadId },
        }).catch(() => {});
      }
      if (trip.shipperId) {
        notifyOrganization({
          organizationId: trip.shipperId,
          type: NotificationType.DELIVERY_CONFIRMED,
          title: "Delivery confirmation recorded",
          message: `Your confirmation for ${trip.load?.pickupCity} → ${trip.load?.deliveryCity} has been recorded. No carrier POD was uploaded — your confirmation serves as proof of acceptance.`,
          metadata: { tripId, loadId: tripLoadId },
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      message: "Delivery confirmed successfully. Trip completed.",
      trip: {
        id: updatedTrip.id,
        status: updatedTrip.status,
        shipperConfirmed: updatedTrip.shipperConfirmed,
        shipperConfirmedAt: updatedTrip.shipperConfirmedAt,
        completedAt: updatedTrip.completedAt,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "CONFIRM_CONFLICT") {
      return NextResponse.json(
        {
          error:
            "Trip has already been confirmed or is no longer in DELIVERED status",
        },
        { status: 409 }
      );
    }
    return handleApiError(error, "Confirm delivery error");
  }
}

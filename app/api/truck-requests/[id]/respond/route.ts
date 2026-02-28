/**
 * Truck Request Response API
 *
 * Phase 2 - Foundation Rule: CARRIER_FINAL_AUTHORITY
 *
 * Allows carriers to approve or reject truck requests from shippers.
 * Only the carrier who owns the truck can respond.
 *
 * POST: Approve or reject a request (CARRIER only)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { canApproveRequests } from "@/lib/dispatcherPermissions";
import { RULE_CARRIER_FINAL_AUTHORITY } from "@/lib/foundation-rules";
import { UserRole } from "@prisma/client";
import { enableTrackingForLoad } from "@/lib/gpsTracking";
import { notifyTruckRequestResponse } from "@/lib/notifications";
import crypto from "crypto";
// P0-003 FIX: Import CacheInvalidation for post-approval cache clearing
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";

// Validation schema for request response
const RequestResponseSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  responseNotes: z.string().max(500).optional(),
});

/**
 * POST /api/truck-requests/[id]/respond
 *
 * Respond to a truck request (approve or reject).
 *
 * Phase 2 Foundation Rule: CARRIER_FINAL_AUTHORITY
 * - Only the carrier who owns the truck can respond
 * - If approved, load is assigned to truck
 * - If rejected, request is marked as rejected
 *
 * Request body: RequestResponseSchema
 *
 * Returns: Updated request and load (if approved)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: requestId } = await params;
    const session = await requireActiveUser();

    // Get the request
    const truckRequest = await db.truckRequest.findUnique({
      where: { id: requestId },
      include: {
        truck: {
          select: {
            id: true,
            carrierId: true,
            licensePlate: true,
            imei: true,
            gpsVerifiedAt: true,
            carrier: {
              select: {
                name: true,
              },
            },
          },
        },
        load: {
          select: {
            id: true,
            status: true,
            assignedTruckId: true,
            shipperId: true, // P0-003 FIX: Needed for cache invalidation
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

    if (!truckRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Validate request body first (needed for idempotency check)
    const body = await request.json();
    const validationResult = RequestResponseSchema.safeParse(body);

    if (!validationResult.success) {
      // FIX: Use zodErrorResponse to avoid schema leak
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Check if request is still pending - handle idempotency
    if (truckRequest.status !== "PENDING") {
      // Idempotent: If already in the desired state, return success
      if (
        (truckRequest.status === "APPROVED" && data.action === "APPROVE") ||
        (truckRequest.status === "REJECTED" && data.action === "REJECT")
      ) {
        return NextResponse.json({
          request: truckRequest,
          message: `Request was already ${truckRequest.status.toLowerCase()}`,
          idempotent: true,
        });
      }

      return NextResponse.json(
        {
          error: `Request has already been ${truckRequest.status.toLowerCase()}`,
          currentStatus: truckRequest.status,
        },
        { status: 400 }
      );
    }

    // Check if request has expired
    if (new Date() > truckRequest.expiresAt) {
      // Mark as expired
      await db.truckRequest.update({
        where: { id: requestId },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json(
        { error: "Request has expired" },
        { status: 400 }
      );
    }

    // Check if user can approve (must be carrier who owns the truck)
    const user = {
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId,
    };

    if (!canApproveRequests(user, truckRequest.truck.carrierId)) {
      return NextResponse.json(
        {
          error: "You do not have permission to respond to this request",
          rule: RULE_CARRIER_FINAL_AUTHORITY.id,
          hint: "Only the carrier who owns the truck can respond",
        },
        { status: 403 }
      );
    }

    if (data.action === "APPROVE") {
      // P0-002 & P0-003 FIX: All checks and operations now inside atomic transaction
      // This prevents race conditions and ensures trip creation is atomic
      try {
        const result = await db.$transaction(async (tx) => {
          // P0-002 FIX: Re-fetch load inside transaction to prevent race condition
          const freshLoad = await tx.load.findUnique({
            where: { id: truckRequest.loadId },
            select: {
              id: true,
              status: true,
              assignedTruckId: true,
              shipperId: true,
              pickupCity: true,
              deliveryCity: true,
              pickupAddress: true,
              deliveryAddress: true,
              originLat: true,
              originLon: true,
              destinationLat: true,
              destinationLon: true,
              tripKm: true,
              estimatedTripKm: true,
            },
          });

          if (!freshLoad) {
            throw new Error("LOAD_NOT_FOUND");
          }

          // P0-002 FIX: Check availability INSIDE transaction
          if (freshLoad.assignedTruckId) {
            throw new Error("LOAD_ALREADY_ASSIGNED");
          }

          const requestableStatuses = ["POSTED", "SEARCHING", "OFFERED"];
          if (!requestableStatuses.includes(freshLoad.status)) {
            throw new Error(`LOAD_NOT_AVAILABLE:${freshLoad.status}`);
          }

          // Check if truck is already assigned to another active load
          const existingAssignment = await tx.load.findFirst({
            where: {
              assignedTruckId: truckRequest.truckId,
              status: {
                notIn: ["DELIVERED", "COMPLETED", "CANCELLED", "EXPIRED"],
              },
            },
            select: {
              id: true,
              pickupCity: true,
              deliveryCity: true,
              status: true,
            },
          });

          if (existingAssignment) {
            throw new Error(
              `TRUCK_BUSY:${existingAssignment.pickupCity}:${existingAssignment.deliveryCity}`
            );
          }

          // Unassign truck from any completed loads
          await tx.load.updateMany({
            where: {
              assignedTruckId: truckRequest.truckId,
              status: {
                in: ["DELIVERED", "COMPLETED", "CANCELLED", "EXPIRED"],
              },
            },
            data: { assignedTruckId: null },
          });

          // Update request to approved
          const updatedRequest = await tx.truckRequest.update({
            where: { id: requestId },
            data: {
              status: "APPROVED",
              respondedAt: new Date(),
              responseNotes: data.responseNotes,
              respondedById: session.userId,
            },
          });

          // Assign load to truck
          const updatedLoad = await tx.load.update({
            where: { id: truckRequest.loadId },
            data: {
              assignedTruckId: truckRequest.truckId,
              assignedAt: new Date(),
              status: "ASSIGNED",
            },
          });

          // P0-003 FIX: Create trip INSIDE transaction (atomic with assignment)
          const trackingUrl = `trip-${truckRequest.loadId.slice(-6)}-${crypto.randomBytes(12).toString("hex")}`;

          // Get truck details for trip creation
          const truck = await tx.truck.findUnique({
            where: { id: truckRequest.truckId },
            select: { carrierId: true },
          });

          const trip = await tx.trip.create({
            data: {
              loadId: truckRequest.loadId,
              truckId: truckRequest.truckId,
              carrierId: truck?.carrierId || truckRequest.truck.carrierId,
              shipperId: freshLoad.shipperId,
              status: "ASSIGNED",
              pickupLat: freshLoad.originLat,
              pickupLng: freshLoad.originLon,
              pickupAddress: freshLoad.pickupAddress,
              pickupCity: freshLoad.pickupCity,
              deliveryLat: freshLoad.destinationLat,
              deliveryLng: freshLoad.destinationLon,
              deliveryAddress: freshLoad.deliveryAddress,
              deliveryCity: freshLoad.deliveryCity,
              estimatedDistanceKm:
                freshLoad.tripKm || freshLoad.estimatedTripKm,
              trackingUrl,
              trackingEnabled: true,
            },
          });

          // Create load event
          await tx.loadEvent.create({
            data: {
              loadId: truckRequest.loadId,
              eventType: "ASSIGNED",
              description: `Load assigned via shipper request (approved by carrier). Truck: ${truckRequest.truck.licensePlate}`,
              userId: session.userId,
              metadata: {
                requestId: requestId,
                approvedViaRequest: true,
                shipperName: truckRequest.shipper.name,
                tripId: trip.id,
              },
            },
          });

          // Cancel other pending requests for this load
          await tx.truckRequest.updateMany({
            where: {
              loadId: truckRequest.loadId,
              id: { not: requestId },
              status: "PENDING",
            },
            data: { status: "CANCELLED" },
          });

          // Cancel pending load requests
          await tx.loadRequest.updateMany({
            where: {
              loadId: truckRequest.loadId,
              status: "PENDING",
            },
            data: { status: "CANCELLED" },
          });

          // Cancel pending match proposals
          await tx.matchProposal.updateMany({
            where: {
              loadId: truckRequest.loadId,
              status: "PENDING",
            },
            data: { status: "CANCELLED" },
          });

          // Mark truck posting as MATCHED so it disappears from loadboard
          await tx.truckPosting.updateMany({
            where: { truckId: truckRequest.truckId, status: "ACTIVE" },
            data: { status: "MATCHED", updatedAt: new Date() },
          });
          // Mark truck as unavailable
          await tx.truck.update({
            where: { id: truckRequest.truckId },
            data: { isAvailable: false },
          });

          return { request: updatedRequest, load: updatedLoad, trip };
        });

        // P0-003 FIX: Invalidate cache after approval to prevent stale data
        // This ensures the load no longer appears as available in searches
        // Note: truck() invalidation also clears matching:* and truck-postings:* caches
        await CacheInvalidation.load(
          truckRequest.loadId,
          truckRequest.load.shipperId
        );
        await CacheInvalidation.truck(
          truckRequest.truckId,
          truckRequest.truck.carrierId
        );

        // Non-critical: Enable GPS tracking outside transaction (fire-and-forget)
        let trackingUrl: string | null = result.trip?.trackingUrl || null;
        if (truckRequest.truck.imei && truckRequest.truck.gpsVerifiedAt) {
          enableTrackingForLoad(truckRequest.loadId, truckRequest.truckId)
            .then((url) => {
              if (url) trackingUrl = url;
            })
            .catch((err) =>
              console.error("Failed to enable GPS tracking:", err)
            );
        }

        // Non-critical: Send notification (fire-and-forget)
        if (truckRequest.shipper?.id) {
          notifyTruckRequestResponse({
            shipperId: truckRequest.shipper.id,
            carrierName: truckRequest.truck.carrier?.name || "Carrier",
            truckPlate: truckRequest.truck.licensePlate,
            approved: true,
            requestId: requestId,
            loadId: truckRequest.loadId,
          }).catch((err) => console.error("Failed to send notification:", err));
        }

        return NextResponse.json({
          request: result.request,
          load: result.load,
          trip: result.trip,
          trackingUrl,
          message: "Request approved. Load has been assigned to your truck.",
          rule: RULE_CARRIER_FINAL_AUTHORITY.id,
        });

        // FIX: Use unknown type with type guard
      } catch (error: unknown) {
        // Handle specific transaction errors
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage === "LOAD_NOT_FOUND") {
          return NextResponse.json(
            { error: "Load not found" },
            { status: 404 }
          );
        }
        if (errorMessage === "LOAD_ALREADY_ASSIGNED") {
          return NextResponse.json(
            { error: "Load has already been assigned to another truck" },
            { status: 409 }
          );
        }
        if (errorMessage.startsWith("LOAD_NOT_AVAILABLE:")) {
          const status = errorMessage.split(":")[1];
          return NextResponse.json(
            { error: `Load is no longer available (status: ${status})` },
            { status: 400 }
          );
        }
        if (errorMessage.startsWith("TRUCK_BUSY:")) {
          const [, pickup, delivery] = errorMessage.split(":");
          return NextResponse.json(
            {
              error: `This truck is already assigned to an active load (${pickup} → ${delivery})`,
            },
            { status: 400 }
          );
        }
        throw error; // Re-throw for generic error handling
      }
    } else {
      // HIGH FIX #6: Wrap REJECT path in transaction for atomicity
      const updatedRequest = await db.$transaction(async (tx) => {
        const updatedRequest = await tx.truckRequest.update({
          where: { id: requestId },
          data: {
            status: "REJECTED",
            respondedAt: new Date(),
            responseNotes: data.responseNotes,
            respondedById: session.userId,
          },
        });

        // Create load event inside transaction
        await tx.loadEvent.create({
          data: {
            loadId: truckRequest.loadId,
            eventType: "REQUEST_REJECTED",
            description: `Truck request rejected by carrier. Truck: ${truckRequest.truck.licensePlate}`,
            userId: session.userId,
            metadata: {
              requestId: requestId,
              rejectionReason: data.responseNotes,
            },
          },
        });

        return updatedRequest;
      });

      // B5 FIX: Invalidate cache on REJECT (APPROVE path already does this)
      await CacheInvalidation.load(
        truckRequest.loadId,
        truckRequest.load?.shipperId
      );

      // Non-critical: Send notification to shipper (fire-and-forget, outside transaction)
      if (truckRequest.shipper?.id) {
        notifyTruckRequestResponse({
          shipperId: truckRequest.shipper.id,
          carrierName: truckRequest.truck.carrier?.name || "Carrier",
          truckPlate: truckRequest.truck.licensePlate,
          approved: false,
          requestId: requestId,
          loadId: truckRequest.loadId,
        }).catch((err) => console.error("Failed to send notification:", err));
      }

      return NextResponse.json({
        request: updatedRequest,
        message: "Request rejected.",
      });
    }
    // FIX: Use unknown type with type guard
  } catch (error: unknown) {
    // Handle unique constraint violation (race condition) - Prisma error
    const prismaError = error as {
      code?: string;
      meta?: { target?: string[] };
    };
    if (prismaError?.code === "P2002") {
      console.error("Error responding to truck request:", error);
      const field = prismaError?.meta?.target?.[0] || "field";
      if (field === "assignedTruckId") {
        return NextResponse.json(
          {
            error:
              "This truck is already assigned to another load. Please refresh and try again.",
          },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "A conflict occurred. Please refresh and try again." },
        { status: 409 }
      );
    }

    return handleApiError(error, "Error responding to truck request");
  }
}

/**
 * Load Request Confirm API
 *
 * G-A9-2: Carrier Final Confirmation step.
 *
 * After Shipper approves (SHIPPER_APPROVED), the Carrier must confirm or decline
 * before the Trip is created and the load/truck are removed from the marketplace.
 *
 * POST /api/load-requests/[id]/confirm
 *   action: "CONFIRM" | "DECLINE"
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import {
  createNotification,
  notifyOrganization,
  NotificationType,
} from "@/lib/notifications";
import { enableTrackingForLoad } from "@/lib/gpsTracking";
import crypto from "crypto";
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";

const ConfirmSchema = z.object({
  action: z.enum(["CONFIRM", "DECLINE"]),
  responseNotes: z.string().max(500).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "load-request-confirm",
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

    const { id: requestId } = await params;
    const session = await requireActiveUser();

    const loadRequest = await db.loadRequest.findUnique({
      where: { id: requestId },
      include: {
        load: {
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
        },
        truck: {
          select: {
            id: true,
            licensePlate: true,
            carrierId: true,
            approvalStatus: true, // G-M12-2c: needed for approval re-check
            imei: true,
            gpsVerifiedAt: true,
          },
        },
        carrier: {
          select: { id: true, name: true },
        },
      },
    });

    if (!loadRequest) {
      return NextResponse.json(
        { error: "Load request not found" },
        { status: 404 }
      );
    }

    // Auth: CARRIER who owns the truck, or ADMIN
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isCarrierOwner =
      session.role === "CARRIER" &&
      session.organizationId === loadRequest.truck.carrierId;

    if (!isCarrierOwner && !isAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // G-M12-2c: Re-check truck approval status (TOCTOU — truck may have been rejected after request was created)
    if (loadRequest.truck.approvalStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Cannot proceed — truck is no longer approved" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validationResult = ConfirmSchema.safeParse(body);
    if (!validationResult.success) {
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Pre-condition: must be SHIPPER_APPROVED
    if (loadRequest.status !== "SHIPPER_APPROVED") {
      return NextResponse.json(
        {
          error: `Load request is not awaiting carrier confirmation (status: ${loadRequest.status})`,
          currentStatus: loadRequest.status,
        },
        { status: 400 }
      );
    }

    if (data.action === "CONFIRM") {
      try {
        const result = await db.$transaction(async (tx) => {
          // Race guard: re-check status
          const fresh = await tx.loadRequest.findUnique({
            where: { id: requestId },
            select: { status: true },
          });
          if (!fresh || fresh.status !== "SHIPPER_APPROVED") {
            throw new Error("REQUEST_ALREADY_PROCESSED");
          }

          // Re-fetch load inside transaction
          const freshLoad = await tx.load.findUnique({
            where: { id: loadRequest.loadId },
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

          if (!freshLoad) throw new Error("LOAD_NOT_FOUND");
          if (freshLoad.assignedTruckId)
            throw new Error("LOAD_ALREADY_ASSIGNED");

          const availableStatuses = ["POSTED", "SEARCHING", "OFFERED"];
          if (!availableStatuses.includes(freshLoad.status)) {
            throw new Error(`LOAD_NOT_AVAILABLE:${freshLoad.status}`);
          }

          // Check truck has no active trip
          const activeTripCount = await tx.trip.count({
            where: {
              truckId: loadRequest.truckId,
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
          if (activeTripCount > 0) {
            throw new Error("TRUCK_BUSY_TRIP");
          }

          // Unassign truck from completed loads
          await tx.load.updateMany({
            where: {
              assignedTruckId: loadRequest.truckId,
              status: {
                in: ["DELIVERED", "COMPLETED", "CANCELLED", "EXPIRED"],
              },
            },
            data: { assignedTruckId: null },
          });

          // Mark request APPROVED with confirmation fields
          const updatedRequest = await tx.loadRequest.update({
            where: { id: requestId },
            data: {
              status: "APPROVED",
              confirmedAt: new Date(),
              confirmedById: session.userId,
            },
          });

          // Assign load
          const updatedLoad = await tx.load.update({
            where: { id: loadRequest.loadId },
            data: {
              assignedTruckId: loadRequest.truckId,
              assignedAt: new Date(),
              status: "ASSIGNED",
            },
          });

          // Create trip
          const trackingUrl = `trip-${loadRequest.loadId.slice(-6)}-${crypto.randomBytes(12).toString("hex")}`;
          const trip = await tx.trip.create({
            data: {
              loadId: loadRequest.loadId,
              truckId: loadRequest.truckId,
              carrierId: loadRequest.carrierId,
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
              loadId: loadRequest.loadId,
              eventType: "ASSIGNED",
              description: `Load assigned to ${loadRequest.carrier.name} (${loadRequest.truck.licensePlate}) — carrier confirmed booking`,
              userId: session.userId,
              metadata: {
                loadRequestId: requestId,
                carrierId: loadRequest.carrierId,
                tripId: trip.id,
              },
            },
          });

          // Capture affected org IDs before cancellation (for post-tx notifications)
          const pendingLoadReqsForLoad = await tx.loadRequest.findMany({
            where: {
              loadId: loadRequest.loadId,
              id: { not: requestId },
              status: { in: ["PENDING", "SHIPPER_APPROVED"] },
            },
            select: { carrierId: true },
          });
          const pendingLoadReqsForTruck = await tx.loadRequest.findMany({
            where: {
              truckId: loadRequest.truckId,
              id: { not: requestId },
              status: { in: ["PENDING", "SHIPPER_APPROVED"] },
            },
            select: { carrierId: true },
          });
          const pendingLoadReqsToCancel = [
            ...pendingLoadReqsForLoad,
            ...pendingLoadReqsForTruck,
          ];
          const pendingTruckReqsToCancel = await tx.truckRequest.findMany({
            where: { loadId: loadRequest.loadId, status: "PENDING" },
            select: { shipperId: true },
          });
          const pendingMatchPropsToCancel = await tx.matchProposal.findMany({
            where: { loadId: loadRequest.loadId, status: "PENDING" },
            select: { carrierId: true, proposedById: true },
          });

          // G-A9-5: Cancel ALL other PENDING/SHIPPER_APPROVED load requests for same load
          await tx.loadRequest.updateMany({
            where: {
              loadId: loadRequest.loadId,
              id: { not: requestId },
              status: { in: ["PENDING", "SHIPPER_APPROVED"] },
            },
            data: { status: "CANCELLED" },
          });

          // G-A9-5: Cancel ALL other PENDING/SHIPPER_APPROVED load requests for same truck (cross-load)
          await tx.loadRequest.updateMany({
            where: {
              truckId: loadRequest.truckId,
              id: { not: requestId },
              status: { in: ["PENDING", "SHIPPER_APPROVED"] },
            },
            data: { status: "CANCELLED" },
          });

          // Cancel pending truck requests for same load
          await tx.truckRequest.updateMany({
            where: { loadId: loadRequest.loadId, status: "PENDING" },
            data: { status: "CANCELLED" },
          });

          // Cancel pending match proposals for same load
          await tx.matchProposal.updateMany({
            where: { loadId: loadRequest.loadId, status: "PENDING" },
            data: { status: "CANCELLED" },
          });

          // Mark truck posting MATCHED
          await tx.truckPosting.updateMany({
            where: { truckId: loadRequest.truckId, status: "ACTIVE" },
            data: { status: "MATCHED", updatedAt: new Date() },
          });

          // Mark truck as unavailable
          await tx.truck.update({
            where: { id: loadRequest.truckId },
            data: { isAvailable: false },
          });

          return {
            request: updatedRequest,
            load: updatedLoad,
            trip,
            pendingLoadReqsToCancel,
            pendingTruckReqsToCancel,
            pendingMatchPropsToCancel,
          };
        });

        await CacheInvalidation.load(
          loadRequest.loadId,
          loadRequest.load.shipperId
        );
        await CacheInvalidation.truck(
          loadRequest.truckId,
          loadRequest.truck.carrierId
        );

        // Non-critical: Notify parties whose competing requests were cancelled (fire-and-forget)
        Promise.all([
          ...result.pendingLoadReqsToCancel.map(({ carrierId }) =>
            notifyOrganization({
              organizationId: carrierId,
              type: NotificationType.LOAD_REQUEST_REJECTED,
              title: "Request No Longer Available",
              message:
                "Your load request was cancelled — the load has been assigned.",
            })
          ),
          ...result.pendingTruckReqsToCancel.map(({ shipperId }) =>
            notifyOrganization({
              organizationId: shipperId,
              type: NotificationType.TRUCK_REQUEST_REJECTED,
              title: "Request No Longer Available",
              message:
                "Your truck request was cancelled — the load has been assigned to another carrier.",
            })
          ),
          ...result.pendingMatchPropsToCancel.flatMap(
            ({ carrierId, proposedById }) => [
              notifyOrganization({
                organizationId: carrierId,
                type: NotificationType.MATCH_PROPOSAL_REJECTED,
                title: "Match Proposal Cancelled",
                message: "The load was assigned to another truck.",
              }),
              createNotification({
                userId: proposedById,
                type: NotificationType.MATCH_PROPOSAL_REJECTED,
                title: "Match Proposal Cancelled",
                message: "The load was assigned to another truck.",
              }),
            ]
          ),
        ]).catch((err) =>
          console.error("Cancellation notifications failed:", err)
        );

        // Non-critical: Enable GPS tracking (fire-and-forget)
        let trackingUrl: string | null = result.trip?.trackingUrl || null;
        if (loadRequest.truck.imei && loadRequest.truck.gpsVerifiedAt) {
          enableTrackingForLoad(loadRequest.loadId, loadRequest.truckId)
            .then((url) => {
              if (url) trackingUrl = url;
            })
            .catch((err) =>
              console.error("Failed to enable GPS tracking:", err)
            );
        }

        // Non-critical: Notify Shipper users (fire-and-forget)
        db.user
          .findMany({
            where: {
              organizationId: loadRequest.load.shipperId,
              status: "ACTIVE",
            },
            select: { id: true },
          })
          .then(async (users) => {
            for (const u of users) {
              await createNotification({
                userId: u.id,
                type: NotificationType.LOAD_ASSIGNED,
                title: "Carrier Confirmed Booking",
                message: `Carrier confirmed booking — load from ${loadRequest.load.pickupCity} to ${loadRequest.load.deliveryCity} is now assigned to truck ${loadRequest.truck.licensePlate}.`,
                metadata: {
                  loadRequestId: requestId,
                  loadId: loadRequest.loadId,
                  truckId: loadRequest.truckId,
                  tripId: result.trip.id,
                },
              });
            }
          })
          .catch((err) => console.error("Failed to notify shipper:", err));

        return NextResponse.json({
          request: result.request,
          load: result.load,
          trip: result.trip,
          trackingUrl,
          message:
            "Booking confirmed. Load has been assigned and trip created.",
        });
      } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : "";
        if (msg === "REQUEST_ALREADY_PROCESSED") {
          return NextResponse.json(
            { error: "Request has already been processed" },
            { status: 409 }
          );
        }
        if (msg === "LOAD_NOT_FOUND") {
          return NextResponse.json(
            { error: "Load not found" },
            { status: 404 }
          );
        }
        if (msg === "LOAD_ALREADY_ASSIGNED") {
          return NextResponse.json(
            { error: "Load has already been assigned to another truck" },
            { status: 409 }
          );
        }
        if (msg.startsWith("LOAD_NOT_AVAILABLE:")) {
          const s = msg.split(":")[1];
          return NextResponse.json(
            { error: `Load is no longer available (status: ${s})` },
            { status: 400 }
          );
        }
        if (msg === "TRUCK_BUSY_TRIP") {
          return NextResponse.json(
            {
              error:
                "Truck is currently on an active trip and cannot be assigned",
            },
            { status: 409 }
          );
        }
        throw error;
      }
    } else {
      // DECLINE: carrier declines to confirm
      const updatedRequest = await db.loadRequest.update({
        where: { id: requestId },
        data: { status: "CANCELLED" },
      });

      await db.loadEvent.create({
        data: {
          loadId: loadRequest.loadId,
          eventType: "LOAD_REQUEST_CANCELLED",
          description: `Carrier declined to confirm booking for load request`,
          userId: session.userId,
          metadata: {
            loadRequestId: requestId,
            carrierId: loadRequest.carrierId,
          },
        },
      });

      // G-A9-3: Revert load SEARCHING → POSTED if no other active requests remain
      const remaining = await db.loadRequest.count({
        where: {
          loadId: loadRequest.loadId,
          status: { in: ["PENDING", "SHIPPER_APPROVED"] },
          id: { not: requestId },
        },
      });
      if (remaining === 0) {
        await db.load.update({
          where: {
            id: loadRequest.loadId,
            status: { in: ["SEARCHING", "OFFERED"] },
          },
          data: { status: "POSTED" },
        });
      }

      await CacheInvalidation.load(
        loadRequest.loadId,
        loadRequest.load.shipperId
      );

      // Non-critical: Notify Shipper users (fire-and-forget)
      db.user
        .findMany({
          where: {
            organizationId: loadRequest.load.shipperId,
            status: "ACTIVE",
          },
          select: { id: true },
        })
        .then(async (users) => {
          for (const u of users) {
            await createNotification({
              userId: u.id,
              type: "LOAD_REQUEST_REJECTED",
              title: "Carrier Declined Booking",
              message: `Carrier declined to confirm the booking for the load from ${loadRequest.load.pickupCity} to ${loadRequest.load.deliveryCity}.`,
              metadata: {
                loadRequestId: requestId,
                loadId: loadRequest.loadId,
              },
            });
          }
        })
        .catch((err) => console.error("Failed to notify shipper:", err));

      return NextResponse.json({
        request: updatedRequest,
        message: "Carrier declined to confirm. Load returned to marketplace.",
      });
    }
  } catch (error) {
    return handleApiError(error, "Error confirming load request");
  }
}

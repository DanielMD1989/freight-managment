/**
 * Match Proposal Response API
 *
 * Phase 2 - Foundation Rule: CARRIER_FINAL_AUTHORITY
 *
 * Allows carriers to accept or reject match proposals.
 * Only the carrier who owns the truck can respond.
 *
 * POST: Accept or reject a proposal (CARRIER only)
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
// P0-007 FIX: Import CacheInvalidation for post-acceptance cache clearing
import { CacheInvalidation } from "@/lib/cache";
import crypto from "crypto";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import {
  createNotification,
  notifyOrganization,
  NotificationType,
} from "@/lib/notifications";
import { handleApiError } from "@/lib/apiErrors";

// Validation schema for proposal response
const ProposalResponseSchema = z.object({
  action: z.enum(["ACCEPT", "REJECT"]),
  responseNotes: z.string().max(500).optional(),
});

/**
 * POST /api/match-proposals/[id]/respond
 *
 * Respond to a match proposal (accept or reject).
 *
 * Phase 2 Foundation Rule: CARRIER_FINAL_AUTHORITY
 * - Only the carrier who owns the truck can respond
 * - If accepted, load is assigned to truck
 * - If rejected, proposal is marked as rejected
 *
 * Request body: ProposalResponseSchema
 *
 * Returns: Updated proposal and load (if accepted)
 */
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
      "match-proposal-respond",
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

    // C13 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: proposalId } = await params;
    // C14 FIX: Use requireActiveUser to block suspended users
    const session = await requireActiveUser();

    // Get the proposal
    const proposal = await db.matchProposal.findUnique({
      where: { id: proposalId },
      include: {
        truck: {
          select: {
            id: true,
            carrierId: true,
            licensePlate: true,
            approvalStatus: true, // G-M12-2d: needed for approval re-check
            imei: true,
            gpsVerifiedAt: true,
          },
        },
        load: {
          select: {
            id: true,
            status: true,
            assignedTruckId: true,
            shipperId: true, // P0-007 FIX: Needed for cache invalidation
            pickupCity: true,
            deliveryCity: true,
          },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    // Fix 1g: Parse body before status check (needed for idempotency)
    const body = await request.json();
    const validationResult = ProposalResponseSchema.safeParse(body);

    if (!validationResult.success) {
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Fix 1d: Idempotency — if proposal already responded with same action, return success
    if (proposal.status !== "PENDING") {
      if (
        (proposal.status === "ACCEPTED" && data.action === "ACCEPT") ||
        (proposal.status === "REJECTED" && data.action === "REJECT")
      ) {
        return NextResponse.json({
          proposal,
          message: `Proposal was already ${proposal.status.toLowerCase()}`,
          idempotent: true,
        });
      }
      return NextResponse.json(
        {
          error: `Proposal has already been ${proposal.status.toLowerCase()}`,
          currentStatus: proposal.status,
        },
        { status: 400 }
      );
    }

    // Check if proposal has expired
    if (new Date() > proposal.expiresAt) {
      // Mark as expired
      await db.matchProposal.update({
        where: { id: proposalId },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json(
        { error: "Proposal has expired" },
        { status: 400 }
      );
    }

    // Check if user can approve (must be carrier who owns the truck)
    const user = {
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId,
    };

    if (!canApproveRequests(user, proposal.truck.carrierId)) {
      return NextResponse.json(
        { error: "Proposal not found" },
        { status: 404 }
      );
    }

    // G-M12-2d: Re-check truck approval status (TOCTOU — truck may have been rejected after request was created)
    if (proposal.truck.approvalStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Cannot proceed — truck is no longer approved" },
        { status: 400 }
      );
    }

    if (data.action === "ACCEPT") {
      // P0-007 FIX: All checks and operations now inside atomic transaction
      // with fresh re-fetch to prevent race conditions
      // FIX: Use explicit interface for transaction result
      let result: {
        proposal: Record<string, unknown>;
        load: Record<string, unknown>;
        trip: Record<string, unknown> & { trackingUrl?: string | null };
        pendingMatchPropsToCancel: Array<{
          carrierId: string;
          proposedById: string;
        }>;
        pendingLoadReqsToCancel: Array<{ carrierId: string }>;
        pendingTruckReqsToCancel: Array<{ shipperId: string }>;
      };

      try {
        result = await db.$transaction(async (tx) => {
          // Re-check proposal status inside transaction to prevent double-accept
          const freshProposal = await tx.matchProposal.findUnique({
            where: { id: proposalId },
            select: { status: true },
          });
          if (!freshProposal || freshProposal.status !== "PENDING") {
            throw new Error("PROPOSAL_ALREADY_PROCESSED");
          }

          // P0-007 FIX: Fresh re-fetch load inside transaction to prevent race condition
          const freshLoad = await tx.load.findUnique({
            where: { id: proposal.loadId },
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

          // Check load is still available (race condition protection)
          if (freshLoad.assignedTruckId) {
            throw new Error("LOAD_ALREADY_ASSIGNED");
          }

          const proposableStatuses = ["POSTED", "SEARCHING", "OFFERED"];
          if (!proposableStatuses.includes(freshLoad.status)) {
            throw new Error(`LOAD_NOT_AVAILABLE:${freshLoad.status}`);
          }

          // Check if truck is already assigned to another active load
          const existingAssignment = await tx.load.findFirst({
            where: {
              assignedTruckId: proposal.truckId,
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

          // Unassign truck from any completed loads (cleanup)
          await tx.load.updateMany({
            where: {
              assignedTruckId: proposal.truckId,
              status: {
                in: ["DELIVERED", "COMPLETED", "CANCELLED", "EXPIRED"],
              },
            },
            data: { assignedTruckId: null },
          });

          // Update proposal to accepted
          const updatedProposal = await tx.matchProposal.update({
            where: { id: proposalId },
            data: {
              status: "ACCEPTED",
              respondedAt: new Date(),
              responseNotes: data.responseNotes,
              respondedById: session.userId,
            },
          });

          // Assign load to truck
          const updatedLoad = await tx.load.update({
            where: { id: proposal.loadId },
            data: {
              assignedTruckId: proposal.truckId,
              assignedAt: new Date(),
              status: "ASSIGNED",
            },
          });

          // Create Trip record inside transaction (atomic with assignment)
          const trackingUrl = `trip-${proposal.loadId.slice(-6)}-${crypto.randomBytes(12).toString("hex")}`;

          const trip = await tx.trip.create({
            data: {
              loadId: proposal.loadId,
              truckId: proposal.truckId,
              carrierId: proposal.truck.carrierId,
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

          // Create load event inside transaction
          await tx.loadEvent.create({
            data: {
              loadId: proposal.loadId,
              eventType: "ASSIGNED",
              description: `Load assigned via match proposal (accepted by carrier). Truck: ${proposal.truck.licensePlate}`,
              userId: session.userId,
              metadata: {
                proposalId: proposalId,
                acceptedViaProposal: true,
                tripId: trip.id,
              },
            },
          });

          // Capture affected org IDs before cancellation (for post-tx notifications)
          const pendingMatchPropsToCancel = await tx.matchProposal.findMany({
            where: {
              loadId: proposal.loadId,
              id: { not: proposalId },
              status: "PENDING",
            },
            select: { carrierId: true, proposedById: true },
          });
          const pendingLoadReqsToCancel = await tx.loadRequest.findMany({
            where: { loadId: proposal.loadId, status: "PENDING" },
            select: { carrierId: true },
          });
          const pendingTruckReqsToCancel = await tx.truckRequest.findMany({
            where: { loadId: proposal.loadId, status: "PENDING" },
            select: { shipperId: true },
          });

          // Cancel other pending proposals for this load
          await tx.matchProposal.updateMany({
            where: {
              loadId: proposal.loadId,
              id: { not: proposalId },
              status: "PENDING",
            },
            data: { status: "CANCELLED" },
          });

          // Cancel pending load/truck requests
          await tx.loadRequest.updateMany({
            where: { loadId: proposal.loadId, status: "PENDING" },
            data: { status: "CANCELLED" },
          });

          await tx.truckRequest.updateMany({
            where: { loadId: proposal.loadId, status: "PENDING" },
            data: { status: "CANCELLED" },
          });

          // Mark truck posting as MATCHED so it disappears from loadboard
          await tx.truckPosting.updateMany({
            where: { truckId: proposal.truckId, status: "ACTIVE" },
            data: { status: "MATCHED", updatedAt: new Date() },
          });
          // Mark truck as unavailable
          await tx.truck.update({
            where: { id: proposal.truckId },
            data: { isAvailable: false },
          });

          return {
            proposal: updatedProposal,
            load: updatedLoad,
            trip,
            pendingMatchPropsToCancel,
            pendingLoadReqsToCancel,
            pendingTruckReqsToCancel,
          };
        });
        // H8 FIX: Use unknown type with type guard
      } catch (error: unknown) {
        // Handle specific transaction errors
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage === "PROPOSAL_ALREADY_PROCESSED") {
          return NextResponse.json(
            { error: "This proposal has already been processed" },
            { status: 409 }
          );
        }
        if (errorMessage === "LOAD_NOT_FOUND") {
          return NextResponse.json(
            { error: "Load not found" },
            { status: 404 }
          );
        }
        if (errorMessage === "LOAD_ALREADY_ASSIGNED") {
          return NextResponse.json(
            {
              error:
                "Load has already been assigned to another truck. Please refresh and try again.",
            },
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
        // Fix 1e: Normalize to 400 to match sibling routes
        if (errorMessage.startsWith("TRUCK_BUSY:")) {
          const [, pickup, delivery] = errorMessage.split(":");
          return NextResponse.json(
            {
              error: `This truck is already assigned to an active load (${pickup} → ${delivery})`,
            },
            { status: 400 }
          );
        }
        throw error;
      }

      // P0-007 FIX: Cache invalidation after transaction commits
      await CacheInvalidation.load(proposal.loadId, proposal.load.shipperId);
      await CacheInvalidation.truck(proposal.truckId, proposal.truck.carrierId);

      // Non-critical: Notify parties whose competing requests were cancelled (fire-and-forget)
      Promise.all([
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
      ]).catch((err) =>
        console.error("Cancellation notifications failed:", err)
      );

      // SERVICE FEE NOTE: Wallet balances were validated before acceptance.
      // Actual fee deduction happens on trip completion (deductServiceFee).
      // No reservation/hold is needed - validation ensures balance is sufficient.

      // Non-critical: Enable GPS tracking (outside transaction, fire-and-forget)
      let trackingUrl: string | null = result.trip?.trackingUrl || null;
      if (proposal.truck.imei && proposal.truck.gpsVerifiedAt) {
        try {
          const gpsUrl = await enableTrackingForLoad(
            proposal.loadId,
            proposal.truckId
          );
          if (gpsUrl) trackingUrl = gpsUrl;
        } catch (error) {
          console.error("Failed to enable GPS tracking:", error);
        }
      }

      // Fix 1a: Notify shipper users that their load has been assigned
      const shipperUsers = await db.user.findMany({
        where: { organizationId: proposal.load.shipperId, status: "ACTIVE" },
        select: { id: true },
      });
      for (const u of shipperUsers) {
        createNotification({
          userId: u.id,
          type: NotificationType.MATCH_PROPOSAL_ACCEPTED,
          title: "Load Matched",
          message: `Your load from ${proposal.load.pickupCity} to ${proposal.load.deliveryCity} has been matched with a truck.`,
          metadata: {
            proposalId,
            loadId: proposal.loadId,
            truckId: proposal.truckId,
          },
        }).catch((err) => console.error("Failed to notify shipper:", err));
      }
      // Notify the dispatcher who proposed the match
      createNotification({
        userId: proposal.proposedById,
        type: NotificationType.MATCH_PROPOSAL_ACCEPTED,
        title: "Match Proposal Accepted",
        message: `Carrier accepted your match proposal for load ${proposal.load.pickupCity} → ${proposal.load.deliveryCity}.`,
        metadata: {
          proposalId,
          loadId: proposal.loadId,
          truckId: proposal.truckId,
        },
      }).catch((err) => console.error("Failed to notify dispatcher:", err));

      // Fix 1f: Remove walletValidation from response — carrier should not see fee breakdowns
      return NextResponse.json({
        proposal: result.proposal,
        load: result.load,
        trip: result.trip,
        trackingUrl,
        message: "Proposal accepted. Load has been assigned to your truck.",
        rule: RULE_CARRIER_FINAL_AUTHORITY.id,
      });
    } else {
      // REJECT — Fix 1b: Wrap in transaction for consistency
      const updatedProposal = await db.$transaction(async (tx) => {
        const rejected = await tx.matchProposal.update({
          where: { id: proposalId },
          data: {
            status: "REJECTED",
            respondedAt: new Date(),
            responseNotes: data.responseNotes,
            respondedById: session.userId,
          },
        });

        // Create load event
        await tx.loadEvent.create({
          data: {
            loadId: proposal.loadId,
            eventType: "PROPOSAL_REJECTED",
            description: `Match proposal rejected by carrier. Truck: ${proposal.truck.licensePlate}`,
            userId: session.userId,
            metadata: {
              proposalId: proposalId,
              rejectionReason: data.responseNotes,
            },
          },
        });

        return rejected;
      });

      // H3 FIX: Cache invalidation on reject (accept path already has it)
      await CacheInvalidation.load(proposal.loadId, proposal.load.shipperId);

      // Fix 1a: Notify dispatcher of rejection
      createNotification({
        userId: proposal.proposedById,
        type: NotificationType.MATCH_PROPOSAL_REJECTED,
        title: "Match Proposal Rejected",
        message: `Carrier rejected your match proposal for truck ${proposal.truck.licensePlate}.${data.responseNotes ? ` Reason: ${data.responseNotes}` : ""}`,
        metadata: {
          proposalId,
          loadId: proposal.loadId,
          reason: data.responseNotes,
        },
      }).catch((err) => console.error("Failed to notify dispatcher:", err));

      // G-A13-1: Notify shipper — their load's match proposal was declined
      const rejectedShipperUsers = await db.user.findMany({
        where: { organizationId: proposal.load.shipperId, status: "ACTIVE" },
        select: { id: true },
      });
      for (const u of rejectedShipperUsers) {
        createNotification({
          userId: u.id,
          type: NotificationType.MATCH_PROPOSAL_REJECTED,
          title: "Match Proposal Declined",
          message: `The truck match proposal for your load from ${proposal.load.pickupCity} to ${proposal.load.deliveryCity} was declined by the carrier.`,
          metadata: {
            proposalId,
            loadId: proposal.loadId,
            reason: data.responseNotes,
          },
        }).catch((err) =>
          console.error("Failed to notify shipper of rejection:", err)
        );
      }

      return NextResponse.json({
        proposal: updatedProposal,
        message: "Proposal rejected.",
      });
    }
    // Fix 1c: Use handleApiError for consistent error handling
  } catch (error: unknown) {
    // Keep P2002 unique constraint handler for race conditions
    const prismaError = error as {
      code?: string;
      meta?: { target?: string[] };
    };
    if (prismaError?.code === "P2002") {
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

    return handleApiError(error, "Error responding to match proposal");
  }
}

export const dynamic = "force-dynamic";
/**
 * Load Request Response API
 *
 * Sprint 18 - Shipper responds to carrier's load request
 *
 * Allows shippers to approve or reject load requests from carriers.
 * Only the shipper who owns the load can respond.
 *
 * POST: Approve or reject a load request (SHIPPER only)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { createNotification, NotificationType } from "@/lib/notifications";
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";

// Validation schema for load request response
const LoadRequestResponseSchema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  responseNotes: z.string().max(500).optional(),
});

/**
 * POST /api/load-requests/[id]/respond
 *
 * Respond to a load request (approve or reject).
 *
 * Only the shipper who owns the load can respond.
 * If approved, the load is assigned to the carrier's truck.
 *
 * Request body:
 * - action: 'APPROVE' | 'REJECT'
 * - responseNotes: string (optional)
 *
 * Returns: Updated load request and load (if approved)
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
      "load-request-respond",
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

    // Get the load request
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
          },
        },
        truck: {
          select: {
            id: true,
            licensePlate: true,
            carrierId: true,
            approvalStatus: true, // G-M12-2b: needed for approval re-check
            imei: true,
            gpsVerifiedAt: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!loadRequest) {
      return NextResponse.json(
        { error: "Load request not found" },
        { status: 404 }
      );
    }

    // Check if user is the shipper who owns the load
    // G-M18-5: DISPATCHER intentionally excluded — blueprint §5: dispatchers have NO accept/reject authority
    const isShipperOwner =
      session.role === "SHIPPER" &&
      session.organizationId === loadRequest.shipperId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    // Fix 6b: Return 404 instead of 403 to prevent resource existence leakage
    if (!isShipperOwner && !isAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // G-M12-2b: Re-check truck approval status (TOCTOU — truck may have been rejected after request was created)
    if (loadRequest.truck.approvalStatus !== "APPROVED") {
      return NextResponse.json(
        { error: "Cannot proceed — truck is no longer approved" },
        { status: 400 }
      );
    }

    // Validate request body first (needed for idempotency check)
    const body = await request.json();
    const validationResult = LoadRequestResponseSchema.safeParse(body);

    if (!validationResult.success) {
      // FIX: Use zodErrorResponse to avoid schema leak
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(validationResult.error);
    }

    const data = validationResult.data;

    // Check if request is still pending - handle idempotency
    if (loadRequest.status !== "PENDING") {
      // Idempotent: If already in the desired state, return success
      if (
        ((loadRequest.status === "SHIPPER_APPROVED" ||
          loadRequest.status === "APPROVED") &&
          data.action === "APPROVE") ||
        (loadRequest.status === "REJECTED" && data.action === "REJECT")
      ) {
        return NextResponse.json({
          request: loadRequest,
          message: `Request was already ${loadRequest.status.toLowerCase()}`,
          idempotent: true,
        });
      }

      return NextResponse.json(
        {
          error: `Request has already been ${loadRequest.status.toLowerCase()}`,
          currentStatus: loadRequest.status,
        },
        { status: 400 }
      );
    }

    // Check if request has expired
    if (new Date() > loadRequest.expiresAt) {
      await db.loadRequest.update({
        where: { id: requestId },
        data: { status: "EXPIRED" },
      });

      return NextResponse.json(
        { error: "Request has expired" },
        { status: 400 }
      );
    }

    if (data.action === "APPROVE") {
      // G-M18-2: Guard — load must still be bookable (prevents approving on dead/assigned loads)
      const BOOKABLE_LOAD_STATUSES = ["POSTED", "SEARCHING", "OFFERED"];
      if (!BOOKABLE_LOAD_STATUSES.includes(loadRequest.load.status)) {
        return NextResponse.json(
          {
            error: `Load is no longer available for booking (status: ${loadRequest.load.status})`,
          },
          { status: 400 }
        );
      }

      // G-M18-3: Guard — truck must not be on an active trip
      const activeTripCount = await db.trip.count({
        where: {
          truckId: loadRequest.truck.id,
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
        return NextResponse.json(
          {
            error:
              "Truck is currently on an active trip and cannot be approved for booking",
          },
          { status: 409 }
        );
      }

      // G-M18-4: Wallet gate — shipper must meet minimum balance (blueprint §8)
      if (!isAdmin) {
        const shipperAccount = await db.financialAccount.findFirst({
          where: { organizationId: loadRequest.shipperId, isActive: true },
          select: { balance: true, minimumBalance: true },
        });
        if (
          shipperAccount &&
          shipperAccount.balance < shipperAccount.minimumBalance
        ) {
          // Fire-and-forget low-balance notification (max 1 per day per org)
          db.user
            .findMany({
              where: {
                organizationId: loadRequest.shipperId,
                status: "ACTIVE",
              },
              select: { id: true },
            })
            .then(async (users) => {
              for (const u of users) {
                await createNotification({
                  userId: u.id,
                  type: NotificationType.LOW_BALANCE_WARNING,
                  title: "Low Wallet Balance",
                  message:
                    "Your wallet balance is below the required minimum for marketplace activity. Please top up to continue.",
                  metadata: { organizationId: loadRequest.shipperId },
                });
              }
            })
            .catch(() => {});

          return NextResponse.json(
            { error: "Insufficient wallet balance for marketplace access" },
            { status: 402 }
          );
        }
      }

      // G-A9-2: Soft-accept only — no Trip created, no load assignment, no truck removal.
      // The Carrier must call POST /api/load-requests/[id]/confirm to finalise the booking.
      try {
        const updatedRequest = await db.$transaction(async (tx) => {
          // Re-check status inside transaction (race guard)
          const freshRequest = await tx.loadRequest.findUnique({
            where: { id: requestId },
            select: { status: true },
          });
          if (!freshRequest || freshRequest.status !== "PENDING") {
            throw new Error("REQUEST_ALREADY_PROCESSED");
          }

          const updated = await tx.loadRequest.update({
            where: { id: requestId },
            data: {
              status: "SHIPPER_APPROVED",
              respondedAt: new Date(),
              responseNotes: data.responseNotes,
              respondedById: session.userId,
            },
          });

          // G-M18-7: LoadEvent inside transaction (consistent with REJECT path)
          await tx.loadEvent.create({
            data: {
              loadId: loadRequest.loadId,
              eventType: "LOAD_REQUEST_ACCEPTED",
              description: `Shipper accepted load request from ${loadRequest.carrier.name} — awaiting carrier confirmation`,
              userId: session.userId,
              metadata: {
                loadRequestId: requestId,
                carrierId: loadRequest.carrierId,
              },
            },
          });

          return updated;
        });

        // Cache invalidate (load is still marketplace-visible but in soft-reservation)
        await CacheInvalidation.load(
          loadRequest.loadId,
          loadRequest.load.shipperId
        );

        // Non-critical: Notify carrier users (fire-and-forget)
        db.user
          .findMany({
            where: { organizationId: loadRequest.carrierId, status: "ACTIVE" },
            select: { id: true },
          })
          .then(async (users) => {
            for (const u of users) {
              await createNotification({
                userId: u.id,
                type: NotificationType.LOAD_REQUEST_APPROVED,
                title: "Shipper Accepted Your Request",
                message: `The shipper accepted your request for the load from ${loadRequest.load.pickupCity} to ${loadRequest.load.deliveryCity}. Please confirm to finalise the booking.`,
                metadata: {
                  loadRequestId: requestId,
                  loadId: loadRequest.loadId,
                  truckId: loadRequest.truckId,
                },
              });
            }
          })
          .catch((err) => console.error("Failed to notify carrier:", err));

        return NextResponse.json({
          request: updatedRequest,
          message:
            "Load request accepted. Carrier notified to confirm booking.",
        });
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : "";
        if (errorMessage === "REQUEST_ALREADY_PROCESSED") {
          return NextResponse.json(
            { error: "Request has already been processed" },
            { status: 409 }
          );
        }
        throw error;
      }
    } else {
      // HIGH FIX #5: Wrap REJECT path in transaction for atomicity
      const updatedRequest = await db.$transaction(async (tx) => {
        const updatedRequest = await tx.loadRequest.update({
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
            loadId: loadRequest.loadId,
            eventType: "LOAD_REQUEST_REJECTED",
            description: `Load request from ${loadRequest.carrier.name} was rejected`,
            userId: session.userId,
            metadata: {
              loadRequestId: requestId,
              rejectionReason: data.responseNotes,
            },
          },
        });

        // G-M18-6: Load reversion inside transaction for atomicity
        // G-A9-3: Revert load SEARCHING → POSTED if no other active requests remain
        const remaining = await tx.loadRequest.count({
          where: {
            loadId: loadRequest.loadId,
            status: { in: ["PENDING", "SHIPPER_APPROVED"] },
            id: { not: requestId },
          },
        });
        if (remaining === 0) {
          await tx.load.update({
            where: {
              id: loadRequest.loadId,
              status: { in: ["SEARCHING", "OFFERED"] },
            },
            data: { status: "POSTED" },
          });
        }

        return updatedRequest;
      });

      // B6 FIX: Invalidate cache on REJECT (APPROVE path already does this)
      await CacheInvalidation.load(
        loadRequest.loadId,
        loadRequest.load?.shipperId
      );

      // Non-critical: Notify carrier users (fire-and-forget, outside transaction)
      const carrierUsers = await db.user.findMany({
        where: {
          organizationId: loadRequest.carrierId,
          status: "ACTIVE",
        },
        select: { id: true },
      });

      for (const user of carrierUsers) {
        createNotification({
          userId: user.id,
          type: NotificationType.LOAD_REQUEST_REJECTED,
          title: "Load Request Rejected",
          message: `Your request for the load from ${loadRequest.load.pickupCity} to ${loadRequest.load.deliveryCity} was rejected.${data.responseNotes ? ` Reason: ${data.responseNotes}` : ""}`,
          metadata: {
            loadRequestId: requestId,
            loadId: loadRequest.loadId,
            reason: data.responseNotes,
          },
        }).catch((err) => console.error("Failed to notify carrier:", err));
      }

      return NextResponse.json({
        request: updatedRequest,
        message: "Load request rejected.",
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

    return handleApiError(error, "Error responding to load request");
  }
}

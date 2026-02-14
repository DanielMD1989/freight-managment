import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { calculateAge, canSeeContact, maskCompany } from "@/lib/loadUtils";
import {
  incrementCompletedLoads,
  incrementCancelledLoads,
} from "@/lib/trustMetrics";
import { checkSuspiciousCancellation } from "@/lib/bypassDetection";
import { validateStateTransition, LoadStatus } from "@/lib/loadStateMachine";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { zodErrorResponse } from "@/lib/validation";
// CRITICAL FIX: Import CacheInvalidation for load mutations
import { CacheInvalidation } from "@/lib/cache";
// CRITICAL FIX: Import notification helper for status change notifications
import { createNotification } from "@/lib/notifications";
import { logger } from "@/lib/logger";

/**
 * Helper function to apply RPS rate limiting
 */
async function applyRpsLimit(
  request: NextRequest
): Promise<NextResponse | null> {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown";
  const rpsResult = await checkRpsLimit(
    RPS_CONFIGS.marketplace.endpoint,
    ip,
    RPS_CONFIGS.marketplace.rps,
    RPS_CONFIGS.marketplace.burst
  );
  if (!rpsResult.allowed) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Please slow down.", retryAfter: 1 },
      {
        status: 429,
        headers: {
          "X-RateLimit-Limit": rpsResult.limit.toString(),
          "X-RateLimit-Remaining": rpsResult.remaining.toString(),
          "Retry-After": "1",
        },
      }
    );
  }
  return null;
}

const updateLoadSchema = z.object({
  status: z
    .enum([
      "DRAFT",
      "POSTED",
      "UNPOSTED",
      "ASSIGNED",
      "PICKUP_PENDING",
      "IN_TRANSIT",
      "DELIVERED",
      "COMPLETED",
      "CANCELLED",
      "EXPIRED",
    ])
    .optional(),
  pickupCity: z.string().min(2).optional(),
  pickupAddress: z.string().optional().nullable(),
  deliveryCity: z.string().min(2).optional(),
  deliveryAddress: z.string().optional().nullable(),
  pickupDockHours: z.string().optional().nullable(),
  deliveryDockHours: z.string().optional().nullable(),
  pickupDate: z.string().optional(),
  deliveryDate: z.string().optional().nullable(),
  truckType: z
    .enum([
      "FLATBED",
      "REFRIGERATED",
      "TANKER",
      "CONTAINER",
      "DRY_VAN",
      "LOWBOY",
      "DUMP_TRUCK",
      "BOX_TRUCK",
    ])
    .optional(),
  weight: z.number().positive().optional(),
  lengthM: z.number().positive().optional(),
  fullPartial: z.enum(["FULL", "PARTIAL"]).optional(),
  tripKm: z.number().positive().optional(),
  estimatedTripKm: z.number().positive().optional(),
  currency: z.string().optional(),
  cargoDescription: z.string().optional().nullable(),
  specialInstructions: z.string().optional().nullable(),
  safetyNotes: z.string().optional().nullable(),
  bookMode: z.enum(["REQUEST", "INSTANT"]).optional(),
  shipperContactPhone: z.string().optional().nullable(),
  shipperContactName: z.string().optional().nullable(),
  isKept: z.boolean().optional(),
  hasAlerts: z.boolean().optional(),
  groupId: z.string().optional().nullable(),
});

// GET /api/loads/[id]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting: Apply RPS_CONFIGS.marketplace
    const rateLimitError = await applyRpsLimit(request);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    const session = await requireAuth();

    // Get current user's info
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        organizationId: true,
        role: true,
      },
    });

    // Fail if user not found - don't default to any role
    if (!user) {
      console.error(
        `[SECURITY] User not found in database after requireAuth: ${session.userId}`
      );
      return NextResponse.json({ error: "User not found" }, { status: 401 });
    }

    const load = await db.load.findUnique({
      where: { id },
      include: {
        shipper: {
          select: {
            id: true,
            name: true,
            type: true,
            isVerified: true,
            contactEmail: true,
            contactPhone: true,
            // Sprint 16: Story 16.6 - Bypass detection fields
            isFlagged: true,
            flagReason: true,
            flaggedAt: true,
          },
        },
        assignedTruck: {
          include: {
            carrier: {
              select: {
                id: true,
                name: true,
                isVerified: true,
              },
            },
          },
        },
        documents: true,
        events: {
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Authorization check - shipper, assigned carrier, dispatcher, admin, or public loadboard loads
    const isShipper = user.organizationId === load.shipperId;
    const isAssignedCarrier =
      load.assignedTruck?.carrier?.id === user.organizationId;
    const isDispatcher = user.role === "DISPATCHER";
    const isAdmin = user.role === "ADMIN" || user.role === "SUPER_ADMIN";
    // POSTED loads are on the public loadboard — any authenticated user can view them
    const isPublicLoad = load.status === "POSTED";

    if (
      !isShipper &&
      !isAssignedCarrier &&
      !isDispatcher &&
      !isAdmin &&
      !isPublicLoad
    ) {
      return NextResponse.json(
        { error: "You do not have permission to view this load" },
        { status: 403 }
      );
    }

    // Compute age
    const ageMinutes = calculateAge(load.postedAt, load.createdAt);

    // Determine if viewer can see contact information
    // user is guaranteed to exist at this point (checked above)
    const userCanSeeContact = canSeeContact(
      load.assignedTruckId,
      user.organizationId,
      load.assignedTruck?.carrier?.id || null,
      user.role
    );

    // Apply company masking
    const maskedShipper = load.shipper
      ? {
          ...load.shipper,
          name: maskCompany(load.isAnonymous, load.shipper.name),
        }
      : null;

    // Build response with conditional contact information
    const responseLoad = {
      ...load,
      // Replace shipper with masked version
      shipper: maskedShipper,
      // Computed fields
      ageMinutes,
      // Contact info - only include if authorized
      shipperContactName: userCanSeeContact ? load.shipperContactName : null,
      shipperContactPhone: userCanSeeContact ? load.shipperContactPhone : null,
    };

    return NextResponse.json({ load: responseLoad });
  } catch (error) {
    console.error("Get load error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/loads/[id]
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limiting: Apply RPS_CONFIGS.marketplace
    const rateLimitError = await applyRpsLimit(request);
    if (rateLimitError) return rateLimitError;

    const { id } = await params;
    const session = await requireAuth();

    // Check if load exists and belongs to user's organization
    // PHASE 4: Optimized query - include pricing fields and carrier info to avoid N+1 queries
    const existingLoad = await db.load.findUnique({
      where: { id },
      select: {
        shipperId: true,
        status: true,
        createdById: true,
        assignedTruckId: true,
        tripKm: true,
        estimatedTripKm: true,
        // Include carrier info for trust metrics
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!existingLoad) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const canEdit =
      user?.organizationId === existingLoad.shipperId ||
      session.userId === existingLoad.createdById ||
      session.role === "ADMIN" ||
      session.role === "PLATFORM_OPS";

    if (!canEdit) {
      console.error("Permission denied:", {
        userId: session.userId,
        userOrgId: user?.organizationId,
        shipperId: existingLoad.shipperId,
        createdById: existingLoad.createdById,
        role: session.role,
      });
      return NextResponse.json(
        { error: "You do not have permission to edit this load" },
        { status: 403 }
      );
    }

    // H13 FIX: Cannot edit if already assigned or in PICKUP_PENDING
    if (
      existingLoad.status === "ASSIGNED" ||
      existingLoad.status === "PICKUP_PENDING" ||
      existingLoad.status === "IN_TRANSIT" ||
      existingLoad.status === "DELIVERED"
    ) {
      return NextResponse.json(
        { error: "Cannot edit load after it has been assigned" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const validatedData = updateLoadSchema.parse(body);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const additionalData: Record<string, any> = {};

    // Update postedAt when status changes to POSTED
    if (validatedData.status === "POSTED" && existingLoad.status !== "POSTED") {
      additionalData.postedAt = new Date();
    }

    // Sync tripKm and estimatedTripKm for backward compatibility
    if (
      validatedData.tripKm !== undefined &&
      validatedData.estimatedTripKm === undefined
    ) {
      additionalData.estimatedTripKm = validatedData.tripKm;
    } else if (
      validatedData.estimatedTripKm !== undefined &&
      validatedData.tripKm === undefined
    ) {
      additionalData.tripKm = validatedData.estimatedTripKm;
    }

    // Validate state transition if status is changing
    if (validatedData.status && validatedData.status !== existingLoad.status) {
      const stateValidation = validateStateTransition(
        existingLoad.status,
        validatedData.status as LoadStatus,
        session.role
      );

      if (!stateValidation.valid) {
        return NextResponse.json(
          { error: stateValidation.error },
          { status: 400 }
        );
      }

      // Auto-unassign truck when status changes to terminal states
      const terminalStatuses = [
        "DELIVERED",
        "COMPLETED",
        "CANCELLED",
        "EXPIRED",
      ];
      if (
        terminalStatuses.includes(validatedData.status) &&
        existingLoad.assignedTruckId
      ) {
        additionalData.assignedTruckId = null;
        additionalData.trackingEnabled = false;
      }
    }

    // HIGH FIX #7: Wrap Load update + Trip sync in transaction for atomicity
    const { load, tripSynced } = await db.$transaction(async (tx) => {
      const load = await tx.load.update({
        where: { id },
        data: {
          ...validatedData,
          ...additionalData,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
      });

      // Sync Trip status when Load status changes
      let tripSynced = false;
      if (validatedData.status) {
        const tripStatusMap: Record<string, string> = {
          ASSIGNED: "ASSIGNED",
          PICKUP_PENDING: "PICKUP_PENDING",
          IN_TRANSIT: "IN_TRANSIT",
          DELIVERED: "DELIVERED",
          COMPLETED: "COMPLETED",
          CANCELLED: "CANCELLED",
        };

        const newTripStatus = tripStatusMap[validatedData.status];
        if (newTripStatus) {
          // Find and update associated Trip inside transaction
          const trip = await tx.trip.findUnique({
            where: { loadId: id },
          });

          if (trip) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const tripUpdateData: Record<string, any> = {
              status: newTripStatus,
            };

            // Set appropriate timestamps based on status transition
            if (validatedData.status === "PICKUP_PENDING" && !trip.startedAt) {
              tripUpdateData.startedAt = new Date();
            }
            if (validatedData.status === "IN_TRANSIT" && !trip.pickedUpAt) {
              tripUpdateData.pickedUpAt = new Date();
            }
            if (validatedData.status === "DELIVERED" && !trip.deliveredAt) {
              tripUpdateData.deliveredAt = new Date();
            }
            if (validatedData.status === "COMPLETED" && !trip.completedAt) {
              tripUpdateData.completedAt = new Date();
              tripUpdateData.trackingEnabled = false;
            }
            if (validatedData.status === "CANCELLED" && !trip.cancelledAt) {
              tripUpdateData.cancelledAt = new Date();
              tripUpdateData.cancelledBy = session.userId;
              tripUpdateData.trackingEnabled = false;
            }

            await tx.trip.update({
              where: { loadId: id },
              data: tripUpdateData,
            });

            tripSynced = true;
          }
        }
      }

      return { load, tripSynced };
    });

    if (tripSynced) {
    }

    // Log truck unassignment if it happened
    const terminalStatuses = ["DELIVERED", "COMPLETED", "CANCELLED", "EXPIRED"];
    if (
      validatedData.status &&
      terminalStatuses.includes(validatedData.status) &&
      existingLoad.assignedTruckId
    ) {
      await db.loadEvent.create({
        data: {
          loadId: id,
          eventType: "UNASSIGNED",
          description: `Truck automatically unassigned - load status changed to ${validatedData.status}`,
          userId: session.userId,
        },
      });
    }

    // Sprint 16: Update trust metrics on status change
    if (validatedData.status === "DELIVERED") {
      // Increment completed loads for shipper
      if (existingLoad.shipperId) {
        await incrementCompletedLoads(existingLoad.shipperId);
      }

      // PHASE 4: Use existingLoad data instead of redundant query (N+1 fix)
      // Also increment for carrier if assigned
      if (existingLoad.assignedTruck?.carrierId) {
        await incrementCompletedLoads(existingLoad.assignedTruck.carrierId);
      }
    } else if (validatedData.status === "CANCELLED") {
      // Increment cancelled loads for shipper
      if (existingLoad.shipperId) {
        await incrementCancelledLoads(existingLoad.shipperId);
      }

      // Sprint 16: Check for suspicious bypass pattern
      await checkSuspiciousCancellation(id);
    }

    // Log event
    await db.loadEvent.create({
      data: {
        loadId: id,
        eventType:
          validatedData.status === "POSTED"
            ? "POSTED"
            : validatedData.status === "UNPOSTED"
              ? "UNPOSTED"
              : "EDITED",
        description: `Load ${validatedData.status || "updated"}`,
        userId: session.userId,
      },
    });

    // CRITICAL FIX: Invalidate cache after load update
    await CacheInvalidation.load(id, existingLoad.shipperId);

    // CRITICAL FIX: Send notifications for status changes
    if (validatedData.status && validatedData.status !== existingLoad.status) {
      // Notify carrier if assigned
      if (existingLoad.assignedTruck?.carrierId) {
        const carrierUsers = await db.user.findMany({
          where: {
            organizationId: existingLoad.assignedTruck.carrierId,
            status: "ACTIVE",
          },
          select: { id: true },
        });
        await Promise.all(
          carrierUsers.map((user) =>
            createNotification({
              userId: user.id,
              type: "LOAD_STATUS_CHANGE",
              title: `Load Status: ${validatedData.status}`,
              message: `Load status changed to ${validatedData.status}`,
              metadata: { loadId: id, status: validatedData.status },
            }).catch(console.error)
          )
        );
      }
    }

    return NextResponse.json({ load });
  } catch (error) {
    console.error("Update load error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/loads/[id]
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // C16 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id } = await params;
    const session = await requireAuth();

    const load = await db.load.findUnique({
      where: { id },
      select: { shipperId: true, status: true, createdById: true },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const canDelete =
      user?.organizationId === load.shipperId ||
      session.userId === load.createdById ||
      session.role === "ADMIN" ||
      session.role === "PLATFORM_OPS";

    if (!canDelete) {
      return NextResponse.json(
        { error: "You do not have permission to delete this load" },
        { status: 403 }
      );
    }

    // Can only delete draft, unposted, or posted loads (not assigned/in-transit/delivered)
    if (
      load.status === "ASSIGNED" ||
      load.status === "IN_TRANSIT" ||
      load.status === "DELIVERED"
    ) {
      return NextResponse.json(
        {
          error:
            "Cannot delete loads that are assigned, in transit, or delivered",
        },
        { status: 400 }
      );
    }

    // P1-007 FIX: Clean up related requests before deleting load to prevent FK constraint errors
    // Use transaction to ensure atomicity and notify affected carriers
    const deletionResult = await db.$transaction(async (tx) => {
      // Find all pending LoadRequests for this load
      const pendingLoadRequests = await tx.loadRequest.findMany({
        where: { loadId: id, status: "PENDING" },
        select: { id: true, carrierId: true },
      });

      // Find all pending TruckRequests for this load
      const pendingTruckRequests = await tx.truckRequest.findMany({
        where: { loadId: id, status: "PENDING" },
        select: {
          id: true,
          truckId: true,
          truck: { select: { carrierId: true } },
        },
      });

      // Reject all pending LoadRequests with system reason
      if (pendingLoadRequests.length > 0) {
        await tx.loadRequest.updateMany({
          where: { loadId: id, status: "PENDING" },
          data: {
            status: "REJECTED",
            responseNotes: "Load was deleted by shipper",
            respondedAt: new Date(),
          },
        });
      }

      // Reject all pending TruckRequests with system reason
      if (pendingTruckRequests.length > 0) {
        await tx.truckRequest.updateMany({
          where: { loadId: id, status: "PENDING" },
          data: {
            status: "REJECTED",
            responseNotes: "Load was deleted by shipper",
            respondedAt: new Date(),
          },
        });
      }

      // Delete the load
      await tx.load.delete({ where: { id } });

      return {
        deletedLoadId: id,
        rejectedLoadRequests: pendingLoadRequests,
        rejectedTruckRequests: pendingTruckRequests,
      };
    });

    // CRITICAL FIX: Invalidate cache after load deletion
    await CacheInvalidation.load(id, load.shipperId);

    // P1-007 FIX: Notify affected carriers about rejected requests (fire-and-forget)
    const notificationPromises: Promise<unknown>[] = [];

    // Batch-fetch all carrier users instead of querying per-request (N+1 fix)
    const allCarrierOrgIds = [
      ...deletionResult.rejectedLoadRequests.map((r) => r.carrierId),
      ...deletionResult.rejectedTruckRequests
        .filter((r) => r.truck?.carrierId)
        .map((r) => r.truck!.carrierId),
    ];
    const uniqueCarrierOrgIds = [...new Set(allCarrierOrgIds)];

    const allCarrierUsers =
      uniqueCarrierOrgIds.length > 0
        ? await db.user.findMany({
            where: {
              organizationId: { in: uniqueCarrierOrgIds },
              status: "ACTIVE",
            },
            select: { id: true, organizationId: true },
          })
        : [];

    // Group users by organizationId
    const usersByOrgId = new Map<string, string[]>();
    for (const u of allCarrierUsers) {
      const orgId = u.organizationId!;
      if (!usersByOrgId.has(orgId)) usersByOrgId.set(orgId, []);
      usersByOrgId.get(orgId)!.push(u.id);
    }

    // Notify carriers whose LoadRequests were rejected
    for (const req of deletionResult.rejectedLoadRequests) {
      const userIds = usersByOrgId.get(req.carrierId) || [];
      for (const userId of userIds) {
        notificationPromises.push(
          createNotification({
            userId,
            type: "LOAD_REQUEST_REJECTED",
            title: "Load Request Cancelled",
            message: "The load you requested has been deleted by the shipper.",
            metadata: {
              loadRequestId: req.id,
              loadId: id,
              reason: "Load deleted",
            },
          }).catch(console.error)
        );
      }
    }

    // Notify carriers whose TruckRequests were rejected
    for (const req of deletionResult.rejectedTruckRequests) {
      if (req.truck?.carrierId) {
        const userIds = usersByOrgId.get(req.truck.carrierId) || [];
        for (const userId of userIds) {
          notificationPromises.push(
            createNotification({
              userId,
              type: "TRUCK_REQUEST_REJECTED",
              title: "Truck Request Cancelled",
              message:
                "The load for your truck request has been deleted by the shipper.",
              metadata: {
                truckRequestId: req.id,
                loadId: id,
                reason: "Load deleted",
              },
            }).catch(console.error)
          );
        }
      }
    }

    // Fire-and-forget notifications
    Promise.all(notificationPromises).catch(console.error);

    // Audit log
    logger.info("[LoadAPI] Load deleted", {
      loadId: id,
      userId: session.userId,
      rejectedLoadRequests: deletionResult.rejectedLoadRequests.length,
      rejectedTruckRequests: deletionResult.rejectedTruckRequests.length,
    });

    return NextResponse.json({ message: "Load deleted successfully" });
  } catch (error) {
    console.error("Delete load error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

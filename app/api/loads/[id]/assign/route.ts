import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { enableTrackingForLoad } from "@/lib/gpsTracking";
import { canAssignLoads } from "@/lib/dispatcherPermissions";
import { validateStateTransition, LoadStatus } from "@/lib/loadStateMachine";
import { checkAssignmentConflicts } from "@/lib/assignmentConflictDetection"; // Sprint 4
import { RULE_CARRIER_FINAL_AUTHORITY } from "@/lib/foundation-rules"; // Phase 2
import { validateWalletBalancesForTrip } from "@/lib/serviceFeeManagement"; // Service Fee Implementation
import { createTripForLoad } from "@/lib/tripManagement"; // Trip Management
// P0-005 FIX: Import CacheInvalidation for post-assignment cache clearing
import { CacheInvalidation } from "@/lib/cache";
import crypto from "crypto";
import { zodErrorResponse } from "@/lib/validation";

const assignLoadSchema = z.object({
  truckId: z.string(),
});

/**
 * POST /api/loads/[id]/assign
 *
 * Assign a truck to a load and enable GPS tracking
 *
 * Sprint 16 - Story 16.3: GPS Live Tracking
 *
 * PHASE 2 UPDATE - Foundation Rules:
 * - DISPATCHER cannot use this endpoint (they use /propose instead)
 * - CARRIER can only assign their own trucks
 * - ADMIN/SUPER_ADMIN can override for support
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // C6 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: loadId } = await params;
    const session = await requireAuth();

    // Get load
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        createdById: true,
        pickupDate: true, // Sprint 4: For conflict detection
        deliveryDate: true, // Sprint 4: For conflict detection
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    // Sprint 16: Use dispatcher permissions utility
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userCanAssign = canAssignLoads(
      {
        role: user.role,
        organizationId: user.organizationId,
        userId: session.userId,
      },
      load.shipperId
    );

    if (!userCanAssign) {
      return NextResponse.json(
        { error: "You do not have permission to assign this load" },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const { truckId } = assignLoadSchema.parse(body);

    // Sprint 3: Validate state transition to ASSIGNED
    const stateValidation = validateStateTransition(
      load.status,
      LoadStatus.ASSIGNED,
      session.role
    );

    if (!stateValidation.valid) {
      return NextResponse.json(
        { error: stateValidation.error },
        { status: 400 }
      );
    }

    // Check if truck exists and is available
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: {
        id: true,
        isAvailable: true,
        imei: true,
        gpsVerifiedAt: true,
        licensePlate: true,
        carrierId: true, // Phase 2: For ownership validation
      },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // PHASE 2: Carrier can only assign their own trucks
    // Foundation Rule: CARRIER_FINAL_AUTHORITY
    if (user.role === "CARRIER") {
      if (truck.carrierId !== user.organizationId) {
        return NextResponse.json(
          { error: "Carriers can only assign their own trucks" },
          { status: 403 }
        );
      }
    }

    // Sprint 4: Check for assignment conflicts (pre-transaction check)
    const conflictCheck = await checkAssignmentConflicts(
      truckId,
      loadId,
      load.pickupDate,
      load.deliveryDate
    );

    if (conflictCheck.hasConflict) {
      return NextResponse.json(
        {
          error: "Assignment conflicts detected",
          conflicts: conflictCheck.conflicts,
          warnings: conflictCheck.warnings,
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Log warnings if any (but don't block assignment)
    if (conflictCheck.warnings.length > 0) {
      console.warn(
        `Assignment warnings for load ${loadId}:`,
        conflictCheck.warnings
      );
    }

    // SERVICE FEE: Validate wallet balances before assignment
    // This is validation only - fees are deducted on trip completion
    const walletValidation = await validateWalletBalancesForTrip(
      loadId,
      truck.carrierId
    );
    if (!walletValidation.valid) {
      return NextResponse.json(
        {
          error: "Insufficient wallet balance for trip service fees",
          details: walletValidation.errors,
          fees: {
            shipperFee: walletValidation.shipperFee,
            carrierFee: walletValidation.carrierFee,
            shipperBalance: walletValidation.shipperBalance,
            carrierBalance: walletValidation.carrierBalance,
          },
        },
        { status: 400 }
      );
    }

    // P0-005 & P0-006 FIX: Wrap all critical operations in a single transaction
    // with fresh re-fetch to prevent race conditions
    // FIX: Use Record types instead of any
    let result: {
      load: Record<string, unknown>;
      trip: Record<string, unknown>;
      trackingUrl: string | null;
    };

    try {
      result = await db.$transaction(async (tx) => {
        // P0-006 FIX: Fresh re-fetch load inside transaction to prevent race condition
        const freshLoad = await tx.load.findUnique({
          where: { id: loadId },
          select: {
            id: true,
            status: true,
            shipperId: true,
            assignedTruckId: true,
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

        const availableStatuses = ["POSTED", "SEARCHING", "OFFERED"];
        if (!availableStatuses.includes(freshLoad.status)) {
          throw new Error(`LOAD_NOT_AVAILABLE:${freshLoad.status}`);
        }

        // Check truck is not already busy with an active load
        const truckBusy = await tx.load.findFirst({
          where: {
            assignedTruckId: truckId,
            status: { in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"] },
          },
          select: { id: true, pickupCity: true, deliveryCity: true },
        });

        if (truckBusy) {
          throw new Error(
            `TRUCK_ALREADY_BUSY:${truckBusy.pickupCity}:${truckBusy.deliveryCity}`
          );
        }

        // Unassign truck from any completed loads (cleanup)
        await tx.load.updateMany({
          where: {
            assignedTruckId: truckId,
            status: { in: ["DELIVERED", "COMPLETED", "CANCELLED", "EXPIRED"] },
          },
          data: { assignedTruckId: null },
        });

        // Assign truck to load
        const updatedLoad = await tx.load.update({
          where: { id: loadId },
          data: {
            assignedTruckId: truckId,
            assignedAt: new Date(),
            status: "ASSIGNED",
          },
        });

        // Create Trip record inside transaction (atomic with assignment)
        const trackingUrl = `trip-${loadId.slice(-6)}-${crypto.randomBytes(12).toString("hex")}`;

        const trip = await tx.trip.create({
          data: {
            loadId: loadId,
            truckId: truckId,
            carrierId: truck.carrierId,
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
            estimatedDistanceKm: freshLoad.tripKm || freshLoad.estimatedTripKm,
            trackingUrl,
            trackingEnabled: true,
          },
        });

        // Create assignment event inside transaction
        await tx.loadEvent.create({
          data: {
            loadId,
            eventType: "ASSIGNED",
            description: `Load assigned to truck ${truck.licensePlate}`,
            userId: session.userId,
            metadata: {
              truckId,
              tripId: trip.id,
              assignedViaDirectAssign: true,
            },
          },
        });

        // Cancel other pending requests for this load
        await tx.loadRequest.updateMany({
          where: { loadId: loadId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });

        await tx.truckRequest.updateMany({
          where: { loadId: loadId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });

        await tx.matchProposal.updateMany({
          where: { loadId: loadId, status: "PENDING" },
          data: { status: "CANCELLED" },
        });

        return { load: updatedLoad, trip, trackingUrl };
      });
      // FIX: Use unknown type with type guard
    } catch (error: unknown) {
      // Handle specific transaction errors
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage === "LOAD_NOT_FOUND") {
        return NextResponse.json({ error: "Load not found" }, { status: 404 });
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
      if (errorMessage.startsWith("TRUCK_ALREADY_BUSY:")) {
        const [, pickup, delivery] = errorMessage.split(":");
        return NextResponse.json(
          {
            error: `This truck is already assigned to an active load (${pickup} → ${delivery})`,
          },
          { status: 409 }
        );
      }
      throw error; // Re-throw for generic error handling
    }

    // P0-005 FIX: Cache invalidation after transaction commits (fire-and-forget)
    await CacheInvalidation.load(loadId, load.shipperId);
    await CacheInvalidation.truck(truckId, truck.carrierId);

    // SERVICE FEE NOTE: Wallet balances were validated before assignment.
    // Actual fee deduction happens on trip completion (deductServiceFee).
    // No reservation/hold is needed - validation ensures balance is sufficient.

    // Non-critical: Enable GPS tracking (outside transaction, fire-and-forget)
    let trackingUrl: string | null = result.trackingUrl;
    if (truck.imei && truck.gpsVerifiedAt) {
      try {
        const gpsUrl = await enableTrackingForLoad(loadId, truckId);
        if (gpsUrl) trackingUrl = gpsUrl;
        await db.loadEvent.create({
          data: {
            loadId,
            eventType: "TRACKING_ENABLED",
            description: `GPS tracking enabled: ${trackingUrl}`,
            userId: session.userId,
          },
        });
      } catch (error) {
        console.error("Failed to enable GPS tracking:", error);
      }
    }

    return NextResponse.json({
      load: result.load,
      trip: result.trip,
      trackingUrl,
      // Wallet validation passed - fees will be deducted on trip completion
      walletValidation: {
        validated: true,
        shipperFee: walletValidation.shipperFee.toFixed(2),
        carrierFee: walletValidation.carrierFee.toFixed(2),
        note: "Fees will be deducted on trip completion",
      },
      message: trackingUrl
        ? "Load assigned successfully. GPS tracking enabled."
        : "Load assigned successfully. GPS tracking not available for this truck.",
    });
    // FIX: Use unknown type with type guard
  } catch (error: unknown) {
    console.error("Assign load error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

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

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/loads/[id]/assign
 *
 * Unassign truck from load and disable GPS tracking
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // C7 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: loadId } = await params;
    const session = await requireAuth();

    // Get load
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        createdById: true,
        assignedTruckId: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    // Sprint 16: Use dispatcher permissions utility
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const userCanUnassign = canAssignLoads(
      {
        role: user.role,
        organizationId: user.organizationId,
        userId: session.userId,
      },
      load.shipperId
    );

    if (!userCanUnassign) {
      return NextResponse.json(
        { error: "You do not have permission to unassign this load" },
        { status: 403 }
      );
    }

    if (!load.assignedTruckId) {
      return NextResponse.json(
        { error: "Load is not assigned to any truck" },
        { status: 400 }
      );
    }

    // Sprint 3: Determine target status based on current state
    // ASSIGNED → SEARCHING (reassign workflow)
    // PICKUP_PENDING → SEARCHING (carrier couldn't pick up)
    // Other states → cannot unassign
    let targetStatus: LoadStatus;

    if (load.status === "ASSIGNED" || load.status === "PICKUP_PENDING") {
      targetStatus = LoadStatus.SEARCHING;
    } else if (load.status === "IN_TRANSIT" || load.status === "DELIVERED") {
      return NextResponse.json(
        { error: "Cannot unassign load that is in transit or delivered" },
        { status: 400 }
      );
    } else {
      return NextResponse.json(
        { error: `Cannot unassign load with status ${load.status}` },
        { status: 400 }
      );
    }

    // Sprint 3: Validate state transition
    const stateValidation = validateStateTransition(
      load.status,
      targetStatus,
      session.role
    );

    if (!stateValidation.valid) {
      return NextResponse.json(
        { error: stateValidation.error },
        { status: 400 }
      );
    }

    // Store previous truck ID for cache invalidation
    const previousTruckId = load.assignedTruckId;

    // Get truck carrier ID for cache invalidation
    const previousTruck = await db.truck.findUnique({
      where: { id: previousTruckId! },
      select: { carrierId: true },
    });

    // Unassign truck
    const updatedLoad = await db.load.update({
      where: { id: loadId },
      data: {
        assignedTruckId: null,
        assignedAt: null,
        status: targetStatus, // Sprint 3: State machine validated transition
        // Disable tracking
        trackingEnabled: false,
      },
    });

    // Create event
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: "UNASSIGNED",
        description: "Load unassigned from truck",
        userId: session.userId,
        metadata: {
          previousTruckId,
          newStatus: targetStatus,
        },
      },
    });

    // P1-003 FIX: Cache invalidation after unassignment
    await CacheInvalidation.load(loadId, load.shipperId);
    if (previousTruckId && previousTruck?.carrierId) {
      await CacheInvalidation.truck(previousTruckId, previousTruck.carrierId);
    }

    return NextResponse.json({
      load: updatedLoad,
      message: "Load unassigned successfully. GPS tracking disabled.",
    });
  } catch (error) {
    console.error("Unassign load error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

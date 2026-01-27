import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { enableTrackingForLoad } from '@/lib/gpsTracking';
import { canAssignLoads } from '@/lib/dispatcherPermissions';
import { validateStateTransition, LoadStatus } from '@/lib/loadStateMachine';
import { checkAssignmentConflicts } from '@/lib/assignmentConflictDetection'; // Sprint 4
import { holdFundsInEscrow, refundEscrowFunds } from '@/lib/escrowManagement'; // Sprint 8
import { RULE_CARRIER_FINAL_AUTHORITY } from '@/lib/foundation-rules'; // Phase 2
import { reserveServiceFee } from '@/lib/serviceFeeManagement'; // Service Fee Implementation
import { createTripForLoad } from '@/lib/tripManagement'; // Trip Management
// P0-005 FIX: Import CacheInvalidation for post-assignment cache clearing
import { CacheInvalidation } from '@/lib/cache';
import crypto from 'crypto';

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
        pickupDate: true,  // Sprint 4: For conflict detection
        deliveryDate: true, // Sprint 4: For conflict detection
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    // Sprint 16: Use dispatcher permissions utility
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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
        { error: 'You do not have permission to assign this load' },
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
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    // PHASE 2: Carrier can only assign their own trucks
    // Foundation Rule: CARRIER_FINAL_AUTHORITY
    if (user.role === 'CARRIER') {
      if (truck.carrierId !== user.organizationId) {
        return NextResponse.json(
          { error: 'Carriers can only assign their own trucks' },
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
          error: 'Assignment conflicts detected',
          conflicts: conflictCheck.conflicts,
          warnings: conflictCheck.warnings,
        },
        { status: 409 } // 409 Conflict
      );
    }

    // Log warnings if any (but don't block assignment)
    if (conflictCheck.warnings.length > 0) {
      console.warn(`Assignment warnings for load ${loadId}:`, conflictCheck.warnings);
    }

    // P0-005 & P0-006 FIX: Wrap all critical operations in a single transaction
    // with fresh re-fetch to prevent race conditions
    let result: { load: any; trip: any; trackingUrl: string | null };

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
          throw new Error('LOAD_NOT_FOUND');
        }

        // Check load is still available (race condition protection)
        if (freshLoad.assignedTruckId) {
          throw new Error('LOAD_ALREADY_ASSIGNED');
        }

        const availableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
        if (!availableStatuses.includes(freshLoad.status)) {
          throw new Error(`LOAD_NOT_AVAILABLE:${freshLoad.status}`);
        }

        // Check truck is not already busy with an active load
        const truckBusy = await tx.load.findFirst({
          where: {
            assignedTruckId: truckId,
            status: { in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'] },
          },
          select: { id: true, pickupCity: true, deliveryCity: true },
        });

        if (truckBusy) {
          throw new Error(`TRUCK_ALREADY_BUSY:${truckBusy.pickupCity}:${truckBusy.deliveryCity}`);
        }

        // Unassign truck from any completed loads (cleanup)
        await tx.load.updateMany({
          where: {
            assignedTruckId: truckId,
            status: { in: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] },
          },
          data: { assignedTruckId: null },
        });

        // Assign truck to load
        const updatedLoad = await tx.load.update({
          where: { id: loadId },
          data: {
            assignedTruckId: truckId,
            assignedAt: new Date(),
            status: 'ASSIGNED',
          },
        });

        // Create Trip record inside transaction (atomic with assignment)
        const trackingUrl = `trip-${loadId.slice(-6)}-${crypto.randomBytes(12).toString('hex')}`;

        const trip = await tx.trip.create({
          data: {
            loadId: loadId,
            truckId: truckId,
            carrierId: truck.carrierId,
            shipperId: freshLoad.shipperId,
            status: 'ASSIGNED',
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
            eventType: 'ASSIGNED',
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
          where: { loadId: loadId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });

        await tx.truckRequest.updateMany({
          where: { loadId: loadId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });

        await tx.matchProposal.updateMany({
          where: { loadId: loadId, status: 'PENDING' },
          data: { status: 'CANCELLED' },
        });

        return { load: updatedLoad, trip, trackingUrl };
      });
    } catch (error: any) {
      // Handle specific transaction errors
      if (error.message === 'LOAD_NOT_FOUND') {
        return NextResponse.json({ error: 'Load not found' }, { status: 404 });
      }
      if (error.message === 'LOAD_ALREADY_ASSIGNED') {
        return NextResponse.json(
          { error: 'Load has already been assigned to another truck. Please refresh and try again.' },
          { status: 409 }
        );
      }
      if (error.message.startsWith('LOAD_NOT_AVAILABLE:')) {
        const status = error.message.split(':')[1];
        return NextResponse.json(
          { error: `Load is no longer available (status: ${status})` },
          { status: 400 }
        );
      }
      if (error.message.startsWith('TRUCK_ALREADY_BUSY:')) {
        const [, pickup, delivery] = error.message.split(':');
        return NextResponse.json(
          { error: `This truck is already assigned to an active load (${pickup} → ${delivery})` },
          { status: 409 }
        );
      }
      throw error; // Re-throw for generic error handling
    }

    // P0-005 FIX: Cache invalidation after transaction commits (fire-and-forget)
    await CacheInvalidation.load(loadId, load.shipperId);
    await CacheInvalidation.truck(truckId, truck.carrierId);

    // HIGH FIX #8: Non-critical financial operations with idempotency checks
    // NOTE: These are intentionally outside the main transaction because:
    // 1. Assignment should succeed even if escrow/fee operations fail
    // 2. These operations have internal idempotency - calling twice won't double-charge
    // 3. LoadEvents serve as idempotency markers to prevent duplicate processing

    // Escrow hold with idempotency check
    let escrowResult = null;
    try {
      const existingEscrowEvent = await db.loadEvent.findFirst({
        where: { loadId, eventType: 'ESCROW_FUNDED' },
      });

      if (!existingEscrowEvent) {
        escrowResult = await holdFundsInEscrow(loadId);
        if (escrowResult.success) {
          await db.loadEvent.create({
            data: {
              loadId,
              eventType: 'ESCROW_FUNDED',
              description: `Funds held in escrow: ${escrowResult.escrowAmount.toFixed(2)} ETB`,
              userId: session.userId,
              metadata: { escrowAmount: escrowResult.escrowAmount.toFixed(2), transactionId: escrowResult.transactionId },
            },
          });
        }
      }
    } catch (error) {
      console.error('Escrow hold error:', error);
    }

    // Service fee reservation with idempotency check
    let serviceFeeResult = null;
    try {
      const existingFeeEvent = await db.loadEvent.findFirst({
        where: { loadId, eventType: 'SERVICE_FEE_RESERVED' },
      });

      if (!existingFeeEvent) {
        serviceFeeResult = await reserveServiceFee(loadId);
        if (serviceFeeResult.success && serviceFeeResult.transactionId) {
          await db.loadEvent.create({
            data: {
              loadId,
              eventType: 'SERVICE_FEE_RESERVED',
              description: `Service fee reserved: ${serviceFeeResult.serviceFee.toFixed(2)} ETB`,
              userId: session.userId,
              metadata: { serviceFee: serviceFeeResult.serviceFee.toFixed(2), transactionId: serviceFeeResult.transactionId },
            },
          });
        }
      }
    } catch (error) {
      console.error('Service fee reserve error:', error);
    }

    // Non-critical: Enable GPS tracking (outside transaction, fire-and-forget)
    let trackingUrl: string | null = result.trackingUrl;
    if (truck.imei && truck.gpsVerifiedAt) {
      try {
        const gpsUrl = await enableTrackingForLoad(loadId, truckId);
        if (gpsUrl) trackingUrl = gpsUrl;
        await db.loadEvent.create({
          data: {
            loadId,
            eventType: 'TRACKING_ENABLED',
            description: `GPS tracking enabled: ${trackingUrl}`,
            userId: session.userId,
          },
        });
      } catch (error) {
        console.error('Failed to enable GPS tracking:', error);
      }
    }

    return NextResponse.json({
      load: result.load,
      trip: result.trip,
      trackingUrl,
      escrow: escrowResult
        ? {
            success: escrowResult.success,
            amount: escrowResult.escrowAmount.toFixed(2),
            error: escrowResult.error,
          }
        : null,
      serviceFee: serviceFeeResult
        ? {
            success: serviceFeeResult.success,
            amount: serviceFeeResult.serviceFee.toFixed(2),
            error: serviceFeeResult.error,
          }
        : null,
      message: trackingUrl
        ? 'Load assigned successfully. GPS tracking enabled.'
        : 'Load assigned successfully. GPS tracking not available for this truck.',
    });
  } catch (error: any) {
    console.error('Assign load error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    // Handle unique constraint violation (race condition)
    if (error?.code === 'P2002') {
      const field = error?.meta?.target?.[0] || 'field';
      if (field === 'assignedTruckId') {
        return NextResponse.json(
          { error: 'This truck is already assigned to another load. Please refresh and try again.' },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: 'A conflict occurred. Please refresh and try again.' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
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
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    // Sprint 16: Use dispatcher permissions utility
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
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
        { error: 'You do not have permission to unassign this load' },
        { status: 403 }
      );
    }

    if (!load.assignedTruckId) {
      return NextResponse.json(
        { error: 'Load is not assigned to any truck' },
        { status: 400 }
      );
    }

    // Sprint 3: Determine target status based on current state
    // ASSIGNED → SEARCHING (reassign workflow)
    // PICKUP_PENDING → SEARCHING (carrier couldn't pick up)
    // Other states → cannot unassign
    let targetStatus: LoadStatus;

    if (load.status === 'ASSIGNED' || load.status === 'PICKUP_PENDING') {
      targetStatus = LoadStatus.SEARCHING;
    } else if (load.status === 'IN_TRANSIT' || load.status === 'DELIVERED') {
      return NextResponse.json(
        { error: 'Cannot unassign load that is in transit or delivered' },
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

    // Sprint 8: Refund escrowed funds if load was funded
    const loadDetails = await db.load.findUnique({
      where: { id: loadId },
      select: { escrowFunded: true },
    });

    let refundResult = null;
    if (loadDetails?.escrowFunded) {
      try {
        refundResult = await refundEscrowFunds(loadId);

        if (refundResult.success) {
          await db.loadEvent.create({
            data: {
              loadId,
              eventType: 'ESCROW_REFUNDED',
              description: `Escrow funds refunded: ${refundResult.escrowAmount.toFixed(2)} ETB`,
              userId: session.userId,
              metadata: {
                escrowAmount: refundResult.escrowAmount.toFixed(2),
                transactionId: refundResult.transactionId,
              },
            },
          });
        }
      } catch (error) {
        console.error('Escrow refund error:', error);
        // Continue with unassignment even if refund fails
      }
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
        eventType: 'UNASSIGNED',
        description: 'Load unassigned from truck',
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
      refund: refundResult
        ? {
            success: refundResult.success,
            amount: refundResult.escrowAmount.toFixed(2),
          }
        : null,
      message: 'Load unassigned successfully. GPS tracking disabled.',
    });
  } catch (error) {
    console.error('Unassign load error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

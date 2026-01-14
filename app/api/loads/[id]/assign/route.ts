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

    // Sprint 4: Check for assignment conflicts
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

    // Assign truck to load
    const updatedLoad = await db.load.update({
      where: { id: loadId },
      data: {
        assignedTruckId: truckId,
        assignedAt: new Date(),
        status: 'ASSIGNED', // Sprint 3: State machine validated transition
      },
    });

    // Create assignment event
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: 'ASSIGNED',
        description: `Load assigned to truck ${truck.licensePlate}`,
        userId: session.userId,
      },
    });

    // Sprint 8: Hold funds in escrow
    let escrowResult = null;
    try {
      escrowResult = await holdFundsInEscrow(loadId);

      if (!escrowResult.success) {
        console.warn(`Escrow hold failed for load ${loadId}:`, escrowResult.error);

        // Create warning event
        await db.loadEvent.create({
          data: {
            loadId,
            eventType: 'ESCROW_HOLD_FAILED',
            description: `Escrow hold failed: ${escrowResult.error}`,
            userId: session.userId,
            metadata: {
              error: escrowResult.error,
              escrowAmount: escrowResult.escrowAmount.toFixed(2),
              shipperBalance: escrowResult.shipperBalance.toFixed(2),
            },
          },
        });
      } else {
        // Create success event
        await db.loadEvent.create({
          data: {
            loadId,
            eventType: 'ESCROW_FUNDED',
            description: `Funds held in escrow: ${escrowResult.escrowAmount.toFixed(2)} ETB`,
            userId: session.userId,
            metadata: {
              escrowAmount: escrowResult.escrowAmount.toFixed(2),
              transactionId: escrowResult.transactionId,
            },
          },
        });
      }
    } catch (error) {
      console.error('Escrow hold error:', error);
      // Continue - assignment succeeded, escrow can be handled manually if needed
    }

    // Service Fee Implementation: Reserve service fee from shipper wallet
    let serviceFeeResult = null;
    try {
      serviceFeeResult = await reserveServiceFee(loadId);

      if (!serviceFeeResult.success && serviceFeeResult.error) {
        console.warn(`Service fee reserve failed for load ${loadId}:`, serviceFeeResult.error);

        // Create warning event (non-blocking)
        await db.loadEvent.create({
          data: {
            loadId,
            eventType: 'SERVICE_FEE_RESERVE_FAILED',
            description: `Service fee reserve failed: ${serviceFeeResult.error}`,
            userId: session.userId,
            metadata: {
              error: serviceFeeResult.error,
              serviceFee: serviceFeeResult.serviceFee.toFixed(2),
            },
          },
        });
      } else if (serviceFeeResult.success && serviceFeeResult.transactionId) {
        // Create success event
        await db.loadEvent.create({
          data: {
            loadId,
            eventType: 'SERVICE_FEE_RESERVED',
            description: `Service fee reserved: ${serviceFeeResult.serviceFee.toFixed(2)} ETB`,
            userId: session.userId,
            metadata: {
              serviceFee: serviceFeeResult.serviceFee.toFixed(2),
              transactionId: serviceFeeResult.transactionId,
            },
          },
        });
      }
    } catch (error) {
      console.error('Service fee reserve error:', error);
      // Continue - assignment succeeded, service fee can be handled manually if needed
    }

    // Sprint 16: Enable GPS tracking if truck has GPS
    let trackingUrl: string | null = null;

    if (truck.imei && truck.gpsVerifiedAt) {
      try {
        trackingUrl = await enableTrackingForLoad(loadId, truckId);

        // Create tracking event
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
        // Continue even if tracking fails - assignment is still successful
      }
    }

    return NextResponse.json({
      load: updatedLoad,
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
      },
    });

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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { enableTrackingForLoad } from '@/lib/gpsTracking';
import { canAssignLoads } from '@/lib/dispatcherPermissions';
import { validateStateTransition, LoadStatus } from '@/lib/loadStateMachine';

const assignLoadSchema = z.object({
  truckId: z.string(),
});

/**
 * POST /api/loads/[id]/assign
 *
 * Assign a truck to a load and enable GPS tracking
 *
 * Sprint 16 - Story 16.3: GPS Live Tracking
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
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    if (!truck.isAvailable) {
      return NextResponse.json(
        { error: 'Truck is not available' },
        { status: 400 }
      );
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
      message: trackingUrl
        ? 'Load assigned successfully. GPS tracking enabled.'
        : 'Load assigned successfully. GPS tracking not available for this truck.',
    });
  } catch (error) {
    console.error('Assign load error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
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

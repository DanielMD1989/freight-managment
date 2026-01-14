/**
 * Sprint 3: Load Lifecycle State Machine
 * API endpoint for updating load status with state machine validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireActiveUser } from '@/lib/auth';
import { z } from 'zod';
import { validateStateTransition, LoadStatus, getStatusDescription } from '@/lib/loadStateMachine';
import { deductServiceFee, refundServiceFee } from '@/lib/serviceFeeManagement'; // Service Fee Implementation

const updateStatusSchema = z.object({
  status: z.enum([
    'DRAFT',
    'POSTED',
    'SEARCHING',
    'OFFERED',
    'ASSIGNED',
    'PICKUP_PENDING',
    'IN_TRANSIT',
    'DELIVERED',
    'COMPLETED',
    'EXCEPTION',
    'CANCELLED',
    'EXPIRED',
    'UNPOSTED',
  ]),
  reason: z.string().optional(), // Optional reason for status change
  notes: z.string().optional(),  // Optional notes
});

// PATCH /api/loads/[id]/status - Update load status
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require ACTIVE user status for updating load status
    const session = await requireActiveUser();
    const { id: loadId } = await params;

    const body = await request.json();
    const { status: newStatus, reason, notes } = updateStatusSchema.parse(body);

    // Get current load
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        assignedTruckId: true,
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            role: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Validate state transition
    const validation = validateStateTransition(
      load.status,
      newStatus,
      session.role
    );

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    // Get user's organization for ownership check
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    // Check ownership permissions
    const isShipper = session.role === 'SHIPPER' && load.shipperId === user?.organizationId;
    const isCarrier = session.role === 'CARRIER' && load.assignedTruck?.carrierId === user?.organizationId;
    const isDispatcher = session.role === 'DISPATCHER';
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    // Additional permission check based on role
    if (!isAdmin && !isDispatcher) {
      // Shippers can only update their own loads
      if (isShipper) {
        const shipperStatuses = ['DRAFT', 'POSTED', 'CANCELLED', 'UNPOSTED'];
        if (!shipperStatuses.includes(newStatus)) {
          return NextResponse.json(
            { error: 'Shippers can only set status to DRAFT, POSTED, CANCELLED, or UNPOSTED' },
            { status: 403 }
          );
        }
      }

      // Carriers can only update assigned loads
      if (isCarrier) {
        const carrierStatuses = ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED'];
        if (!carrierStatuses.includes(newStatus)) {
          return NextResponse.json(
            { error: 'Carriers can only set status to ASSIGNED, PICKUP_PENDING, IN_TRANSIT, or DELIVERED' },
            { status: 403 }
          );
        }
      }

      // If not owner and not admin/dispatcher, deny
      if (!isShipper && !isCarrier) {
        return NextResponse.json(
          { error: 'You do not have permission to update this load' },
          { status: 403 }
        );
      }
    }

    // Determine if truck should be unassigned (terminal states)
    const terminalStatuses = ['COMPLETED', 'DELIVERED', 'CANCELLED', 'EXPIRED'];
    const shouldUnassignTruck = terminalStatuses.includes(newStatus) && load.assignedTruckId;

    // Update load status
    const updatedLoad = await db.load.update({
      where: { id: loadId },
      data: {
        status: newStatus,
        updatedAt: new Date(),
        // Unassign truck when load reaches terminal state
        ...(shouldUnassignTruck && {
          assignedTruckId: null,
          trackingEnabled: false,
        }),
      },
      select: {
        id: true,
        status: true,
        pickupCity: true,
        deliveryCity: true,
        shipperId: true,
        assignedTruckId: true,
        updatedAt: true,
      },
    });

    // Log truck unassignment if it happened
    if (shouldUnassignTruck) {
      await db.loadEvent.create({
        data: {
          loadId,
          eventType: 'UNASSIGNED',
          description: `Truck automatically unassigned - load status changed to ${newStatus}`,
          userId: session.userId,
        },
      });
    }

    // Log the status change
    console.log(`Load ${loadId} status updated: ${load.status} → ${newStatus}`, {
      loadId,
      previousStatus: load.status,
      newStatus,
      updatedBy: session.userId,
      userRole: session.role,
      reason,
      notes,
      timestamp: new Date().toISOString(),
    });

    // Service Fee Implementation: Handle service fee based on new status
    let serviceFeeResult = null;
    if (newStatus === 'COMPLETED') {
      // Deduct service fees from both shipper and carrier on completion
      try {
        serviceFeeResult = await deductServiceFee(loadId);

        if (serviceFeeResult.success && serviceFeeResult.transactionId) {
          await db.loadEvent.create({
            data: {
              loadId,
              eventType: 'SERVICE_FEE_DEDUCTED',
              description: `Service fees deducted - Shipper: ${serviceFeeResult.shipperFee.toFixed(2)} ETB, Carrier: ${serviceFeeResult.carrierFee.toFixed(2)} ETB, Total: ${serviceFeeResult.totalPlatformFee.toFixed(2)} ETB`,
              userId: session.userId,
              metadata: {
                shipperFee: serviceFeeResult.shipperFee.toFixed(2),
                carrierFee: serviceFeeResult.carrierFee.toFixed(2),
                totalPlatformFee: serviceFeeResult.totalPlatformFee.toFixed(2),
                transactionId: serviceFeeResult.transactionId,
                details: serviceFeeResult.details,
              },
            },
          });
        }
      } catch (error) {
        console.error('Service fee deduction error:', error);
      }
    } else if (newStatus === 'CANCELLED') {
      // Refund service fee to shipper on cancellation
      try {
        serviceFeeResult = await refundServiceFee(loadId);

        if (serviceFeeResult.success && serviceFeeResult.transactionId) {
          await db.loadEvent.create({
            data: {
              loadId,
              eventType: 'SERVICE_FEE_REFUNDED',
              description: `Service fee refunded: ${serviceFeeResult.serviceFee.toFixed(2)} ETB`,
              userId: session.userId,
              metadata: {
                serviceFee: serviceFeeResult.serviceFee.toFixed(2),
                transactionId: serviceFeeResult.transactionId,
              },
            },
          });
        }
      } catch (error) {
        console.error('Service fee refund error:', error);
      }
    }

    // TODO: Create LoadStatusHistory record for audit trail
    // TODO: Trigger notifications to relevant parties
    // TODO: Trigger automation rules based on new status

    // Build service fee response based on action type
    let serviceFeeResponse = null;
    if (serviceFeeResult) {
      if (newStatus === 'COMPLETED' && 'shipperFee' in serviceFeeResult) {
        // Deduction result with dual-party fees
        serviceFeeResponse = {
          success: serviceFeeResult.success,
          shipperFee: serviceFeeResult.shipperFee.toFixed(2),
          carrierFee: serviceFeeResult.carrierFee.toFixed(2),
          totalPlatformFee: serviceFeeResult.totalPlatformFee.toFixed(2),
          action: 'deducted',
          error: serviceFeeResult.error,
          details: serviceFeeResult.details,
        };
      } else {
        // Refund result (legacy format)
        serviceFeeResponse = {
          success: serviceFeeResult.success,
          amount: serviceFeeResult.serviceFee.toFixed(2),
          action: newStatus === 'CANCELLED' ? 'refunded' : null,
          error: serviceFeeResult.error,
        };
      }
    }

    return NextResponse.json({
      message: `Load status updated to ${newStatus}`,
      description: getStatusDescription(newStatus as LoadStatus),
      load: updatedLoad,
      serviceFee: serviceFeeResponse,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Load status update error:', error);
    return NextResponse.json(
      { error: 'Failed to update load status' },
      { status: 500 }
    );
  }
}

// GET /api/loads/[id]/status - Get load status and valid next states
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: loadId } = await params;

    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    const { getValidNextStates } = await import('@/lib/loadStateMachine');
    const validNextStates = getValidNextStates(load.status as LoadStatus);

    return NextResponse.json({
      currentStatus: load.status,
      description: getStatusDescription(load.status as LoadStatus),
      validNextStates,
    });

  } catch (error) {
    console.error('Load status fetch error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch load status' },
      { status: 500 }
    );
  }
}

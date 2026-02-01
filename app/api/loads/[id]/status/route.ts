/**
 * Sprint 3: Load Lifecycle State Machine
 * API endpoint for updating load status with state machine validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, requireActiveUser } from '@/lib/auth';
import { z } from 'zod';
import { validateStateTransition, LoadStatus, getStatusDescription } from '@/lib/loadStateMachine';
import { TripStatus } from '@prisma/client'; // P0-001 FIX: Import TripStatus enum
import { deductServiceFee, refundServiceFee } from '@/lib/serviceFeeManagement'; // Service Fee Implementation
// CRITICAL FIX: Import CacheInvalidation for status changes
import { CacheInvalidation } from '@/lib/cache';
// CRITICAL FIX: Import notification helper for status change notifications
import { createNotification } from '@/lib/notifications';
// CRITICAL FIX: Import trust metrics for analytics tracking
import { incrementCompletedLoads, incrementCancelledLoads } from '@/lib/trustMetrics';
// CRITICAL FIX: Import bypass detection for suspicious cancellations
import { checkSuspiciousCancellation } from '@/lib/bypassDetection';

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

    // Get current load with trip information for P0-001 fix
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
        // P0-001 FIX: Include trip for status sync
        trip: {
          select: {
            id: true,
            status: true,
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

    // P0-001 FIX: Map Load status to Trip status for synchronization
    const loadStatusToTripStatus: Record<string, TripStatus | null> = {
      'ASSIGNED': TripStatus.ASSIGNED,
      'PICKUP_PENDING': TripStatus.PICKUP_PENDING,
      'IN_TRANSIT': TripStatus.IN_TRANSIT,
      'DELIVERED': TripStatus.DELIVERED,
      'COMPLETED': TripStatus.COMPLETED,
      'CANCELLED': TripStatus.CANCELLED,
      'EXPIRED': TripStatus.CANCELLED,
      'EXCEPTION': null, // Don't change trip status for exceptions
    };

    // P0-001 FIX: Use transaction to ensure atomic Load + Trip status update
    const { updatedLoad, tripUpdated } = await db.$transaction(async (tx) => {
      // Update load status
      const updatedLoad = await tx.load.update({
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

      // P0-001 FIX: Sync Trip status if trip exists and status mapping exists
      let tripUpdated = false;
      const tripStatus = loadStatusToTripStatus[newStatus];
      if (load.trip?.id && tripStatus && load.trip.status !== tripStatus) {
        await tx.trip.update({
          where: { id: load.trip.id },
          data: {
            status: tripStatus,
            updatedAt: new Date(),
            // Set completion time for terminal states
            ...(tripStatus === 'COMPLETED' && { completedAt: new Date() }),
            ...(tripStatus === 'CANCELLED' && { cancelledAt: new Date() }),
          },
        });

        // Log trip status sync in LoadEvent (no TripEvent model exists)
        await tx.loadEvent.create({
          data: {
            loadId,
            eventType: 'TRIP_STATUS_SYNCED',
            description: `Trip status synced to ${tripStatus} (Load status: ${newStatus})`,
            userId: session.userId,
            metadata: {
              tripId: load.trip.id,
              previousTripStatus: load.trip.status,
              newTripStatus: tripStatus,
              triggeredBy: 'load_status_change',
              loadStatus: newStatus,
            },
          },
        });

        tripUpdated = true;
      }

      // Log truck unassignment if it happened (inside transaction)
      if (shouldUnassignTruck) {
        await tx.loadEvent.create({
          data: {
            loadId,
            eventType: 'UNASSIGNED',
            description: `Truck automatically unassigned - load status changed to ${newStatus}`,
            userId: session.userId,
          },
        });
      }

      return { updatedLoad, tripUpdated };
    });

    // Log the status change
    // HIGH FIX #3: Service Fee Implementation with idempotency check
    // NOTE: Service fee operations are intentionally outside the main transaction because:
    // 1. They may call external payment services (cannot be rolled back)
    // 2. Status change should succeed even if fee processing fails
    // 3. deductServiceFee/refundServiceFee have internal idempotency checks
    let serviceFeeResult = null;
    if (newStatus === 'COMPLETED') {
      // Deduct service fees from both shipper and carrier on completion
      try {
        // Check if fee already deducted (idempotency)
        const existingFeeEvent = await db.loadEvent.findFirst({
          where: { loadId, eventType: 'SERVICE_FEE_DEDUCTED' },
        });

        if (!existingFeeEvent) {
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
        }
      } catch (error) {
        console.error('Service fee deduction error:', error);
      }
    } else if (newStatus === 'CANCELLED') {
      // Refund service fee to shipper on cancellation
      try {
        // Check if fee already refunded (idempotency)
        const existingRefundEvent = await db.loadEvent.findFirst({
          where: { loadId, eventType: 'SERVICE_FEE_REFUNDED' },
        });

        if (!existingRefundEvent) {
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
        }
      } catch (error) {
        console.error('Service fee refund error:', error);
      }
    }

    // CRITICAL FIX: Invalidate cache after status change
    await CacheInvalidation.load(loadId, load.shipperId);

    // CRITICAL FIX: Create LoadEvent for status change audit trail
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: 'STATUS_CHANGED',
        description: `Status changed from ${load.status} to ${newStatus}${reason ? ` - ${reason}` : ''}`,
        userId: session.userId,
        metadata: {
          previousStatus: load.status,
          newStatus,
          reason,
          notes,
        },
      },
    });

    // CRITICAL FIX: Trigger notifications to relevant parties
    const notificationPromises: Promise<any>[] = [];

    // Notify shipper of status changes
    const shipperUsers = await db.user.findMany({
      where: { organizationId: load.shipperId, status: 'ACTIVE' },
      select: { id: true },
    });
    for (const user of shipperUsers) {
      notificationPromises.push(
        createNotification({
          userId: user.id,
          type: 'LOAD_STATUS_CHANGE',
          title: `Load Status: ${newStatus}`,
          message: `Your load status has been updated to ${getStatusDescription(newStatus as LoadStatus)}`,
          metadata: { loadId, previousStatus: load.status, newStatus },
        }).catch(console.error)
      );
    }

    // Notify carrier if assigned
    if (load.assignedTruck?.carrierId) {
      const carrierUsers = await db.user.findMany({
        where: { organizationId: load.assignedTruck.carrierId, status: 'ACTIVE' },
        select: { id: true },
      });
      for (const user of carrierUsers) {
        notificationPromises.push(
          createNotification({
            userId: user.id,
            type: 'LOAD_STATUS_CHANGE',
            title: `Load Status: ${newStatus}`,
            message: `Load status has been updated to ${getStatusDescription(newStatus as LoadStatus)}`,
            metadata: { loadId, previousStatus: load.status, newStatus },
          }).catch(console.error)
        );
      }
    }

    // Fire-and-forget notifications
    Promise.all(notificationPromises).catch(console.error);

    // CRITICAL FIX: Update trust metrics for analytics tracking
    if (newStatus === 'DELIVERED' || newStatus === 'COMPLETED') {
      // Increment completed loads for shipper
      if (load.shipperId) {
        await incrementCompletedLoads(load.shipperId).catch(console.error);
      }
      // Increment completed loads for carrier if assigned
      if (load.assignedTruck?.carrierId) {
        await incrementCompletedLoads(load.assignedTruck.carrierId).catch(console.error);
      }
    } else if (newStatus === 'CANCELLED') {
      // Increment cancelled loads for shipper
      if (load.shipperId) {
        await incrementCancelledLoads(load.shipperId).catch(console.error);
      }
      // Check for suspicious bypass pattern
      await checkSuspiciousCancellation(loadId).catch(console.error);
    }

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
      // P0-001 FIX: Include trip sync status in response
      tripSynced: tripUpdated,
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

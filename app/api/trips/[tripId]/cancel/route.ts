/**
 * Trip Cancellation API
 *
 * POST /api/trips/[tripId]/cancel - Cancel a trip
 *
 * Trips can be cancelled by carrier or shipper before COMPLETED status
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { createNotification, NotificationType } from '@/lib/notifications';
import { z } from 'zod';

const cancelTripSchema = z.object({
  reason: z.string().min(1, 'Cancellation reason is required').max(500),
});

/**
 * POST /api/trips/[tripId]/cancel
 *
 * Cancel a trip
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const session = await requireAuth();

    // Parse and validate request body
    const body = await request.json();
    const validatedData = cancelTripSchema.parse(body);

    // Get trip details
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            escrowFunded: true,
            escrowAmount: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
            users: {
              select: { id: true },
              take: 1,
            },
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
            users: {
              select: { id: true },
              take: 1,
            },
          },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Cannot cancel COMPLETED or already CANCELLED trips
    if (trip.status === 'COMPLETED') {
      return NextResponse.json(
        { error: 'Cannot cancel a completed trip' },
        { status: 400 }
      );
    }

    if (trip.status === 'CANCELLED') {
      return NextResponse.json(
        { error: 'Trip is already cancelled' },
        { status: 400 }
      );
    }

    // Check if user has permission to cancel
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isCarrier = user?.organizationId === trip.carrierId;
    const isShipper = user?.organizationId === trip.shipperId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';
    const isDispatcher = session.role === 'DISPATCHER';

    if (!isCarrier && !isShipper && !isAdmin && !isDispatcher) {
      return NextResponse.json(
        { error: 'You do not have permission to cancel this trip' },
        { status: 403 }
      );
    }

    // Determine who is cancelling for notification purposes
    const cancelledByRole = isCarrier ? 'Carrier' : isShipper ? 'Shipper' : 'Admin';

    // Update trip status to CANCELLED
    const updatedTrip = await db.trip.update({
      where: { id: tripId },
      data: {
        status: 'CANCELLED',
        cancelledAt: new Date(),
        cancelledBy: session.userId,
        cancelReason: validatedData.reason,
        trackingEnabled: false,
      },
    });

    // Update Load status back to POSTED or CANCELLED
    await db.load.update({
      where: { id: trip.loadId },
      data: {
        status: 'CANCELLED',
        assignedTruckId: null,
        assignedAt: null,
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId: trip.loadId,
        eventType: 'TRIP_CANCELLED',
        description: `Trip cancelled by ${cancelledByRole}. Reason: ${validatedData.reason}`,
        userId: session.userId,
        metadata: {
          tripId,
          cancelledBy: cancelledByRole,
          reason: validatedData.reason,
          previousStatus: trip.status,
        },
      },
    });

    // Notify the other party
    if (isCarrier || isAdmin) {
      // Notify shipper
      const shipperUserId = trip.shipper?.users?.[0]?.id;
      if (shipperUserId) {
        await createNotification({
          userId: shipperUserId,
          type: NotificationType.TRIP_CANCELLED,
          title: 'Trip Cancelled',
          message: `${trip.carrier?.name || 'Carrier'} has cancelled the trip ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}. Reason: ${validatedData.reason}`,
          metadata: { tripId, loadId: trip.loadId },
        });
      }
    }

    if (isShipper || isAdmin) {
      // Notify carrier
      const carrierUserId = trip.carrier?.users?.[0]?.id;
      if (carrierUserId) {
        await createNotification({
          userId: carrierUserId,
          type: NotificationType.TRIP_CANCELLED,
          title: 'Trip Cancelled',
          message: `${trip.shipper?.name || 'Shipper'} has cancelled the trip ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}. Reason: ${validatedData.reason}`,
          metadata: { tripId, loadId: trip.loadId },
        });
      }
    }

    // Handle escrow refund if applicable
    let escrowRefunded = false;
    if (trip.load?.escrowFunded && trip.load?.escrowAmount) {
      // TODO: Implement escrow refund logic
      // For now, just log that refund is needed
      await db.loadEvent.create({
        data: {
          loadId: trip.loadId,
          eventType: 'ESCROW_REFUND_PENDING',
          description: `Escrow refund pending: ${Number(trip.load.escrowAmount).toFixed(2)} ETB`,
          userId: session.userId,
        },
      });
      escrowRefunded = true;
    }

    return NextResponse.json({
      message: 'Trip cancelled successfully',
      trip: {
        id: updatedTrip.id,
        status: updatedTrip.status,
        cancelledAt: updatedTrip.cancelledAt,
        cancelReason: updatedTrip.cancelReason,
      },
      escrowRefundPending: escrowRefunded,
    });
  } catch (error) {
    console.error('Cancel trip error:', error);

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

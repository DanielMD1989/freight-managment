/**
 * Trip Delivery Confirmation API
 *
 * POST /api/trips/[tripId]/confirm - Shipper confirms delivery
 *
 * After carrier uploads POD, shipper must confirm delivery
 * to complete the trip and trigger settlement
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { createNotification, NotificationType } from '@/lib/notifications';
import { releaseFundsFromEscrow } from '@/lib/escrowManagement';
import { CacheInvalidation } from '@/lib/cache';

/**
 * POST /api/trips/[tripId]/confirm
 *
 * Shipper confirms delivery after reviewing POD
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const { tripId } = await params;
    const session = await requireAuth();

    // Parse request body for optional notes
    let confirmationNotes: string | null = null;
    try {
      const body = await request.json();
      confirmationNotes = body.notes || null;
    } catch {
      // No body provided - that's fine
    }

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
            podSubmitted: true,
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
          select: { id: true },
        },
        podDocuments: {
          select: { id: true },
        },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Only DELIVERED trips can be confirmed
    if (trip.status !== 'DELIVERED') {
      return NextResponse.json(
        { error: 'Trip must be in DELIVERED status to confirm' },
        { status: 400 }
      );
    }

    // Check if already confirmed
    if (trip.shipperConfirmed) {
      return NextResponse.json(
        { error: 'Delivery has already been confirmed' },
        { status: 400 }
      );
    }

    // Check if POD was submitted
    const hasPod = trip.podDocuments.length > 0 || trip.load?.podSubmitted;
    if (!hasPod) {
      return NextResponse.json(
        { error: 'Cannot confirm delivery - no POD has been submitted' },
        { status: 400 }
      );
    }

    // Check if user is the shipper
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isShipper = user?.organizationId === trip.shipperId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isShipper && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the shipper can confirm delivery' },
        { status: 403 }
      );
    }

    // CRITICAL FIX: Wrap all state changes in a transaction for atomicity
    const updatedTrip = await db.$transaction(async (tx) => {
      // Update trip with confirmation
      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: {
          shipperConfirmed: true,
          shipperConfirmedAt: new Date(),
          shipperConfirmedBy: session.userId,
          status: 'COMPLETED',
          completedAt: new Date(),
          trackingEnabled: false, // GPS stops on completion
        },
      });

      // Update Load model for backward compatibility
      await tx.load.update({
        where: { id: trip.loadId },
        data: {
          status: 'COMPLETED',
          podVerified: true,
          podVerifiedAt: new Date(),
        },
      });

      // Create load event inside transaction
      await tx.loadEvent.create({
        data: {
          loadId: trip.loadId,
          eventType: 'DELIVERY_CONFIRMED',
          description: confirmationNotes
            ? `Delivery confirmed by shipper. Notes: ${confirmationNotes}`
            : 'Delivery confirmed by shipper',
          userId: session.userId,
          metadata: {
            tripId,
            confirmedAt: new Date().toISOString(),
          },
        },
      });

      return updatedTrip;
    });

    // Cache invalidation after transaction commits
    await CacheInvalidation.trip(tripId, trip.carrier?.id || '', trip.shipperId || '');
    await CacheInvalidation.load(trip.loadId, trip.shipperId || '');

    // Notify carrier that delivery has been confirmed
    const carrierUserId = trip.carrier?.users?.[0]?.id;
    if (carrierUserId) {
      await createNotification({
        userId: carrierUserId,
        type: NotificationType.POD_VERIFIED,
        title: 'Delivery Confirmed',
        message: `Shipper has confirmed delivery for trip ${trip.load?.pickupCity} → ${trip.load?.deliveryCity}. Settlement can now proceed.`,
        metadata: { tripId, loadId: trip.loadId },
      });
    }

    // Attempt to release escrow if funded
    let escrowReleaseResult = null;
    if (trip.load?.escrowFunded) {
      try {
        escrowReleaseResult = await releaseFundsFromEscrow(trip.loadId);

        if (escrowReleaseResult.success) {
          await db.loadEvent.create({
            data: {
              loadId: trip.loadId,
              eventType: 'ESCROW_RELEASED',
              description: `Escrow funds released: Carrier received ${escrowReleaseResult.carrierPayout.toFixed(2)} ETB`,
              userId: session.userId,
              metadata: {
                carrierPayout: escrowReleaseResult.carrierPayout.toFixed(2),
                platformRevenue: escrowReleaseResult.platformRevenue.toFixed(2),
                transactionId: escrowReleaseResult.transactionId,
              },
            },
          });
        } else {
          console.warn(`Escrow release failed for trip ${tripId}:`, escrowReleaseResult.error);
          await db.loadEvent.create({
            data: {
              loadId: trip.loadId,
              eventType: 'ESCROW_RELEASE_FAILED',
              description: `Escrow release failed: ${escrowReleaseResult.error}`,
              userId: session.userId,
            },
          });
        }
      } catch (error) {
        console.error('Escrow release error:', error);
      }
    }

    return NextResponse.json({
      message: escrowReleaseResult?.success
        ? 'Delivery confirmed. Funds released from escrow.'
        : 'Delivery confirmed successfully. Trip completed.',
      trip: {
        id: updatedTrip.id,
        status: updatedTrip.status,
        shipperConfirmed: updatedTrip.shipperConfirmed,
        shipperConfirmedAt: updatedTrip.shipperConfirmedAt,
        completedAt: updatedTrip.completedAt,
      },
      escrowRelease: escrowReleaseResult
        ? {
            success: escrowReleaseResult.success,
            carrierPayout: escrowReleaseResult.success
              ? escrowReleaseResult.carrierPayout.toFixed(2)
              : null,
            error: escrowReleaseResult.error,
          }
        : null,
    });
  } catch (error) {
    console.error('Confirm delivery error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

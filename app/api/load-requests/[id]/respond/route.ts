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

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { createNotification } from '@/lib/notifications';
import { enableTrackingForLoad } from '@/lib/gpsTracking';
import { UserRole, Prisma } from '@prisma/client';
import crypto from 'crypto';
// P0-003 FIX: Import CacheInvalidation for post-approval cache clearing
import { CacheInvalidation } from '@/lib/cache';

// Validation schema for load request response
const LoadRequestResponseSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
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
    const { id: requestId } = await params;
    const session = await requireAuth();

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
        { error: 'Load request not found' },
        { status: 404 }
      );
    }

    // Check if user is the shipper who owns the load
    const isShipperOwner = session.role === 'SHIPPER' &&
      session.organizationId === loadRequest.shipperId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isShipperOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the shipper who owns the load can respond' },
        { status: 403 }
      );
    }

    // Validate request body first (needed for idempotency check)
    const body = await request.json();
    const validationResult = LoadRequestResponseSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Check if request is still pending - handle idempotency
    if (loadRequest.status !== 'PENDING') {
      // Idempotent: If already in the desired state, return success
      if (
        (loadRequest.status === 'APPROVED' && data.action === 'APPROVE') ||
        (loadRequest.status === 'REJECTED' && data.action === 'REJECT')
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
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json(
        { error: 'Request has expired' },
        { status: 400 }
      );
    }

    if (data.action === 'APPROVE') {
      // P0-002 & P0-003 FIX: All checks and operations now inside atomic transaction
      // This prevents race conditions and ensures trip creation is atomic
      try {
        const result = await db.$transaction(async (tx) => {
          // P0-002 FIX: Re-fetch load inside transaction to prevent race condition
          const freshLoad = await tx.load.findUnique({
            where: { id: loadRequest.loadId },
            select: {
              id: true,
              status: true,
              assignedTruckId: true,
              shipperId: true,
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

          // P0-002 FIX: Check availability INSIDE transaction
          if (freshLoad.assignedTruckId) {
            throw new Error('LOAD_ALREADY_ASSIGNED');
          }

          const availableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
          if (!availableStatuses.includes(freshLoad.status)) {
            throw new Error(`LOAD_NOT_AVAILABLE:${freshLoad.status}`);
          }

          // Check if truck is already assigned to another active load
          const existingAssignment = await tx.load.findFirst({
            where: {
              assignedTruckId: loadRequest.truckId,
              status: { notIn: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] },
            },
            select: { id: true, pickupCity: true, deliveryCity: true, status: true },
          });

          if (existingAssignment) {
            throw new Error(`TRUCK_BUSY:${existingAssignment.pickupCity}:${existingAssignment.deliveryCity}`);
          }

          // Unassign truck from any completed loads
          await tx.load.updateMany({
            where: {
              assignedTruckId: loadRequest.truckId,
              status: { in: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] },
            },
            data: { assignedTruckId: null },
          });

          // Update load request to approved
          const updatedRequest = await tx.loadRequest.update({
            where: { id: requestId },
            data: {
              status: 'APPROVED',
              respondedAt: new Date(),
              responseNotes: data.responseNotes,
              respondedById: session.userId,
            },
          });

          // Assign load to truck
          const updatedLoad = await tx.load.update({
            where: { id: loadRequest.loadId },
            data: {
              assignedTruckId: loadRequest.truckId,
              assignedAt: new Date(),
              status: 'ASSIGNED',
            },
          });

          // P0-003 FIX: Create trip INSIDE transaction (atomic with assignment)
          const trackingUrl = `trip-${loadRequest.loadId.slice(-6)}-${crypto.randomBytes(12).toString('hex')}`;

          const trip = await tx.trip.create({
            data: {
              loadId: loadRequest.loadId,
              truckId: loadRequest.truckId,
              carrierId: loadRequest.carrierId,
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

          // Create load event
          await tx.loadEvent.create({
            data: {
              loadId: loadRequest.loadId,
              eventType: 'ASSIGNED',
              description: `Load assigned to ${loadRequest.carrier.name} (${loadRequest.truck.licensePlate}) via carrier request`,
              userId: session.userId,
              metadata: {
                loadRequestId: requestId,
                approvedViaRequest: true,
                carrierId: loadRequest.carrierId,
                tripId: trip.id,
              },
            },
          });

          // Cancel other pending load requests for this load
          await tx.loadRequest.updateMany({
            where: {
              loadId: loadRequest.loadId,
              id: { not: requestId },
              status: 'PENDING',
            },
            data: { status: 'CANCELLED' },
          });

          // Cancel pending truck requests for this load
          await tx.truckRequest.updateMany({
            where: {
              loadId: loadRequest.loadId,
              status: 'PENDING',
            },
            data: { status: 'CANCELLED' },
          });

          // Cancel pending match proposals
          await tx.matchProposal.updateMany({
            where: {
              loadId: loadRequest.loadId,
              status: 'PENDING',
            },
            data: { status: 'CANCELLED' },
          });

          return { request: updatedRequest, load: updatedLoad, trip };
        });

        // P0-003 FIX: Invalidate cache after approval to prevent stale data
        // This ensures the load no longer appears as available in searches
        // Note: truck() invalidation also clears matching:* and truck-postings:* caches
        await CacheInvalidation.load(loadRequest.loadId, loadRequest.load.shipperId);
        await CacheInvalidation.truck(loadRequest.truckId, loadRequest.truck.carrierId);

        // Non-critical: Enable GPS tracking outside transaction (fire-and-forget)
        let trackingUrl: string | null = result.trip?.trackingUrl || null;
        if (loadRequest.truck.imei && loadRequest.truck.gpsVerifiedAt) {
          enableTrackingForLoad(loadRequest.loadId, loadRequest.truckId)
            .then(url => { if (url) trackingUrl = url; })
            .catch(err => console.error('Failed to enable GPS tracking:', err));
        }

        // Non-critical: Notify carrier users (fire-and-forget)
        db.user.findMany({
          where: { organizationId: loadRequest.carrierId, status: 'ACTIVE' },
          select: { id: true },
        }).then(async (carrierUsers) => {
          for (const user of carrierUsers) {
            await createNotification({
              userId: user.id,
              type: 'LOAD_REQUEST_APPROVED',
              title: 'Load Request Approved',
              message: `Your request for the load from ${loadRequest.load.pickupCity} to ${loadRequest.load.deliveryCity} has been approved!`,
              metadata: {
                loadRequestId: requestId,
                loadId: loadRequest.loadId,
                truckId: loadRequest.truckId,
              },
            });
          }
        }).catch(err => console.error('Failed to notify carriers:', err));

        return NextResponse.json({
          request: result.request,
          load: result.load,
          trip: result.trip,
          trackingUrl,
          message: 'Load request approved. Load has been assigned to the carrier.',
        });

      } catch (error: any) {
        // Handle specific transaction errors
        if (error.message === 'LOAD_NOT_FOUND') {
          return NextResponse.json({ error: 'Load not found' }, { status: 404 });
        }
        if (error.message === 'LOAD_ALREADY_ASSIGNED') {
          return NextResponse.json(
            { error: 'Load has already been assigned to another truck' },
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
        if (error.message.startsWith('TRUCK_BUSY:')) {
          const [, pickup, delivery] = error.message.split(':');
          return NextResponse.json(
            { error: `This truck is already assigned to an active load (${pickup} → ${delivery})` },
            { status: 400 }
          );
        }
        throw error; // Re-throw for generic error handling
      }
    } else {
      // HIGH FIX #5: Wrap REJECT path in transaction for atomicity
      const updatedRequest = await db.$transaction(async (tx) => {
        const updatedRequest = await tx.loadRequest.update({
          where: { id: requestId },
          data: {
            status: 'REJECTED',
            respondedAt: new Date(),
            responseNotes: data.responseNotes,
            respondedById: session.userId,
          },
        });

        // Create load event inside transaction
        await tx.loadEvent.create({
          data: {
            loadId: loadRequest.loadId,
            eventType: 'LOAD_REQUEST_REJECTED',
            description: `Load request from ${loadRequest.carrier.name} was rejected`,
            userId: session.userId,
            metadata: {
              loadRequestId: requestId,
              rejectionReason: data.responseNotes,
            },
          },
        });

        return updatedRequest;
      });

      // Non-critical: Notify carrier users (fire-and-forget, outside transaction)
      const carrierUsers = await db.user.findMany({
        where: {
          organizationId: loadRequest.carrierId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      for (const user of carrierUsers) {
        createNotification({
          userId: user.id,
          type: 'LOAD_REQUEST_REJECTED',
          title: 'Load Request Rejected',
          message: `Your request for the load from ${loadRequest.load.pickupCity} to ${loadRequest.load.deliveryCity} was rejected.${data.responseNotes ? ` Reason: ${data.responseNotes}` : ''}`,
          metadata: {
            loadRequestId: requestId,
            loadId: loadRequest.loadId,
            reason: data.responseNotes,
          },
        }).catch(err => console.error('Failed to notify carrier:', err));
      }

      return NextResponse.json({
        request: updatedRequest,
        message: 'Load request rejected.',
      });
    }
  } catch (error: any) {
    console.error('Error responding to load request:', error);

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
      { error: 'Failed to respond to load request' },
      { status: 500 }
    );
  }
}

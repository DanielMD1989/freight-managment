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
import { UserRole } from '@prisma/client';

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

    // Check if request is still pending
    if (loadRequest.status !== 'PENDING') {
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

    // Validate request body
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

    if (data.action === 'APPROVE') {
      // Check if load is still available
      if (loadRequest.load.assignedTruckId) {
        return NextResponse.json(
          { error: 'Load has already been assigned to another truck' },
          { status: 400 }
        );
      }

      const availableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
      if (!availableStatuses.includes(loadRequest.load.status)) {
        return NextResponse.json(
          { error: `Load is no longer available (status: ${loadRequest.load.status})` },
          { status: 400 }
        );
      }

      // Check if truck is already assigned to another active load
      const existingAssignment = await db.load.findFirst({
        where: {
          assignedTruckId: loadRequest.truckId,
          status: {
            in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
          },
        },
        select: {
          id: true,
          status: true,
          pickupCity: true,
          deliveryCity: true,
        },
      });

      if (existingAssignment) {
        return NextResponse.json(
          {
            error: `This truck is already assigned to an active load (${existingAssignment.pickupCity} → ${existingAssignment.deliveryCity})`,
            existingLoadId: existingAssignment.id,
            existingLoadStatus: existingAssignment.status,
          },
          { status: 400 }
        );
      }

      // Transaction: Update request and assign load
      const result = await db.$transaction(async (tx) => {
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
            },
          },
        });

        // Cancel other pending requests for this load
        await tx.loadRequest.updateMany({
          where: {
            loadId: loadRequest.loadId,
            id: { not: requestId },
            status: 'PENDING',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        // Cancel other pending truck requests for this load
        await tx.truckRequest.updateMany({
          where: {
            loadId: loadRequest.loadId,
            status: 'PENDING',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        // Cancel pending match proposals for this load
        await tx.matchProposal.updateMany({
          where: {
            loadId: loadRequest.loadId,
            status: 'PENDING',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        return { request: updatedRequest, load: updatedLoad };
      });

      // Enable GPS tracking if available
      let trackingUrl: string | null = null;
      if (loadRequest.truck.imei && loadRequest.truck.gpsVerifiedAt) {
        try {
          trackingUrl = await enableTrackingForLoad(loadRequest.loadId, loadRequest.truckId);
        } catch (error) {
          console.error('Failed to enable GPS tracking:', error);
        }
      }

      // Notify carrier users
      const carrierUsers = await db.user.findMany({
        where: {
          organizationId: loadRequest.carrierId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

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

      return NextResponse.json({
        request: result.request,
        load: result.load,
        trackingUrl,
        message: 'Load request approved. Load has been assigned to the carrier.',
      });
    } else {
      // REJECT
      const updatedRequest = await db.loadRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          respondedAt: new Date(),
          responseNotes: data.responseNotes,
          respondedById: session.userId,
        },
      });

      // Create load event
      await db.loadEvent.create({
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

      // Notify carrier users
      const carrierUsers = await db.user.findMany({
        where: {
          organizationId: loadRequest.carrierId,
          status: 'ACTIVE',
        },
        select: { id: true },
      });

      for (const user of carrierUsers) {
        await createNotification({
          userId: user.id,
          type: 'LOAD_REQUEST_REJECTED',
          title: 'Load Request Rejected',
          message: `Your request for the load from ${loadRequest.load.pickupCity} to ${loadRequest.load.deliveryCity} was rejected.${data.responseNotes ? ` Reason: ${data.responseNotes}` : ''}`,
          metadata: {
            loadRequestId: requestId,
            loadId: loadRequest.loadId,
            reason: data.responseNotes,
          },
        });
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

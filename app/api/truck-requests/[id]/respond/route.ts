/**
 * Truck Request Response API
 *
 * Phase 2 - Foundation Rule: CARRIER_FINAL_AUTHORITY
 *
 * Allows carriers to approve or reject truck requests from shippers.
 * Only the carrier who owns the truck can respond.
 *
 * POST: Approve or reject a request (CARRIER only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { canApproveRequests } from '@/lib/dispatcherPermissions';
import { RULE_CARRIER_FINAL_AUTHORITY } from '@/lib/foundation-rules';
import { UserRole } from '@prisma/client';
import { enableTrackingForLoad } from '@/lib/gpsTracking';
import { notifyTruckRequestResponse } from '@/lib/notifications';
import { createTripForLoad } from '@/lib/tripManagement';

// Validation schema for request response
const RequestResponseSchema = z.object({
  action: z.enum(['APPROVE', 'REJECT']),
  responseNotes: z.string().max(500).optional(),
});

/**
 * POST /api/truck-requests/[id]/respond
 *
 * Respond to a truck request (approve or reject).
 *
 * Phase 2 Foundation Rule: CARRIER_FINAL_AUTHORITY
 * - Only the carrier who owns the truck can respond
 * - If approved, load is assigned to truck
 * - If rejected, request is marked as rejected
 *
 * Request body: RequestResponseSchema
 *
 * Returns: Updated request and load (if approved)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;
    const session = await requireAuth();

    // Get the request
    const truckRequest = await db.truckRequest.findUnique({
      where: { id: requestId },
      include: {
        truck: {
          select: {
            id: true,
            carrierId: true,
            licensePlate: true,
            imei: true,
            gpsVerifiedAt: true,
            carrier: {
              select: {
                name: true,
              },
            },
          },
        },
        load: {
          select: {
            id: true,
            status: true,
            assignedTruckId: true,
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!truckRequest) {
      return NextResponse.json(
        { error: 'Request not found' },
        { status: 404 }
      );
    }

    // Validate request body first (needed for idempotency check)
    const body = await request.json();
    const validationResult = RequestResponseSchema.safeParse(body);

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
    if (truckRequest.status !== 'PENDING') {
      // Idempotent: If already in the desired state, return success
      if (
        (truckRequest.status === 'APPROVED' && data.action === 'APPROVE') ||
        (truckRequest.status === 'REJECTED' && data.action === 'REJECT')
      ) {
        return NextResponse.json({
          request: truckRequest,
          message: `Request was already ${truckRequest.status.toLowerCase()}`,
          idempotent: true,
        });
      }

      return NextResponse.json(
        {
          error: `Request has already been ${truckRequest.status.toLowerCase()}`,
          currentStatus: truckRequest.status,
        },
        { status: 400 }
      );
    }

    // Check if request has expired
    if (new Date() > truckRequest.expiresAt) {
      // Mark as expired
      await db.truckRequest.update({
        where: { id: requestId },
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json(
        { error: 'Request has expired' },
        { status: 400 }
      );
    }

    // Check if user can approve (must be carrier who owns the truck)
    const user = {
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId,
    };

    if (!canApproveRequests(user, truckRequest.truck.carrierId)) {
      return NextResponse.json(
        {
          error: 'You do not have permission to respond to this request',
          rule: RULE_CARRIER_FINAL_AUTHORITY.id,
          hint: 'Only the carrier who owns the truck can respond',
        },
        { status: 403 }
      );
    }

    if (data.action === 'APPROVE') {
      // Check if load is still available
      if (truckRequest.load.assignedTruckId) {
        return NextResponse.json(
          { error: 'Load has already been assigned to another truck' },
          { status: 400 }
        );
      }

      const requestableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
      if (!requestableStatuses.includes(truckRequest.load.status)) {
        return NextResponse.json(
          { error: `Load is no longer available (status: ${truckRequest.load.status})` },
          { status: 400 }
        );
      }

      // Check if truck is already assigned to another load (unique constraint on assignedTruckId)
      const existingAssignment = await db.load.findFirst({
        where: {
          assignedTruckId: truckRequest.truckId,
        },
        select: {
          id: true,
          status: true,
          pickupCity: true,
          deliveryCity: true,
        },
      });

      if (existingAssignment) {
        // If the existing load is completed/delivered/cancelled, unassign it first
        const inactiveStatuses = ['DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'];
        if (inactiveStatuses.includes(existingAssignment.status)) {
          // Unassign truck from completed load
          await db.load.update({
            where: { id: existingAssignment.id },
            data: { assignedTruckId: null },
          });
        } else {
          return NextResponse.json(
            {
              error: `This truck is already assigned to an active load (${existingAssignment.pickupCity} → ${existingAssignment.deliveryCity})`,
              existingLoadId: existingAssignment.id,
              existingLoadStatus: existingAssignment.status,
            },
            { status: 400 }
          );
        }
      }

      // Transaction: Update request and assign load
      const result = await db.$transaction(async (tx) => {
        // Update request to approved
        const updatedRequest = await tx.truckRequest.update({
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
          where: { id: truckRequest.loadId },
          data: {
            assignedTruckId: truckRequest.truckId,
            assignedAt: new Date(),
            status: 'ASSIGNED',
          },
        });

        // Create load event
        await tx.loadEvent.create({
          data: {
            loadId: truckRequest.loadId,
            eventType: 'ASSIGNED',
            description: `Load assigned via shipper request (approved by carrier). Truck: ${truckRequest.truck.licensePlate}`,
            userId: session.userId,
            metadata: {
              requestId: requestId,
              approvedViaRequest: true,
              shipperName: truckRequest.shipper.name,
            },
          },
        });

        // Cancel other pending requests for this load
        await tx.truckRequest.updateMany({
          where: {
            loadId: truckRequest.loadId,
            id: { not: requestId },
            status: 'PENDING',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        // Also cancel any pending match proposals for this load
        await tx.matchProposal.updateMany({
          where: {
            loadId: truckRequest.loadId,
            status: 'PENDING',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        return { request: updatedRequest, load: updatedLoad };
      });

      // Create Trip record
      let trip = null;
      try {
        trip = await createTripForLoad(truckRequest.loadId, truckRequest.truckId, session.userId);
      } catch (error) {
        console.error('Failed to create trip:', error);
      }

      // Enable GPS tracking if available
      let trackingUrl: string | null = trip?.trackingUrl || null;
      if (truckRequest.truck.imei && truckRequest.truck.gpsVerifiedAt && !trackingUrl) {
        try {
          trackingUrl = await enableTrackingForLoad(truckRequest.loadId, truckRequest.truckId);
        } catch (error) {
          console.error('Failed to enable GPS tracking:', error);
        }
      }

      // Send notification to shipper about approval
      if (truckRequest.shipper?.id) {
        notifyTruckRequestResponse({
          shipperId: truckRequest.shipper.id,
          carrierName: truckRequest.truck.carrier?.name || 'Carrier',
          truckPlate: truckRequest.truck.licensePlate,
          approved: true,
          requestId: requestId,
          loadId: truckRequest.loadId, // Include loadId for navigation
        }).catch((err) => console.error('Failed to send notification:', err));
      }

      return NextResponse.json({
        request: result.request,
        load: result.load,
        trackingUrl,
        message: 'Request approved. Load has been assigned to your truck.',
        rule: RULE_CARRIER_FINAL_AUTHORITY.id,
      });
    } else {
      // REJECT
      const updatedRequest = await db.truckRequest.update({
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
          loadId: truckRequest.loadId,
          eventType: 'REQUEST_REJECTED',
          description: `Truck request rejected by carrier. Truck: ${truckRequest.truck.licensePlate}`,
          userId: session.userId,
          metadata: {
            requestId: requestId,
            rejectionReason: data.responseNotes,
          },
        },
      });

      // Send notification to shipper about rejection
      if (truckRequest.shipper?.id) {
        notifyTruckRequestResponse({
          shipperId: truckRequest.shipper.id,
          carrierName: truckRequest.truck.carrier?.name || 'Carrier',
          truckPlate: truckRequest.truck.licensePlate,
          approved: false,
          requestId: requestId,
          loadId: truckRequest.loadId, // Include loadId for context
        }).catch((err) => console.error('Failed to send notification:', err));
      }

      return NextResponse.json({
        request: updatedRequest,
        message: 'Request rejected.',
      });
    }
  } catch (error: any) {
    console.error('Error responding to truck request:', error);

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
      { error: 'Failed to respond to truck request' },
      { status: 500 }
    );
  }
}

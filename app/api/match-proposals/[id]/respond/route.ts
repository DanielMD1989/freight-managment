/**
 * Match Proposal Response API
 *
 * Phase 2 - Foundation Rule: CARRIER_FINAL_AUTHORITY
 *
 * Allows carriers to accept or reject match proposals.
 * Only the carrier who owns the truck can respond.
 *
 * POST: Accept or reject a proposal (CARRIER only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { canApproveRequests } from '@/lib/dispatcherPermissions';
import { RULE_CARRIER_FINAL_AUTHORITY } from '@/lib/foundation-rules';
import { UserRole } from '@prisma/client';
import { enableTrackingForLoad } from '@/lib/gpsTracking';
import { reserveServiceFee } from '@/lib/serviceFeeManagement'; // Service Fee Implementation

// Validation schema for proposal response
const ProposalResponseSchema = z.object({
  action: z.enum(['ACCEPT', 'REJECT']),
  responseNotes: z.string().max(500).optional(),
});

/**
 * POST /api/match-proposals/[id]/respond
 *
 * Respond to a match proposal (accept or reject).
 *
 * Phase 2 Foundation Rule: CARRIER_FINAL_AUTHORITY
 * - Only the carrier who owns the truck can respond
 * - If accepted, load is assigned to truck
 * - If rejected, proposal is marked as rejected
 *
 * Request body: ProposalResponseSchema
 *
 * Returns: Updated proposal and load (if accepted)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: proposalId } = await params;
    const session = await requireAuth();

    // Get the proposal
    const proposal = await db.matchProposal.findUnique({
      where: { id: proposalId },
      include: {
        truck: {
          select: {
            id: true,
            carrierId: true,
            licensePlate: true,
            imei: true,
            gpsVerifiedAt: true,
          },
        },
        load: {
          select: {
            id: true,
            status: true,
            assignedTruckId: true,
          },
        },
      },
    });

    if (!proposal) {
      return NextResponse.json(
        { error: 'Proposal not found' },
        { status: 404 }
      );
    }

    // Check if proposal is still pending
    if (proposal.status !== 'PENDING') {
      return NextResponse.json(
        {
          error: `Proposal has already been ${proposal.status.toLowerCase()}`,
          currentStatus: proposal.status,
        },
        { status: 400 }
      );
    }

    // Check if proposal has expired
    if (new Date() > proposal.expiresAt) {
      // Mark as expired
      await db.matchProposal.update({
        where: { id: proposalId },
        data: { status: 'EXPIRED' },
      });

      return NextResponse.json(
        { error: 'Proposal has expired' },
        { status: 400 }
      );
    }

    // Check if user can approve (must be carrier who owns the truck)
    const user = {
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId,
    };

    if (!canApproveRequests(user, proposal.truck.carrierId)) {
      return NextResponse.json(
        {
          error: 'You do not have permission to respond to this proposal',
          rule: RULE_CARRIER_FINAL_AUTHORITY.id,
          hint: 'Only the carrier who owns the truck can respond',
        },
        { status: 403 }
      );
    }

    // Validate request body
    const body = await request.json();
    const validationResult = ProposalResponseSchema.safeParse(body);

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

    if (data.action === 'ACCEPT') {
      // Check if load is still available
      if (proposal.load.assignedTruckId) {
        return NextResponse.json(
          { error: 'Load has already been assigned to another truck' },
          { status: 400 }
        );
      }

      const proposableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
      if (!proposableStatuses.includes(proposal.load.status)) {
        return NextResponse.json(
          { error: `Load is no longer available (status: ${proposal.load.status})` },
          { status: 400 }
        );
      }

      // Check if truck is already assigned to another active load
      const existingAssignment = await db.load.findFirst({
        where: {
          assignedTruckId: proposal.truckId,
          status: {
            in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'],
          },
        },
        select: {
          id: true,
          referenceNumber: true,
          status: true,
        },
      });

      if (existingAssignment) {
        return NextResponse.json(
          {
            error: `This truck is already assigned to an active load (${existingAssignment.referenceNumber || existingAssignment.id.slice(-8)})`,
            existingLoadId: existingAssignment.id,
            existingLoadStatus: existingAssignment.status,
          },
          { status: 400 }
        );
      }

      // Transaction: Update proposal and assign load
      const result = await db.$transaction(async (tx) => {
        // Update proposal to accepted
        const updatedProposal = await tx.matchProposal.update({
          where: { id: proposalId },
          data: {
            status: 'ACCEPTED',
            respondedAt: new Date(),
            responseNotes: data.responseNotes,
            respondedById: session.userId,
          },
        });

        // Assign load to truck
        const updatedLoad = await tx.load.update({
          where: { id: proposal.loadId },
          data: {
            assignedTruckId: proposal.truckId,
            assignedAt: new Date(),
            status: 'ASSIGNED',
          },
        });

        // Create load event
        await tx.loadEvent.create({
          data: {
            loadId: proposal.loadId,
            eventType: 'ASSIGNED',
            description: `Load assigned via match proposal (accepted by carrier). Truck: ${proposal.truck.licensePlate}`,
            userId: session.userId,
            metadata: {
              proposalId: proposalId,
              acceptedViaProposal: true,
            },
          },
        });

        // Cancel other pending proposals for this load
        await tx.matchProposal.updateMany({
          where: {
            loadId: proposal.loadId,
            id: { not: proposalId },
            status: 'PENDING',
          },
          data: {
            status: 'CANCELLED',
          },
        });

        return { proposal: updatedProposal, load: updatedLoad };
      });

      // Service Fee Implementation: Reserve service fee from shipper wallet
      let serviceFeeResult = null;
      try {
        serviceFeeResult = await reserveServiceFee(proposal.loadId);

        if (serviceFeeResult.success && serviceFeeResult.transactionId) {
          await db.loadEvent.create({
            data: {
              loadId: proposal.loadId,
              eventType: 'SERVICE_FEE_RESERVED',
              description: `Service fee reserved: ${serviceFeeResult.serviceFee.toFixed(2)} ETB`,
              userId: session.userId,
              metadata: {
                serviceFee: serviceFeeResult.serviceFee.toFixed(2),
                transactionId: serviceFeeResult.transactionId,
              },
            },
          });
        } else if (!serviceFeeResult.success && serviceFeeResult.error) {
          console.warn(`Service fee reserve failed for load ${proposal.loadId}:`, serviceFeeResult.error);
        }
      } catch (error) {
        console.error('Service fee reserve error:', error);
        // Continue - assignment succeeded
      }

      // Enable GPS tracking if available
      let trackingUrl: string | null = null;
      if (proposal.truck.imei && proposal.truck.gpsVerifiedAt) {
        try {
          trackingUrl = await enableTrackingForLoad(proposal.loadId, proposal.truckId);
        } catch (error) {
          console.error('Failed to enable GPS tracking:', error);
        }
      }

      return NextResponse.json({
        proposal: result.proposal,
        load: result.load,
        trackingUrl,
        serviceFee: serviceFeeResult
          ? {
              success: serviceFeeResult.success,
              amount: serviceFeeResult.serviceFee.toFixed(2),
              error: serviceFeeResult.error,
            }
          : null,
        message: 'Proposal accepted. Load has been assigned to your truck.',
        rule: RULE_CARRIER_FINAL_AUTHORITY.id,
      });
    } else {
      // REJECT
      const updatedProposal = await db.matchProposal.update({
        where: { id: proposalId },
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
          loadId: proposal.loadId,
          eventType: 'PROPOSAL_REJECTED',
          description: `Match proposal rejected by carrier. Truck: ${proposal.truck.licensePlate}`,
          userId: session.userId,
          metadata: {
            proposalId: proposalId,
            rejectionReason: data.responseNotes,
          },
        },
      });

      return NextResponse.json({
        proposal: updatedProposal,
        message: 'Proposal rejected.',
      });
    }
  } catch (error: any) {
    console.error('Error responding to match proposal:', error);

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
      { error: 'Failed to respond to match proposal' },
      { status: 500 }
    );
  }
}

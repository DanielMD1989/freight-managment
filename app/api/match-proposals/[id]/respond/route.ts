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
import { validateWalletBalancesForTrip } from '@/lib/serviceFeeManagement'; // Service Fee Implementation
// P0-007 FIX: Import CacheInvalidation for post-acceptance cache clearing
import { CacheInvalidation } from '@/lib/cache';
import crypto from 'crypto';

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
            shipperId: true, // P0-007 FIX: Needed for cache invalidation
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
      // SERVICE FEE: Validate wallet balances before acceptance
      // This is validation only - fees are deducted on trip completion
      const walletValidation = await validateWalletBalancesForTrip(
        proposal.loadId,
        proposal.truck.carrierId
      );
      if (!walletValidation.valid) {
        return NextResponse.json(
          {
            error: 'Insufficient wallet balance for trip service fees',
            details: walletValidation.errors,
            fees: {
              shipperFee: walletValidation.shipperFee,
              carrierFee: walletValidation.carrierFee,
              shipperBalance: walletValidation.shipperBalance,
              carrierBalance: walletValidation.carrierBalance,
            },
          },
          { status: 400 }
        );
      }

      // P0-007 FIX: All checks and operations now inside atomic transaction
      // with fresh re-fetch to prevent race conditions
      let result: { proposal: any; load: any; trip: any };

      try {
        result = await db.$transaction(async (tx) => {
          // P0-007 FIX: Fresh re-fetch load inside transaction to prevent race condition
          const freshLoad = await tx.load.findUnique({
            where: { id: proposal.loadId },
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

          // Check load is still available (race condition protection)
          if (freshLoad.assignedTruckId) {
            throw new Error('LOAD_ALREADY_ASSIGNED');
          }

          const proposableStatuses = ['POSTED', 'SEARCHING', 'OFFERED'];
          if (!proposableStatuses.includes(freshLoad.status)) {
            throw new Error(`LOAD_NOT_AVAILABLE:${freshLoad.status}`);
          }

          // Check if truck is already assigned to another active load
          const existingAssignment = await tx.load.findFirst({
            where: {
              assignedTruckId: proposal.truckId,
              status: { notIn: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] },
            },
            select: { id: true, pickupCity: true, deliveryCity: true, status: true },
          });

          if (existingAssignment) {
            throw new Error(`TRUCK_BUSY:${existingAssignment.pickupCity}:${existingAssignment.deliveryCity}`);
          }

          // Unassign truck from any completed loads (cleanup)
          await tx.load.updateMany({
            where: {
              assignedTruckId: proposal.truckId,
              status: { in: ['DELIVERED', 'COMPLETED', 'CANCELLED', 'EXPIRED'] },
            },
            data: { assignedTruckId: null },
          });

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

          // Create Trip record inside transaction (atomic with assignment)
          const trackingUrl = `trip-${proposal.loadId.slice(-6)}-${crypto.randomBytes(12).toString('hex')}`;

          const trip = await tx.trip.create({
            data: {
              loadId: proposal.loadId,
              truckId: proposal.truckId,
              carrierId: proposal.truck.carrierId,
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

          // Create load event inside transaction
          await tx.loadEvent.create({
            data: {
              loadId: proposal.loadId,
              eventType: 'ASSIGNED',
              description: `Load assigned via match proposal (accepted by carrier). Truck: ${proposal.truck.licensePlate}`,
              userId: session.userId,
              metadata: {
                proposalId: proposalId,
                acceptedViaProposal: true,
                tripId: trip.id,
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
            data: { status: 'CANCELLED' },
          });

          // Cancel pending load/truck requests
          await tx.loadRequest.updateMany({
            where: { loadId: proposal.loadId, status: 'PENDING' },
            data: { status: 'CANCELLED' },
          });

          await tx.truckRequest.updateMany({
            where: { loadId: proposal.loadId, status: 'PENDING' },
            data: { status: 'CANCELLED' },
          });

          return { proposal: updatedProposal, load: updatedLoad, trip };
        });
      } catch (error: any) {
        // Handle specific transaction errors
        if (error.message === 'LOAD_NOT_FOUND') {
          return NextResponse.json({ error: 'Load not found' }, { status: 404 });
        }
        if (error.message === 'LOAD_ALREADY_ASSIGNED') {
          return NextResponse.json(
            { error: 'Load has already been assigned to another truck. Please refresh and try again.' },
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
            { status: 409 }
          );
        }
        throw error;
      }

      // P0-007 FIX: Cache invalidation after transaction commits
      await CacheInvalidation.load(proposal.loadId, proposal.load.shipperId);
      await CacheInvalidation.truck(proposal.truckId, proposal.truck.carrierId);

      // SERVICE FEE NOTE: Wallet balances were validated before acceptance.
      // Actual fee deduction happens on trip completion (deductServiceFee).
      // No reservation/hold is needed - validation ensures balance is sufficient.

      // Non-critical: Enable GPS tracking (outside transaction, fire-and-forget)
      let trackingUrl: string | null = result.trip?.trackingUrl || null;
      if (proposal.truck.imei && proposal.truck.gpsVerifiedAt) {
        try {
          const gpsUrl = await enableTrackingForLoad(proposal.loadId, proposal.truckId);
          if (gpsUrl) trackingUrl = gpsUrl;
        } catch (error) {
          console.error('Failed to enable GPS tracking:', error);
        }
      }

      return NextResponse.json({
        proposal: result.proposal,
        load: result.load,
        trip: result.trip,
        trackingUrl,
        // Wallet validation passed - fees will be deducted on trip completion
        walletValidation: {
          validated: true,
          shipperFee: walletValidation.shipperFee.toFixed(2),
          carrierFee: walletValidation.carrierFee.toFixed(2),
          note: 'Fees will be deducted on trip completion',
        },
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

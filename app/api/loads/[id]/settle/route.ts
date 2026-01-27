/**
 * Load Settlement API
 *
 * Sprint 16 - Story 16.7: Commission & Revenue Tracking
 *
 * Processes settlement and commission deduction after POD verification
 *
 * SECURITY: Uses atomic update pattern to prevent double-settlement race conditions
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { requireCSRF } from '@/lib/csrf';
import { processSettlement } from '@/lib/commissionCalculation';
import { releaseFundsFromEscrow } from '@/lib/escrowManagement'; // Sprint 8

/**
 * POST /api/loads/[id]/settle
 *
 * Trigger settlement for a load
 *
 * Requirements:
 * - Load status must be DELIVERED
 * - POD must be verified
 * - Settlement not already processed
 *
 * Security:
 * - CSRF protection
 * - Atomic update pattern to prevent double-settlement
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loadId } = await params;
    const session = await requireAuth();

    // CSRF protection for state-changing operation
    const csrfError = await requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Only admins can trigger settlement
    // In production, this might be automated after POD verification
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Get load details
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        podSubmitted: true,
        podVerified: true,
        settlementStatus: true,
        totalFareEtb: true,
        rate: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Validate settlement requirements
    const errors: string[] = [];

    if (load.status !== 'DELIVERED') {
      errors.push('Load must be DELIVERED');
    }

    if (!load.podSubmitted) {
      errors.push('POD must be submitted');
    }

    if (!load.podVerified) {
      errors.push('POD must be verified');
    }

    if (load.settlementStatus === 'PAID') {
      errors.push('Settlement already processed');
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Settlement requirements not met', details: errors },
        { status: 400 }
      );
    }

    // HIGH FIX #9: Use transaction with fresh re-fetch for atomic lock acquisition
    // This prevents race conditions where two requests could both succeed in updateMany
    let lockAcquired = false;
    try {
      await db.$transaction(async (tx) => {
        // Fresh re-fetch inside transaction to get current state
        const freshLoad = await tx.load.findUnique({
          where: { id: loadId },
          select: { settlementStatus: true, status: true, podVerified: true },
        });

        if (!freshLoad) {
          throw new Error('LOAD_NOT_FOUND');
        }

        // Check if already processing or completed
        if (freshLoad.settlementStatus === 'IN_PROGRESS') {
          throw new Error('SETTLEMENT_IN_PROGRESS');
        }
        if (freshLoad.settlementStatus === 'PAID') {
          throw new Error('SETTLEMENT_COMPLETED');
        }
        if (freshLoad.status !== 'DELIVERED' || !freshLoad.podVerified) {
          throw new Error('SETTLEMENT_REQUIREMENTS_NOT_MET');
        }

        // Atomically acquire lock
        await tx.load.update({
          where: { id: loadId },
          data: { settlementStatus: 'IN_PROGRESS' },
        });

        lockAcquired = true;
      });
    } catch (error: any) {
      if (error.message === 'LOAD_NOT_FOUND') {
        return NextResponse.json({ error: 'Load not found' }, { status: 404 });
      }
      if (error.message === 'SETTLEMENT_IN_PROGRESS') {
        return NextResponse.json(
          { error: 'Settlement already in progress', code: 'IDEMPOTENCY_CONFLICT' },
          { status: 409 }
        );
      }
      if (error.message === 'SETTLEMENT_COMPLETED') {
        return NextResponse.json(
          { error: 'Settlement already completed', code: 'IDEMPOTENCY_CONFLICT' },
          { status: 409 }
        );
      }
      if (error.message === 'SETTLEMENT_REQUIREMENTS_NOT_MET') {
        return NextResponse.json(
          { error: 'Settlement requirements not met', code: 'REQUIREMENTS_NOT_MET' },
          { status: 400 }
        );
      }
      throw error;
    }

    if (!lockAcquired) {
      return NextResponse.json(
        { error: 'Failed to acquire settlement lock', code: 'LOCK_FAILED' },
        { status: 409 }
      );
    }

    // Sprint 8: Check if load was funded via escrow
    const loadEscrowStatus = await db.load.findUnique({
      where: { id: loadId },
      select: { escrowFunded: true },
    });

    // Process settlement
    try {
      if (loadEscrowStatus?.escrowFunded) {
        // Sprint 8: Use escrow release for escrow-funded loads
        const escrowResult = await releaseFundsFromEscrow(loadId);

        if (!escrowResult.success) {
          return NextResponse.json(
            {
              error: 'Escrow release failed',
              details: escrowResult.error,
            },
            { status: 400 }
          );
        }

        // Create load event
        await db.loadEvent.create({
          data: {
            loadId,
            eventType: 'ESCROW_RELEASED',
            description: `Escrow funds released: Carrier received ${escrowResult.carrierPayout.toFixed(2)} ETB, Platform earned ${escrowResult.platformRevenue.toFixed(2)} ETB`,
            userId: session.userId,
            metadata: {
              carrierPayout: escrowResult.carrierPayout.toFixed(2),
              platformRevenue: escrowResult.platformRevenue.toFixed(2),
              shipperCommission: escrowResult.shipperCommission.toFixed(2),
              carrierCommission: escrowResult.carrierCommission.toFixed(2),
              transactionId: escrowResult.transactionId,
            },
          },
        });

        // Get updated load
        const updatedLoad = await db.load.findUnique({
          where: { id: loadId },
          select: {
            id: true,
            settlementStatus: true,
            settledAt: true,
            shipperCommission: true,
            carrierCommission: true,
            platformCommission: true,
          },
        });

        return NextResponse.json({
          message: 'Settlement processed successfully via escrow release',
          settlement: {
            loadId: updatedLoad?.id,
            status: updatedLoad?.settlementStatus,
            settledAt: updatedLoad?.settledAt,
            shipperCommission: escrowResult.shipperCommission.toNumber(),
            carrierCommission: escrowResult.carrierCommission.toNumber(),
            platformRevenue: escrowResult.platformRevenue.toNumber(),
            carrierPayout: escrowResult.carrierPayout.toNumber(),
            method: 'ESCROW_RELEASE',
          },
        });
      } else {
        // Legacy: Use old commission deduction for non-escrow loads
        await processSettlement(loadId);

        // Get updated load with commission details
        const updatedLoad = await db.load.findUnique({
          where: { id: loadId },
          select: {
            id: true,
            settlementStatus: true,
            settledAt: true,
            shipperCommission: true,
            carrierCommission: true,
            platformCommission: true,
          },
        });

        return NextResponse.json({
          message: 'Settlement processed successfully via commission deduction (legacy)',
          settlement: {
            loadId: updatedLoad?.id,
            status: updatedLoad?.settlementStatus,
            settledAt: updatedLoad?.settledAt,
            shipperCommission: updatedLoad?.shipperCommission
              ? Number(updatedLoad.shipperCommission)
              : null,
            carrierCommission: updatedLoad?.carrierCommission
              ? Number(updatedLoad.carrierCommission)
              : null,
            platformRevenue: updatedLoad?.platformCommission
              ? Number(updatedLoad.platformCommission)
              : null,
            method: 'COMMISSION_DEDUCTION',
          },
        });
      }
    } catch (settlementError: any) {
      console.error('Settlement processing error:', settlementError);

      // IDEMPOTENCY: Reset status on failure so it can be retried
      await db.load.update({
        where: { id: loadId },
        data: { settlementStatus: 'PENDING' },
      });

      return NextResponse.json(
        {
          error: 'Settlement failed',
          details: settlementError.message || 'Unknown error',
          retryable: true, // Client can retry since we reset status
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Settlement API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/loads/[id]/settle
 *
 * Get settlement status and details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loadId } = await params;
    const session = await requireAuth();

    // Get load with settlement details
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        podSubmitted: true,
        podSubmittedAt: true,
        podVerified: true,
        podVerifiedAt: true,
        podUrl: true,
        settlementStatus: true,
        settledAt: true,
        shipperCommission: true,
        carrierCommission: true,
        platformCommission: true,
        totalFareEtb: true,
        rate: true,
        shipperId: true,
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Check if user has permission to view settlement details
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isShipper = user?.organizationId === load.shipperId;
    const isCarrier = user?.organizationId === load.assignedTruck?.carrierId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isShipper && !isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized to view settlement details' },
        { status: 403 }
      );
    }

    // Calculate settlement readiness
    const canSettle =
      load.status === 'DELIVERED' &&
      load.podSubmitted &&
      load.podVerified &&
      load.settlementStatus !== 'PAID';

    return NextResponse.json({
      loadId: load.id,
      status: load.status,
      pod: {
        submitted: load.podSubmitted,
        submittedAt: load.podSubmittedAt,
        verified: load.podVerified,
        verifiedAt: load.podVerifiedAt,
        url: load.podUrl,
      },
      settlement: {
        status: load.settlementStatus,
        settledAt: load.settledAt,
        canSettle,
        shipperCommission: load.shipperCommission
          ? Number(load.shipperCommission)
          : null,
        carrierCommission: load.carrierCommission
          ? Number(load.carrierCommission)
          : null,
        platformRevenue: load.platformCommission
          ? Number(load.platformCommission)
          : null,
        totalFare: load.totalFareEtb
          ? Number(load.totalFareEtb)
          : Number(load.rate),
      },
    });
  } catch (error) {
    console.error('Get settlement status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

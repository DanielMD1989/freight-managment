/**
 * Load Settlement API
 *
 * Sprint 16 - Story 16.7: Commission & Revenue Tracking
 *
 * Processes settlement and commission deduction after POD verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { processSettlement } from '@/lib/commissionCalculation';

/**
 * POST /api/loads/[id]/settle
 *
 * Trigger settlement for a load
 *
 * Requirements:
 * - Load status must be DELIVERED
 * - POD must be verified
 * - Settlement not already processed
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loadId } = await params;
    const session = await requireAuth();

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

    // Process settlement
    try {
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
        message: 'Settlement processed successfully',
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
        },
      });
    } catch (settlementError: any) {
      console.error('Settlement processing error:', settlementError);

      return NextResponse.json(
        {
          error: 'Settlement failed',
          details: settlementError.message || 'Unknown error',
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

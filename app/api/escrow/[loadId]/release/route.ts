/**
 * Manual Escrow Release API
 *
 * Sprint 8: Manual fund release operation for admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { releaseFundsFromEscrow } from '@/lib/escrowManagement';
import { db } from '@/lib/db';

/**
 * POST /api/escrow/[loadId]/release
 *
 * Manually trigger escrow release for a load
 * (Admin only - for manual settlement or special cases)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const { loadId } = await params;
    const session = await requireAuth();

    // Only admins can manually trigger escrow operations
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Get load details
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        escrowFunded: true,
        podVerified: true,
        settlementStatus: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Validate load state
    if (!load.escrowFunded) {
      return NextResponse.json(
        { error: 'Load not funded in escrow' },
        { status: 400 }
      );
    }

    if (load.settlementStatus === 'PAID') {
      return NextResponse.json(
        { error: 'Load already settled' },
        { status: 400 }
      );
    }

    // POD verification check (can be bypassed by admin)
    if (!load.podVerified) {
      console.warn(
        `Admin ${session.userId} releasing escrow for load ${loadId} without POD verification`
      );
    }

    // Trigger escrow release
    const result = await releaseFundsFromEscrow(loadId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Escrow release failed',
          details: result.error,
        },
        { status: 400 }
      );
    }

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: 'ESCROW_RELEASED',
        description: `Manual escrow release: Carrier received ${result.carrierPayout.toFixed(2)} ETB (Admin: ${session.userId})`,
        userId: session.userId,
        metadata: {
          manual: true,
          carrierPayout: result.carrierPayout.toFixed(2),
          transactionId: result.transactionId,
          podVerified: load.podVerified,
        },
      },
    });

    return NextResponse.json({
      message: 'Escrow release successful',
      release: {
        carrierPayout: result.carrierPayout.toFixed(2),
        transactionId: result.transactionId,
      },
      warning: !load.podVerified
        ? 'POD was not verified - release was forced by admin'
        : null,
    });
  } catch (error) {
    console.error('Manual escrow release error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

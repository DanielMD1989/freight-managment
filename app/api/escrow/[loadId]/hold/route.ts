/**
 * Manual Escrow Hold API
 *
 * Sprint 8: Manual fund hold operation for admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { holdFundsInEscrow } from '@/lib/escrowManagement';
import { db } from '@/lib/db';

/**
 * POST /api/escrow/[loadId]/hold
 *
 * Manually trigger escrow hold for a load
 * (Admin only - for failed automatic holds or manual intervention)
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
        assignedTruckId: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Validate load state
    if (load.escrowFunded) {
      return NextResponse.json(
        { error: 'Load already funded in escrow' },
        { status: 400 }
      );
    }

    if (!load.assignedTruckId) {
      return NextResponse.json(
        { error: 'Load must be assigned before escrow hold' },
        { status: 400 }
      );
    }

    // Trigger escrow hold
    const result = await holdFundsInEscrow(loadId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Escrow hold failed',
          details: result.error,
          escrowAmount: result.escrowAmount?.toFixed(2),
          shipperBalance: result.shipperBalance?.toFixed(2),
        },
        { status: 400 }
      );
    }

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: 'ESCROW_FUNDED',
        description: `Manual escrow hold: ${result.escrowAmount.toFixed(2)} ETB (Admin: ${session.userId})`,
        userId: session.userId,
        metadata: {
          manual: true,
          escrowAmount: result.escrowAmount.toFixed(2),
          transactionId: result.transactionId,
        },
      },
    });

    return NextResponse.json({
      message: 'Escrow hold successful',
      escrow: {
        amount: result.escrowAmount.toFixed(2),
        shipperBalance: result.shipperBalance.toFixed(2),
        transactionId: result.transactionId,
      },
    });
  } catch (error) {
    console.error('Manual escrow hold error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

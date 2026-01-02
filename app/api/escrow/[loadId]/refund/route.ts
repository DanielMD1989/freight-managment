/**
 * Manual Escrow Refund API
 *
 * Sprint 8: Manual fund refund operation for admins
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { refundEscrowFunds } from '@/lib/escrowManagement';
import { db } from '@/lib/db';

/**
 * POST /api/escrow/[loadId]/refund
 *
 * Manually trigger escrow refund for a load
 * (Admin only - for disputed loads, cancellations, or manual intervention)
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
        { error: 'Cannot refund - load already settled' },
        { status: 400 }
      );
    }

    if (load.settlementStatus === 'REFUNDED') {
      return NextResponse.json(
        { error: 'Escrow already refunded' },
        { status: 400 }
      );
    }

    // Trigger escrow refund
    const result = await refundEscrowFunds(loadId);

    if (!result.success) {
      return NextResponse.json(
        {
          error: 'Escrow refund failed',
          details: result.error,
        },
        { status: 400 }
      );
    }

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: 'ESCROW_REFUNDED',
        description: `Manual escrow refund: ${result.escrowAmount.toFixed(2)} ETB returned to shipper (Admin: ${session.userId})`,
        userId: session.userId,
        metadata: {
          manual: true,
          escrowAmount: result.escrowAmount.toFixed(2),
          transactionId: result.transactionId,
        },
      },
    });

    return NextResponse.json({
      message: 'Escrow refund successful',
      refund: {
        amount: result.escrowAmount.toFixed(2),
        shipperBalance: result.shipperBalance.toFixed(2),
        transactionId: result.transactionId,
      },
    });
  } catch (error) {
    console.error('Manual escrow refund error:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

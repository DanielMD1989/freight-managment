/**
 * Escrow Management API
 *
 * Sprint 8: Manual Escrow Operations
 *
 * Allows admins to view and manage escrow status for loads
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { Decimal } from 'decimal.js';

/**
 * GET /api/escrow/[loadId]
 *
 * Get escrow status and details for a load
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ loadId: string }> }
) {
  try {
    const { loadId } = await params;
    const session = await requireAuth();

    // Get load with escrow details
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        escrowFunded: true,
        escrowAmount: true,
        shipperCommission: true,
        carrierCommission: true,
        platformCommission: true,
        totalFareEtb: true,
        rate: true,
        podVerified: true,
        settlementStatus: true,
        settledAt: true,
        shipperId: true,
        shipper: {
          select: {
            name: true,
          },
        },
        assignedTruck: {
          select: {
            carrierId: true,
            carrier: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isShipper = user?.organizationId === load.shipperId;
    const isCarrier = user?.organizationId === load.assignedTruck?.carrierId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isShipper && !isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized to view escrow details' },
        { status: 403 }
      );
    }

    // Get escrow account balance
    const escrowAccount = await db.financialAccount.findFirst({
      where: {
        accountType: 'ESCROW',
        isActive: true,
      },
      select: {
        balance: true,
      },
    });

    // Get related journal entries
    const journalEntries = await db.journalEntry.findMany({
      where: {
        loadId,
        transactionType: {
          in: ['ESCROW_FUND', 'ESCROW_RELEASE', 'REFUND'],
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        transactionType: true,
        description: true,
        reference: true,
        createdAt: true,
        lines: {
          select: {
            amount: true,
            isDebit: true,
            account: {
              select: {
                accountType: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json({
      loadId: load.id,
      status: load.status,
      escrow: {
        funded: load.escrowFunded,
        amount: load.escrowAmount ? Number(load.escrowAmount) : null,
        shipperCommission: load.shipperCommission
          ? Number(load.shipperCommission)
          : null,
        carrierCommission: load.carrierCommission
          ? Number(load.carrierCommission)
          : null,
        platformRevenue: load.platformCommission
          ? Number(load.platformCommission)
          : null,
      },
      settlement: {
        status: load.settlementStatus,
        podVerified: load.podVerified,
        settledAt: load.settledAt,
      },
      parties: {
        shipper: {
          id: load.shipperId,
          name: load.shipper.name,
        },
        carrier: load.assignedTruck
          ? {
              id: load.assignedTruck.carrierId,
              name: load.assignedTruck.carrier.name,
            }
          : null,
      },
      transactions: journalEntries.map((entry) => ({
        id: entry.id,
        type: entry.transactionType,
        description: entry.description,
        createdAt: entry.createdAt,
        amount: entry.lines.reduce(
          (sum, line) => sum.add(new Decimal(line.amount)),
          new Decimal(0)
        ).toNumber(),
      })),
      systemEscrowBalance: escrowAccount?.balance
        ? Number(escrowAccount.balance)
        : null,
    });
  } catch (error) {
    console.error('Get escrow status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

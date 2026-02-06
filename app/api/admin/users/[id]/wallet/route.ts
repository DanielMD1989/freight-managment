/**
 * Admin User Wallet API
 *
 * Get wallet information for a specific user
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/admin/users/[id]/wallet
 *
 * Get wallet data for a user's organization
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();

    // Only admins can access this endpoint
    if (!['ADMIN', 'SUPER_ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { error: 'Forbidden' },
        { status: 403 }
      );
    }

    const { id } = await params;

    // Get the user and their organization
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        organizationId: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (!user.organizationId) {
      return NextResponse.json(
        { error: 'User has no organization' },
        { status: 400 }
      );
    }

    // Get wallet for the organization
    const wallet = await db.financialAccount.findFirst({
      where: {
        organizationId: user.organizationId,
        accountType: {
          in: ['SHIPPER_WALLET', 'CARRIER_WALLET'],
        },
        isActive: true,
      },
      select: {
        id: true,
        accountType: true,
        balance: true,
        currency: true,
        updatedAt: true,
      },
    });

    if (!wallet) {
      return NextResponse.json(
        { error: 'No wallet found for this user' },
        { status: 404 }
      );
    }

    // Get recent transactions for this wallet
    const transactions = await db.journalEntry.findMany({
      where: {
        lines: {
          some: {
            OR: [
              { accountId: wallet.id },
              { creditAccountId: wallet.id },
            ],
          },
        },
      },
      select: {
        id: true,
        transactionType: true,
        description: true,
        reference: true,
        createdAt: true,
        lines: {
          where: {
            OR: [
              { accountId: wallet.id },
              { creditAccountId: wallet.id },
            ],
          },
          select: {
            amount: true,
            isDebit: true,
            accountId: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });

    // Format transactions
    const formattedTransactions = transactions.map((tx) => {
      const line = tx.lines[0];
      const isCredit = line?.accountId === wallet.id && line?.isDebit === true;
      const amount = Number(line?.amount || 0);

      return {
        id: tx.id,
        type: tx.transactionType,
        description: tx.description,
        reference: tx.reference,
        amount: isCredit ? amount : -amount,
        createdAt: tx.createdAt,
      };
    });

    return NextResponse.json({
      wallet: {
        id: wallet.id,
        balance: Number(wallet.balance),
        currency: wallet.currency,
        accountType: wallet.accountType,
        updatedAt: wallet.updatedAt,
      },
      transactions: formattedTransactions,
    });
  } catch (error) {
    console.error('Get user wallet error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

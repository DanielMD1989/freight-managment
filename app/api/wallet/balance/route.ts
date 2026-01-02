/**
 * Wallet Balance API
 *
 * Sprint 16 - Story 16.7: Commission & Revenue Tracking
 *
 * Get current wallet balance for organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/wallet/balance
 *
 * Get wallet balance for current user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Get user's organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        organizationId: true,
        role: true,
      },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'User must belong to an organization' },
        { status: 400 }
      );
    }

    // Get wallet accounts for organization
    const walletAccounts = await db.financialAccount.findMany({
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

    if (walletAccounts.length === 0) {
      return NextResponse.json(
        { error: 'No wallet found for organization' },
        { status: 404 }
      );
    }

    // Calculate total balance across all wallets
    const totalBalance = walletAccounts.reduce(
      (sum, account) => sum + Number(account.balance),
      0
    );

    // Get recent statistics
    const recentCommissions = await db.journalEntry.count({
      where: {
        transactionType: 'COMMISSION',
        createdAt: {
          gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        },
        lines: {
          some: {
            creditAccount: {
              organizationId: user.organizationId,
            },
          },
        },
      },
    });

    return NextResponse.json({
      wallets: walletAccounts.map((account) => ({
        id: account.id,
        type: account.accountType,
        balance: Number(account.balance),
        currency: account.currency,
        updatedAt: account.updatedAt,
      })),
      totalBalance,
      currency: walletAccounts[0]?.currency || 'ETB',
      recentCommissionsCount: recentCommissions,
    });
  } catch (error) {
    console.error('Get wallet balance error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

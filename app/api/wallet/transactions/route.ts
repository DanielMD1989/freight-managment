/**
 * Wallet Transactions API
 *
 * Get transaction history for organization's wallet
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/wallet/transactions
 *
 * Get transaction history for current user's organization
 *
 * Query params:
 * - limit: number (default 50, max 100)
 * - offset: number (default 0)
 * - type: COMMISSION | PAYMENT | REFUND | ADJUSTMENT (optional filter)
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

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50'),
      100
    );
    const offset = parseInt(searchParams.get('offset') || '0');
    const type = searchParams.get('type') as
      | 'COMMISSION'
      | 'PAYMENT'
      | 'REFUND'
      | 'ADJUSTMENT'
      | null;

    // Get wallet accounts
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
      },
    });

    if (walletAccounts.length === 0) {
      return NextResponse.json(
        { error: 'No wallet found for organization' },
        { status: 404 }
      );
    }

    const walletAccountIds = walletAccounts.map((account) => account.id);

    // Build where clause for journal entries
    const where: any = {
      lines: {
        some: {
          OR: [
            { debitAccountId: { in: walletAccountIds } },
            { creditAccountId: { in: walletAccountIds } },
          ],
        },
      },
    };

    if (type) {
      where.transactionType = type;
    }

    // Get transactions
    const [transactions, totalCount] = await Promise.all([
      db.journalEntry.findMany({
        where,
        select: {
          id: true,
          transactionType: true,
          description: true,
          reference: true,
          loadId: true,
          createdAt: true,
          lines: {
            where: {
              OR: [
                { accountId: { in: walletAccountIds } },
                { creditAccountId: { in: walletAccountIds } },
              ],
            },
            select: {
              amount: true,
              isDebit: true,
              accountId: true,
              creditAccountId: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: limit,
        skip: offset,
      }),
      db.journalEntry.count({ where }),
    ]);

    // Format transactions for display
    const formattedTransactions = transactions.map((tx) => {
      const line = tx.lines[0]; // Get the line affecting this organization's wallet
      const isDebit = walletAccountIds.includes(line.accountId || '');
      const amount = Number(line.amount);

      return {
        id: tx.id,
        type: tx.transactionType,
        description: tx.description,
        reference: tx.reference,
        loadId: tx.loadId,
        amount: isDebit ? amount : -amount, // Positive = money in, Negative = money out
        createdAt: tx.createdAt,
      };
    });

    return NextResponse.json({
      transactions: formattedTransactions,
      pagination: {
        limit,
        offset,
        totalCount,
        hasMore: offset + limit < totalCount,
      },
    });
  } catch (error) {
    console.error('Get wallet transactions error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

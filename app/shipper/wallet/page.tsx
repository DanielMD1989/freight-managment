/**
 * Shipper Wallet Page
 *
 * Financial management page showing:
 * - Wallet balance (current and available)
 * - Financial summary (deposits, spending, pending)
 * - Transaction history with filtering
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import ShipperWalletClient from './ShipperWalletClient';

export const metadata = {
  title: 'Wallet | Shipper',
  description: 'Manage your wallet balance and view transactions',
};

export default async function WalletPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/shipper/wallet');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'SHIPPER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/shipper?error=no-organization');
  }

  // Fetch wallet account
  const walletAccount = await db.financialAccount.findFirst({
    where: {
      organizationId: session.organizationId,
      accountType: 'SHIPPER_WALLET',
    },
    select: {
      id: true,
      balance: true,
      currency: true,
      createdAt: true,
    },
  });

  // Calculate pending payments (trips in progress that will deduct service fees)
  const pendingTrips = await db.load.aggregate({
    where: {
      shipperId: session.organizationId,
      status: { in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'] },
      serviceFeeStatus: 'RESERVED',
    },
    _sum: {
      serviceFeeEtb: true,
    },
    _count: true,
  });

  // Get financial summary from journal entries
  const [totalDeposits, totalServiceFees] = await Promise.all([
    // Total deposits
    db.journalLine.aggregate({
      where: {
        account: {
          organizationId: session.organizationId,
          accountType: 'SHIPPER_WALLET',
        },
        isDebit: false, // Credits to wallet = deposits
        journalEntry: {
          transactionType: 'DEPOSIT',
        },
      },
      _sum: {
        amount: true,
      },
    }),

    // Total service fees paid (debits from wallet for service fees)
    db.journalLine.aggregate({
      where: {
        account: {
          organizationId: session.organizationId,
          accountType: 'SHIPPER_WALLET',
        },
        isDebit: true, // Debits from wallet = payments
        journalEntry: {
          transactionType: { in: ['SERVICE_FEE_RESERVE', 'SERVICE_FEE_DEDUCT'] },
        },
      },
      _sum: {
        amount: true,
      },
    }),
  ]);

  // Get recent transactions with details
  const recentTransactions = await db.journalLine.findMany({
    where: {
      account: {
        organizationId: session.organizationId,
        accountType: 'SHIPPER_WALLET',
      },
    },
    include: {
      journalEntry: {
        select: {
          id: true,
          transactionType: true,
          description: true,
          reference: true,
          createdAt: true,
          load: {
            select: {
              id: true,
              pickupCity: true,
              deliveryCity: true,
            },
          },
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: 50, // Get last 50 transactions for client-side filtering
  });

  // Transform transactions for client
  const transactions = recentTransactions.map((line) => ({
    id: line.id,
    date: line.createdAt.toISOString(),
    type: line.journalEntry.transactionType,
    description: line.journalEntry.description,
    reference: line.journalEntry.reference,
    amount: Number(line.amount),
    isDebit: line.isDebit,
    loadId: line.journalEntry.load?.id || null,
    loadRoute: line.journalEntry.load
      ? `${line.journalEntry.load.pickupCity} → ${line.journalEntry.load.deliveryCity}`
      : null,
  }));

  const walletData = {
    balance: Number(walletAccount?.balance || 0),
    currency: walletAccount?.currency || 'ETB',
    availableBalance: Number(walletAccount?.balance || 0) - Number(pendingTrips._sum.serviceFeeEtb || 0),
    pendingAmount: Number(pendingTrips._sum.serviceFeeEtb || 0),
    pendingTripsCount: pendingTrips._count,
    totalDeposited: Number(totalDeposits._sum.amount || 0),
    totalSpent: Number(totalServiceFees._sum.amount || 0),
    transactions,
  };

  return <ShipperWalletClient walletData={walletData} />;
}

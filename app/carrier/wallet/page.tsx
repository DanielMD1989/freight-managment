/**
 * Carrier Wallet Page
 *
 * Financial management page showing:
 * - Wallet balance (current and available)
 * - Financial summary (earnings, pending, completed)
 * - Transaction history with filtering
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import CarrierWalletClient from './CarrierWalletClient';

export const metadata = {
  title: 'Wallet | Carrier',
  description: 'Manage your earnings and view transactions',
};

export default async function CarrierWalletPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/carrier/wallet');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'CARRIER' && session.role !== 'ADMIN')) {
    redirect('/unauthorized');
  }

  if (!session.organizationId) {
    redirect('/carrier?error=no-organization');
  }

  // Fetch wallet account
  const walletAccount = await db.financialAccount.findFirst({
    where: {
      organizationId: session.organizationId,
      accountType: 'CARRIER_WALLET',
    },
    select: {
      id: true,
      balance: true,
      currency: true,
      createdAt: true,
    },
  });

  // Pending earnings (trips in progress that will pay out)
  const pendingTrips = await db.load.aggregate({
    where: {
      assignedTruck: {
        is: { carrierId: session.organizationId },
      },
      status: { in: ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'] },
    },
    _count: true,
  });

  // Financial summary from journal entries
  const [totalEarnings, totalWithdrawals, completedTripsCount] = await Promise.all([
    // Total credits to carrier wallet (settlements/earnings)
    db.journalLine.aggregate({
      where: {
        account: {
          organizationId: session.organizationId,
          accountType: 'CARRIER_WALLET',
        },
        isDebit: false, // Credits = earnings
      },
      _sum: {
        amount: true,
      },
    }),

    // Total debits from carrier wallet (withdrawals)
    db.journalLine.aggregate({
      where: {
        account: {
          organizationId: session.organizationId,
          accountType: 'CARRIER_WALLET',
        },
        isDebit: true, // Debits = withdrawals
      },
      _sum: {
        amount: true,
      },
    }),

    // Completed deliveries
    db.load.count({
      where: {
        status: 'DELIVERED',
        assignedTruck: {
          is: { carrierId: session.organizationId },
        },
      },
    }),
  ]);

  // Recent transactions
  const recentTransactions = await db.journalLine.findMany({
    where: {
      account: {
        organizationId: session.organizationId,
        accountType: 'CARRIER_WALLET',
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
    take: 50,
  });

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
    totalEarnings: Number(totalEarnings._sum.amount || 0),
    totalWithdrawals: Number(totalWithdrawals._sum.amount || 0),
    pendingTripsCount: pendingTrips._count,
    completedTripsCount,
    transactions,
  };

  return <CarrierWalletClient walletData={walletData} />;
}

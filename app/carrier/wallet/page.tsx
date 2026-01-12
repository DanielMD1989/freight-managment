/**
 * Carrier Wallet Page
 *
 * View wallet balance and earnings
 * Sprint 12 - Story 12.6: Wallet & Financial
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

/**
 * Carrier Wallet Page
 */
export default async function CarrierWalletPage() {
  // Verify authentication
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
    },
  });

  // Get earnings summary for average calculation
  // Filter by loads assigned to trucks owned by this carrier
  const [completedDeliveries, totalRevenue] = await Promise.all([
    db.load.count({
      where: {
        status: 'DELIVERED',
        assignedTruck: {
          is: {
            carrierId: session.organizationId,
          },
        },
      },
    }),

    db.load.aggregate({
      where: {
        status: 'DELIVERED',
        assignedTruck: {
          is: {
            carrierId: session.organizationId,
          },
        },
      },
      _sum: {
        rate: true,
      },
    }),
  ]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-[#064d51]">Wallet</h1>
        <p className="text-[#064d51]/70 mt-1">
          Manage your earnings
        </p>
      </div>

      {/* Wallet Balance Card */}
      <div className="bg-gradient-to-r from-[#1e9c99] to-[#0d7377] rounded-xl shadow-lg p-8 mb-8 text-white">
        <div className="mb-2">
          <h2 className="text-sm font-medium opacity-90">Current Balance</h2>
        </div>
        <div className="mb-6">
          <div className="text-4xl font-bold">
            {formatCurrency(Number(walletAccount?.balance || 0))}
          </div>
        </div>
        <a
          href="/carrier/wallet/withdraw"
          className="inline-block px-6 py-3 bg-white text-[#1e9c99] rounded-lg font-semibold hover:bg-white/90 transition-colors"
        >
          Withdraw Funds
        </a>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Average per Delivery */}
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
          <div className="text-sm text-[#064d51]/70 mb-2">Average per Delivery</div>
          <div className="text-2xl font-bold text-[#064d51]">
            {completedDeliveries > 0
              ? formatCurrency(Number(totalRevenue._sum.rate || 0) / completedDeliveries)
              : formatCurrency(0)}
          </div>
          <div className="text-xs text-[#064d51]/60 mt-1">
            Based on {completedDeliveries} completed deliveries
          </div>
        </div>

        {/* View Transactions */}
        <a
          href="/carrier/transactions"
          className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6 hover:border-[#1e9c99] transition-colors group"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-[#064d51]/70 mb-2">Transactions</div>
              <div className="text-lg font-semibold text-[#064d51] group-hover:text-[#1e9c99]">
                View All Transactions
              </div>
              <div className="text-xs text-[#064d51]/60 mt-1">
                See your account activity
              </div>
            </div>
            <span className="text-2xl text-[#064d51]/30 group-hover:text-[#1e9c99] transition-colors">
              →
            </span>
          </div>
        </a>
      </div>
    </div>
  );
}

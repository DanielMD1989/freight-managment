/**
 * Wallet Page
 *
 * View wallet balance and financial summary
 * Sprint 11 - Story 11.6: Wallet & Financial
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';

/**
 * Wallet Page
 */
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
      updatedAt: true,
    },
  });

  // Get transaction summary for average calculation
  const [totalSpent, completedLoads] = await Promise.all([
    // Total amount spent on completed loads
    db.load.aggregate({
      where: {
        shipperId: session.organizationId,
        status: 'DELIVERED',
      },
      _sum: {
        rate: true,
      },
    }),

    // Count of completed loads
    db.load.count({
      where: {
        shipperId: session.organizationId,
        status: 'DELIVERED',
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
          Manage your account balance
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
          href="/shipper/wallet/topup"
          className="inline-block px-6 py-3 bg-white text-[#1e9c99] rounded-lg font-semibold hover:bg-white/90 transition-colors"
        >
          Top Up Wallet
        </a>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Average per Load */}
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
          <div className="text-sm text-[#064d51]/70 mb-2">Average per Load</div>
          <div className="text-2xl font-bold text-[#064d51]">
            {completedLoads > 0
              ? formatCurrency(Number(totalSpent._sum.rate || 0) / completedLoads)
              : formatCurrency(0)}
          </div>
          <div className="text-xs text-[#064d51]/60 mt-1">
            Based on {completedLoads} completed loads
          </div>
        </div>

        {/* View Transactions */}
        <a
          href="/shipper/transactions"
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

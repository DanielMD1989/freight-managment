/**
 * Wallet Page
 *
 * View wallet balance and financial summary
 * Sprint 11 - Story 11.6: Wallet & Financial
 * Updated: UI/UX Professionalization Pass
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import Link from 'next/link';

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

  // Get load counts and recent activity
  const [completedLoads, activeLoads, recentTransactions] = await Promise.all([
    // Count of completed loads
    db.load.count({
      where: {
        shipperId: session.organizationId,
        status: 'DELIVERED',
      },
    }),

    // Count of active loads
    db.load.count({
      where: {
        shipperId: session.organizationId,
        status: { in: ['SEARCHING', 'ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'] },
      },
    }),

    // Recent loads for transaction history
    db.load.findMany({
      where: {
        shipperId: session.organizationId,
        status: { in: ['DELIVERED', 'COMPLETED', 'IN_TRANSIT'] },
      },
      select: {
        id: true,
        pickupCity: true,
        deliveryCity: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
  ]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--foreground)' }}
        >
          Wallet
        </h1>
        <p
          className="mt-1"
          style={{ color: 'var(--foreground-muted)' }}
        >
          Manage your account balance and view spending
        </p>
      </div>

      {/* Wallet Balance Card */}
      <div
        className="rounded-xl shadow-lg p-8 mb-8 text-white"
        style={{
          background: 'linear-gradient(135deg, var(--primary-600), var(--primary-700))',
        }}
      >
        <div className="mb-2">
          <h2 className="text-sm font-medium opacity-90">Current Balance</h2>
        </div>
        <div className="mb-6">
          <div className="text-3xl sm:text-4xl font-bold">
            {formatCurrency(Number(walletAccount?.balance || 0))}
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/shipper/loads/create"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white rounded-lg font-semibold transition-all hover:bg-white/90"
            style={{ color: 'var(--primary-600)' }}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Post New Load
          </Link>
          <Link
            href="/shipper/analytics"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/20 rounded-lg font-medium text-white transition-all hover:bg-white/30"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            View Analytics
          </Link>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Completed Loads */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="text-sm mb-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Completed Deliveries
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: 'var(--foreground)' }}
          >
            {completedLoads}
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Successfully delivered
          </div>
        </div>

        {/* Active Loads */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="text-sm mb-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Active Loads
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: 'var(--foreground)' }}
          >
            {activeLoads}
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Currently in progress
          </div>
        </div>

        {/* Total Loads */}
        <div
          className="rounded-xl p-5"
          style={{
            background: 'var(--card)',
            border: '1px solid var(--border)',
          }}
        >
          <div
            className="text-sm mb-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            Total Loads
          </div>
          <div
            className="text-2xl font-bold"
            style={{ color: 'var(--foreground)' }}
          >
            {completedLoads + activeLoads}
          </div>
          <div
            className="text-xs mt-1"
            style={{ color: 'var(--foreground-muted)' }}
          >
            All time
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div
        className="rounded-xl overflow-hidden"
        style={{
          background: 'var(--card)',
          border: '1px solid var(--border)',
        }}
      >
        <div
          className="px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border)' }}
        >
          <h2
            className="font-semibold"
            style={{ color: 'var(--foreground)' }}
          >
            Recent Activity
          </h2>
          <Link
            href="/shipper/loads"
            className="text-sm font-medium transition-colors"
            style={{ color: 'var(--primary-500)' }}
          >
            View All
          </Link>
        </div>

        {recentTransactions.length > 0 ? (
          <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
            {recentTransactions.map((load) => (
              <Link
                key={load.id}
                href={`/shipper/loads/${load.id}`}
                className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-[var(--bg-tinted)]"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--bg-tinted)' }}
                  >
                    <svg
                      className="w-5 h-5"
                      style={{ color: 'var(--primary-500)' }}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                    </svg>
                  </div>
                  <div>
                    <div
                      className="font-medium text-sm"
                      style={{ color: 'var(--foreground)' }}
                    >
                      {load.pickupCity} → {load.deliveryCity}
                    </div>
                    <div
                      className="text-xs"
                      style={{ color: 'var(--foreground-muted)' }}
                    >
                      {new Date(load.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className="text-sm font-medium capitalize px-2 py-0.5 rounded-full"
                    style={{
                      color: load.status === 'DELIVERED' || load.status === 'COMPLETED'
                        ? 'var(--success-600)'
                        : 'var(--warning-600)',
                      background: load.status === 'DELIVERED' || load.status === 'COMPLETED'
                        ? 'var(--success-100)'
                        : 'var(--warning-100)',
                    }}
                  >
                    {load.status.toLowerCase().replace('_', ' ')}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div
              className="w-14 h-14 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ background: 'var(--bg-tinted)' }}
            >
              <svg
                className="w-6 h-6"
                style={{ color: 'var(--foreground-muted)' }}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <p
              className="text-sm font-medium mb-1"
              style={{ color: 'var(--foreground)' }}
            >
              No activity yet
            </p>
            <p
              className="text-xs mb-4"
              style={{ color: 'var(--foreground-muted)' }}
            >
              Your load activity will appear here
            </p>
            <Link
              href="/shipper/loads/create"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ background: 'var(--primary-500)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Post Your First Load
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

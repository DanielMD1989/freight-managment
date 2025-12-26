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

  // Get transaction summary
  const [totalSpent, completedLoads, pendingPayments] = await Promise.all([
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

    // Sum of pending load payments
    db.load.aggregate({
      where: {
        shipperId: session.organizationId,
        status: {
          in: ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'],
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
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Wallet</h1>
        <p className="text-gray-600 mt-2">
          Manage your account balance and transactions
        </p>
      </div>

      {/* Wallet Balance Card */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 rounded-lg shadow-lg p-8 mb-8 text-white">
        <div className="mb-4">
          <h2 className="text-lg opacity-90">Current Balance</h2>
        </div>
        <div className="mb-6">
          <div className="text-5xl font-bold">
            {formatCurrency(Number(walletAccount?.balance || 0))}
          </div>
          <div className="text-sm opacity-75 mt-2">
            {walletAccount?.currency || 'ETB'}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <button className="px-6 py-3 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors">
            Add Funds
          </button>
          <button className="px-6 py-3 bg-blue-800 text-white rounded-lg font-medium hover:bg-blue-900 transition-colors">
            Withdraw
          </button>
        </div>
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Spent</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(Number(totalSpent._sum.rate || 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {completedLoads} completed shipments
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Pending Payments</div>
          <div className="text-2xl font-bold text-yellow-600">
            {formatCurrency(Number(pendingPayments._sum.rate || 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            In escrow for active loads
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Average per Load</div>
          <div className="text-2xl font-bold text-gray-900">
            {completedLoads > 0
              ? formatCurrency(Number(totalSpent._sum.rate || 0) / completedLoads)
              : formatCurrency(0)}
          </div>
          <div className="text-xs text-gray-500 mt-1">Based on completed loads</div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <a
            href="/shipper/transactions"
            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">View Transactions</div>
              <div className="text-sm text-gray-600">See all account activity</div>
            </div>
            <span className="text-gray-400">→</span>
          </a>

          <button
            onClick={() => alert('Top-up functionality coming soon!')}
            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">Top Up Wallet</div>
              <div className="text-sm text-gray-600">Add funds to your account</div>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <button
            onClick={() => alert('Withdrawal functionality coming soon!')}
            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">Request Withdrawal</div>
              <div className="text-sm text-gray-600">Transfer funds to bank</div>
            </div>
            <span className="text-gray-400">→</span>
          </button>

          <a
            href="/shipper/loads"
            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">View Load History</div>
              <div className="text-sm text-gray-600">See all your shipments</div>
            </div>
            <span className="text-gray-400">→</span>
          </a>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">How Wallet Works</h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Add funds to your wallet to pay for shipments quickly and securely
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Funds are held in escrow when a load is matched with a carrier
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Payment is released to the carrier once delivery is confirmed
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>You can withdraw unused funds at any time</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

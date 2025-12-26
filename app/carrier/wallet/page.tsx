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
import Link from 'next/link';

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
      createdAt: true,
      updatedAt: true,
    },
  });

  // Get earnings summary
  // Note: This would need a proper Load-Carrier relationship in the schema
  // For now, using completed deliveries from dashboard query
  const [completedDeliveries, totalRevenue] = await Promise.all([
    // Count of completed loads (would need carrierId field on Load)
    db.load.count({
      where: {
        status: 'DELIVERED',
        // TODO: Add carrierId field to Load model for proper tracking
      },
    }),

    // Total revenue from completed loads
    db.load.aggregate({
      where: {
        status: 'DELIVERED',
        // TODO: Filter by carrier's loads
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
          Manage your earnings and account balance
        </p>
      </div>

      {/* Wallet Balance Card */}
      <div className="bg-gradient-to-r from-green-600 to-green-700 rounded-lg shadow-lg p-8 mb-8 text-white">
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
          <button className="px-6 py-3 bg-white text-green-600 rounded-lg font-medium hover:bg-green-50 transition-colors">
            Withdraw Funds
          </button>
          <Link
            href="/carrier/transactions"
            className="px-6 py-3 bg-green-800 text-white rounded-lg font-medium hover:bg-green-900 transition-colors text-center"
          >
            View Transactions
          </Link>
        </div>
      </div>

      {/* Earnings Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Earnings</div>
          <div className="text-2xl font-bold text-gray-900">
            {formatCurrency(Number(totalRevenue._sum.rate || 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {completedDeliveries} completed deliveries
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Available Balance</div>
          <div className="text-2xl font-bold text-green-600">
            {formatCurrency(Number(walletAccount?.balance || 0))}
          </div>
          <div className="text-xs text-gray-500 mt-1">Ready to withdraw</div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">
            Average per Delivery
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {completedDeliveries > 0
              ? formatCurrency(
                  Number(totalRevenue._sum.rate || 0) / completedDeliveries
                )
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
          <Link
            href="/carrier/transactions"
            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">View Transactions</div>
              <div className="text-sm text-gray-600">See all account activity</div>
            </div>
            <span className="text-gray-400">→</span>
          </Link>

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

          <Link
            href="/carrier"
            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">View Dashboard</div>
              <div className="text-sm text-gray-600">See fleet overview</div>
            </div>
            <span className="text-gray-400">→</span>
          </Link>

          <Link
            href="/carrier/matches"
            className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <div>
              <div className="font-medium text-gray-900">Find Loads</div>
              <div className="text-sm text-gray-600">Browse available loads</div>
            </div>
            <span className="text-gray-400">→</span>
          </Link>
        </div>
      </div>

      {/* Information */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">
          How Carrier Wallet Works
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Earnings from completed deliveries are automatically added to your
              wallet
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Funds are held in escrow during delivery and released upon
              confirmation
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              You can withdraw your available balance to your bank account at any
              time
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              All transactions are tracked and can be viewed in your transaction
              history
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

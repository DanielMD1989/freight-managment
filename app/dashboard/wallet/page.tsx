/**
 * Wallet Page
 *
 * Sprint 16 - Story 16.7: Commission & Revenue Tracking
 *
 * Full wallet and commission dashboard
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CommissionDashboard from '@/components/CommissionDashboard';

export const metadata = {
  title: 'Wallet | Freight Management',
  description: 'View your wallet balance and transaction history',
};

export default async function WalletPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Wallet & Commissions</h1>
          <p className="text-gray-600 mt-2">
            Track your balance, commissions, and transaction history
          </p>
        </div>

        {/* Commission Dashboard */}
        <CommissionDashboard />
      </div>
    </div>
  );
}

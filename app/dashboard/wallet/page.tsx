/**
 * Wallet Page
 *
 * Sprint 16 - Story 16.7: Wallet & Financial
 *
 * Redirects to role-appropriate wallet page
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';

export const metadata = {
  title: 'Wallet | Freight Management',
  description: 'View your wallet balance and transaction history',
};

export default async function WalletPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Redirect to role-appropriate wallet
  if (user.role === 'SHIPPER') {
    redirect('/shipper/wallet');
  } else if (user.role === 'CARRIER') {
    redirect('/carrier/wallet');
  } else if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    redirect('/admin/wallets');
  }

  // Fallback: Show basic wallet info
  const walletAccount = user.organizationId ? await db.financialAccount.findFirst({
    where: {
      organizationId: user.organizationId,
    },
    select: {
      id: true,
      balance: true,
      currency: true,
      accountType: true,
    },
  }) : null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-tinted)]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#064d51]">Wallet</h1>
          <p className="text-[#064d51]/70 mt-1">
            View your account balance
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
        </div>

        {/* Info Card */}
        <div className="bg-white rounded-xl shadow-sm border border-[var(--border)] p-6">
          <p className="text-[#064d51]/70 text-sm">
            Contact support for wallet assistance.
          </p>
        </div>
      </div>
    </div>
  );
}

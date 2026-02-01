/**
 * Wallet Widget Component
 *
 * Compact wallet balance widget for dashboard
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface WalletBalance {
  wallets: Array<{
    id: string;
    type: string;
    balance: number;
    currency: string;
    lastTransactionAt: string | null;
  }>;
  totalBalance: number;
  currency: string;
  recentTransactionsCount: number;
}

export default function WalletWidget() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/wallet/balance');
      if (!res.ok) {
        if (res.status === 404) {
          // No wallet found - this is OK, just don't show widget
          setBalance(null);
          return;
        }
        throw new Error('Failed to fetch wallet balance');
      }

      const data = await res.json();
      setBalance(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load wallet');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/3 mb-3"></div>
          <div className="h-8 bg-gray-200 rounded w-2/3"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!balance) {
    return null; // Don't show widget if no wallet
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: balance.currency || 'ETB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 text-white">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-sm font-medium opacity-90 mb-1">Wallet Balance</h3>
          <p className="text-3xl font-bold">
            {formatCurrency(balance.totalBalance)}
          </p>
        </div>
        <svg
          className="w-10 h-10 opacity-80"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 6l3 1m0 0l-3 9a5.002 5.002 0 006.001 0M6 7l3 9M6 7l6-2m6 2l3-1m-3 1l-3 9a5.002 5.002 0 006.001 0M18 7l3 9m-3-9l-6-2m0-2v2m0 16V5m0 16H9m3 0h3"
          />
        </svg>
      </div>

      {/* Wallet Details */}
      <div className="space-y-2 mb-4">
        {balance.wallets.map((wallet) => (
          <div
            key={wallet.id}
            className="flex items-center justify-between text-sm"
          >
            <span className="opacity-90">
              {wallet.type === 'SHIPPER_WALLET' ? 'Shipper' : 'Carrier'}
            </span>
            <span className="font-medium">
              {formatCurrency(wallet.balance)}
            </span>
          </div>
        ))}
      </div>

      {/* Recent Transactions Badge */}
      {balance.recentTransactionsCount > 0 && (
        <div className="flex items-center gap-2 text-xs opacity-90 mb-4">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
              clipRule="evenodd"
            />
          </svg>
          <span>
            {balance.recentTransactionsCount} transaction
            {balance.recentTransactionsCount !== 1 ? 's' : ''} in last 30 days
          </span>
        </div>
      )}

      {/* View Details Link */}
      <Link
        href="/shipper/wallet"
        className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80 transition-opacity"
      >
        <span>View transactions</span>
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
            clipRule="evenodd"
          />
        </svg>
      </Link>
    </div>
  );
}

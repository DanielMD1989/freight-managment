/**
 * Commission Dashboard Component
 *
 * Sprint 16 - Story 16.7: Commission & Revenue Tracking
 *
 * Displays commission statistics and transaction history
 */

'use client';

import { useEffect, useState } from 'react';

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
  recentCommissionsCount: number;
}

interface Transaction {
  id: string;
  type: string;
  description: string;
  reference: string | null;
  loadId: string | null;
  amount: number;
  createdAt: string;
}

interface TransactionResponse {
  transactions: Transaction[];
  pagination: {
    limit: number;
    offset: number;
    totalCount: number;
    hasMore: boolean;
  };
}

export default function CommissionDashboard() {
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>('all');

  useEffect(() => {
    fetchData();
  }, [selectedType]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch balance
      const balanceRes = await fetch('/api/wallet/balance');
      if (!balanceRes.ok) {
        throw new Error('Failed to fetch wallet balance');
      }
      const balanceData = await balanceRes.json();
      setBalance(balanceData);

      // Fetch transactions
      const transactionsUrl =
        selectedType === 'all'
          ? '/api/wallet/transactions?limit=20'
          : `/api/wallet/transactions?limit=20&type=${selectedType}`;

      const transactionsRes = await fetch(transactionsUrl);
      if (!transactionsRes.ok) {
        throw new Error('Failed to fetch transactions');
      }
      const transactionsData: TransactionResponse =
        await transactionsRes.json();
      setTransactions(transactionsData.transactions);
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-[#064d51]/10 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-[#064d51]/10 rounded"></div>
            <div className="h-4 bg-[#064d51]/10 rounded w-5/6"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800 text-sm">{error}</p>
      </div>
    );
  }

  if (!balance) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
        <p className="text-yellow-800 text-sm">No wallet found</p>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: balance.currency || 'ETB',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTransactionColor = (amount: number) => {
    return amount >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const getTransactionBadgeColor = (type: string) => {
    switch (type) {
      case 'COMMISSION':
        return 'bg-red-100 text-red-800';
      case 'PAYMENT':
        return 'bg-green-100 text-green-800';
      case 'REFUND':
        return 'bg-blue-100 text-blue-800';
      case 'ADJUSTMENT':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Wallet Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Total Balance */}
        <div className="bg-gradient-to-br from-[#1e9c99] to-[#064d51] rounded-lg shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium opacity-90">Total Balance</h3>
            <svg
              className="w-8 h-8 opacity-80"
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
          <p className="text-3xl font-bold">
            {formatCurrency(balance.totalBalance)}
          </p>
          <p className="text-xs opacity-75 mt-1">
            {balance.wallets.length} active wallet
            {balance.wallets.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Wallet Details */}
        {balance.wallets.map((wallet) => (
          <div
            key={wallet.id}
            className="bg-white rounded-lg shadow border border-[#064d51]/15 p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-[#064d51]/70">
                {wallet.type === 'SHIPPER_WALLET'
                  ? 'Shipper Wallet'
                  : 'Carrier Wallet'}
              </h3>
              <span className="px-2 py-1 bg-[#064d51]/10 text-[#064d51]/70 text-xs font-medium rounded">
                {wallet.currency}
              </span>
            </div>
            <p className="text-2xl font-bold text-[#064d51]">
              {formatCurrency(wallet.balance)}
            </p>
            {wallet.lastTransactionAt && (
              <p className="text-xs text-[#064d51]/60 mt-1">
                Last transaction: {formatDate(wallet.lastTransactionAt)}
              </p>
            )}
          </div>
        ))}

        {/* Recent Commissions */}
        <div className="bg-white rounded-lg shadow border border-[#064d51]/15 p-6">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-medium text-[#064d51]/70">
              Recent Commissions
            </h3>
            <svg
              className="w-8 h-8 text-[#064d51]/50"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
              />
            </svg>
          </div>
          <p className="text-2xl font-bold text-[#064d51]">
            {balance.recentCommissionsCount}
          </p>
          <p className="text-xs text-[#064d51]/60 mt-1">Last 30 days</p>
        </div>
      </div>

      {/* Transaction History */}
      <div className="bg-white rounded-lg shadow border border-[#064d51]/15">
        <div className="px-6 py-4 border-b border-[#064d51]/15">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[#064d51]">
              Transaction History
            </h2>

            {/* Filter Buttons */}
            <div className="flex gap-2">
              {['all', 'COMMISSION', 'PAYMENT', 'REFUND', 'ADJUSTMENT'].map(
                (type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                      selectedType === type
                        ? 'bg-[#1e9c99] text-white'
                        : 'bg-[#064d51]/10 text-[#064d51]/70 hover:bg-[#064d51]/20'
                    }`}
                  >
                    {type === 'all' ? 'All' : type}
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        <div className="divide-y divide-[#064d51]/10">
          {transactions.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <svg
                className="mx-auto h-12 w-12 text-[#064d51]/40"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <p className="mt-2 text-sm text-[#064d51]/60">No transactions found</p>
            </div>
          ) : (
            transactions.map((tx) => (
              <div
                key={tx.id}
                className="px-6 py-4 hover:bg-[#f0fdfa] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`px-2 py-1 text-xs font-medium rounded ${getTransactionBadgeColor(
                          tx.type
                        )}`}
                      >
                        {tx.type}
                      </span>
                      {tx.loadId && (
                        <a
                          href={`/shipper/loads/${tx.loadId}`}
                          className="text-xs text-[#1e9c99] hover:underline"
                        >
                          Load #{tx.loadId.slice(0, 8)}
                        </a>
                      )}
                    </div>
                    <p className="text-sm text-[#064d51] font-medium">
                      {tx.description}
                    </p>
                    <p className="text-xs text-[#064d51]/60 mt-1">
                      {formatDate(tx.createdAt)}
                      {tx.reference && ` • Ref: ${tx.reference}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-lg font-bold ${getTransactionColor(
                        tx.amount
                      )}`}
                    >
                      {tx.amount >= 0 ? '+' : ''}
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

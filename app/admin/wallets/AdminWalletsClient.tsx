'use client';

/**
 * Admin Wallets Client Component
 *
 * Interactive table with filtering for all platform financial accounts
 * Includes financial summary cards at top
 */

import { useState, useEffect } from 'react';

type AccountType = 'ALL' | 'SHIPPER_WALLET' | 'CARRIER_WALLET' | 'PLATFORM_REVENUE';

interface Wallet {
  id: string;
  accountType: string;
  balance: number;
  currency: string;
  lastTransactionAt: string | null;
  createdAt: string;
  shipper: {
    id: string;
    name: string;
  } | null;
  carrier: {
    id: string;
    name: string;
  } | null;
}

interface WalletSummary {
  totalPlatformRevenue: number;
  totalShipperDeposits: number;
  totalCarrierEarnings: number;
}

const ACCOUNT_TABS: { key: AccountType; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'SHIPPER_WALLET', label: 'Shipper Wallets' },
  { key: 'CARRIER_WALLET', label: 'Carrier Wallets' },
  { key: 'PLATFORM_REVENUE', label: 'Platform Revenue' },
];

const ACCOUNT_COLORS: Record<string, string> = {
  SHIPPER_WALLET: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  CARRIER_WALLET: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300',
  PLATFORM_REVENUE: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  ESCROW: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
};

export default function AdminWalletsClient() {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<AccountType>('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState<WalletSummary>({
    totalPlatformRevenue: 0,
    totalShipperDeposits: 0,
    totalCarrierEarnings: 0,
  });

  const fetchWallets = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
      });

      if (activeType !== 'ALL') {
        params.append('accountType', activeType);
      }

      const response = await fetch(`/api/wallets?${params}`);
      if (response.ok) {
        const data = await response.json();
        setWallets(data.wallets || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error('Failed to fetch wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const response = await fetch('/api/wallets/summary');
      if (response.ok) {
        const data = await response.json();
        setSummary({
          totalPlatformRevenue: data.totalPlatformRevenue || 0,
          totalShipperDeposits: data.totalShipperDeposits || 0,
          totalCarrierEarnings: data.totalCarrierEarnings || 0,
        });
      }
    } catch (error) {
      console.error('Failed to fetch wallet summary:', error);
    }
  };

  useEffect(() => {
    fetchWallets();
  }, [activeType, page]);

  useEffect(() => {
    fetchSummary();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-ET', {
      style: 'currency',
      currency: 'ETB',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const getOwnerName = (wallet: Wallet) => {
    if (wallet.shipper) return wallet.shipper.name;
    if (wallet.carrier) return wallet.carrier.name;
    if (wallet.accountType === 'PLATFORM_REVENUE') return 'Platform';
    return '-';
  };

  const formatAccountType = (type: string) => {
    return type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  return (
    <div className="space-y-4">
      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Platform Revenue</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(summary.totalPlatformRevenue)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Shipper Deposits</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(summary.totalShipperDeposits)}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">Carrier Earnings</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{formatCurrency(summary.totalCarrierEarnings)}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Account Type Tabs */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm p-1 inline-flex gap-1 flex-wrap">
        {ACCOUNT_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveType(tab.key);
              setPage(1);
            }}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              activeType === tab.key
                ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900'
                : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {totalCount} accounts found
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200/60 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Account Type</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Owner</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Balance</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Currency</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Last Transaction</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    Loading...
                  </td>
                </tr>
              ) : wallets.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 dark:text-slate-400">
                    No accounts found
                  </td>
                </tr>
              ) : (
                wallets.map((wallet) => (
                  <tr key={wallet.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50">
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${ACCOUNT_COLORS[wallet.accountType] || 'bg-gray-100 text-gray-800'}`}>
                        {formatAccountType(wallet.accountType)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {getOwnerName(wallet)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm font-medium ${wallet.balance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {formatCurrency(wallet.balance)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {wallet.currency}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(wallet.lastTransactionAt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(wallet.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1 text-sm rounded-lg border border-slate-200 dark:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-slate-700"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

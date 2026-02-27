"use client";

/**
 * Shipper Wallet Client Component
 *
 * Interactive wallet interface with:
 * - Balance display
 * - Financial summary cards
 * - Transaction history with filtering and pagination
 */

import { useState } from "react";
import Link from "next/link";

type TransactionType =
  | "ALL"
  | "DEPOSIT"
  | "SERVICE_FEE_RESERVE"
  | "SERVICE_FEE_DEDUCT"
  | "SERVICE_FEE_REFUND"
  | "REFUND";

interface Transaction {
  id: string;
  date: string;
  type: string;
  description: string;
  reference: string | null;
  amount: number;
  isDebit: boolean;
  loadId: string | null;
  loadRoute: string | null;
}

interface WalletData {
  balance: number;
  currency: string;
  availableBalance: number;
  pendingAmount: number;
  pendingTripsCount: number;
  totalDeposited: number;
  totalSpent: number;
  transactions: Transaction[];
}

interface ShipperWalletClientProps {
  walletData: WalletData;
}

const TYPE_FILTERS: { key: TransactionType; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DEPOSIT", label: "Deposits" },
  { key: "SERVICE_FEE_RESERVE", label: "Reserved" },
  { key: "SERVICE_FEE_DEDUCT", label: "Deducted" },
  { key: "REFUND", label: "Refunds" },
];

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  SERVICE_FEE_RESERVE: "Service Fee Reserved",
  SERVICE_FEE_DEDUCT: "Service Fee Deducted",
  SERVICE_FEE_REFUND: "Service Fee Refund",
  REFUND: "Refund",
  COMMISSION: "Commission",
  SETTLEMENT: "Settlement",
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  DEPOSIT: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
  SERVICE_FEE_RESERVE: {
    bg: "bg-yellow-100 dark:bg-yellow-900/30",
    text: "text-yellow-700 dark:text-yellow-300",
  },
  SERVICE_FEE_DEDUCT: {
    bg: "bg-red-100 dark:bg-red-900/30",
    text: "text-red-700 dark:text-red-300",
  },
  SERVICE_FEE_REFUND: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  REFUND: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  WITHDRAWAL: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
  },
};

function formatCurrency(amount: number, currency: string = "ETB"): string {
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatTime(dateString: string): string {
  return new Date(dateString).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ShipperWalletClient({
  walletData,
}: ShipperWalletClientProps) {
  const [filterType, setFilterType] = useState<TransactionType>("ALL");
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filter transactions
  const filteredTransactions = walletData.transactions.filter((t) => {
    if (filterType === "ALL") return true;
    if (filterType === "REFUND") {
      return t.type === "REFUND" || t.type === "SERVICE_FEE_REFUND";
    }
    return t.type === filterType;
  });

  // Paginate
  const totalPages = Math.ceil(filteredTransactions.length / pageSize);
  const paginatedTransactions = filteredTransactions.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return (
    <div className="mx-auto max-w-5xl p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
          Wallet
        </h1>
        <p className="mt-1 text-slate-500 dark:text-slate-400">
          Manage your balance and view transactions
        </p>
      </div>

      {/* Balance Card */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 p-8 text-white shadow-lg">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-white/80">
              Current Balance
            </p>
            <p className="text-4xl font-bold">
              {formatCurrency(walletData.balance, walletData.currency)}
            </p>
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-white/80">
              Available Balance
            </p>
            <p className="text-4xl font-bold">
              {formatCurrency(walletData.availableBalance, walletData.currency)}
            </p>
            {walletData.pendingAmount > 0 && (
              <p className="mt-1 text-sm text-white/70">
                {formatCurrency(walletData.pendingAmount)} reserved for{" "}
                {walletData.pendingTripsCount} active trip
                {walletData.pendingTripsCount !== 1 ? "s" : ""}
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mt-6 flex flex-wrap gap-3 border-t border-white/20 pt-6">
          <button
            onClick={() =>
              alert(
                "Deposit functionality coming soon. Please contact support for manual deposits."
              )
            }
            className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 font-semibold text-teal-700 transition-all hover:bg-white/90"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Deposit Funds
          </button>
          <a
            href="#transactions"
            className="inline-flex items-center gap-2 rounded-lg bg-white/20 px-5 py-2.5 font-medium text-white transition-all hover:bg-white/30"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            View Transactions
          </a>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-5 w-5 text-green-600 dark:text-green-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Deposited
              </p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(walletData.totalDeposited, walletData.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-red-100 dark:bg-red-900/30">
              <svg
                className="h-5 w-5 text-red-600 dark:text-red-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Spent
              </p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(walletData.totalSpent, walletData.currency)}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
              <svg
                className="h-5 w-5 text-yellow-600 dark:text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Pending
              </p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(walletData.pendingAmount, walletData.currency)}
              </p>
              {walletData.pendingTripsCount > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {walletData.pendingTripsCount} active trip
                  {walletData.pendingTripsCount !== 1 ? "s" : ""}
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div
        id="transactions"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      >
        {/* Header */}
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Transaction History
            </h2>

            {/* Type Filter */}
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-700">
              {TYPE_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  onClick={() => {
                    setFilterType(filter.key);
                    setPage(1);
                  }}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-all ${
                    filterType === filter.key
                      ? "bg-white text-slate-800 shadow-sm dark:bg-slate-600 dark:text-white"
                      : "text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
                  }`}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Transaction List */}
        {paginatedTransactions.length > 0 ? (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {paginatedTransactions.map((transaction) => {
              const colors = TYPE_COLORS[transaction.type] || {
                bg: "bg-gray-100",
                text: "text-gray-700",
              };
              return (
                <div
                  key={transaction.id}
                  className="px-6 py-4 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/50"
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex min-w-0 items-center gap-4">
                      <div
                        className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg ${colors.bg}`}
                      >
                        {transaction.isDebit ? (
                          <svg
                            className={`h-5 w-5 ${colors.text}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17 13l-5 5m0 0l-5-5m5 5V6"
                            />
                          </svg>
                        ) : (
                          <svg
                            className={`h-5 w-5 ${colors.text}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M7 11l5-5m0 0l5 5m-5-5v12"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800 dark:text-white">
                          {transaction.description}
                        </p>
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <span>{formatDate(transaction.date)}</span>
                          <span>•</span>
                          <span>{formatTime(transaction.date)}</span>
                          {transaction.loadRoute && (
                            <>
                              <span>•</span>
                              <Link
                                href={`/shipper/loads/${transaction.loadId}`}
                                className="text-teal-600 hover:underline dark:text-teal-400"
                              >
                                {transaction.loadRoute}
                              </Link>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex-shrink-0 text-right">
                      <p
                        className={`font-semibold ${
                          transaction.isDebit
                            ? "text-red-600 dark:text-red-400"
                            : "text-green-600 dark:text-green-400"
                        }`}
                      >
                        {transaction.isDebit ? "-" : "+"}
                        {formatCurrency(
                          transaction.amount,
                          walletData.currency
                        )}
                      </p>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}
                      >
                        {TYPE_LABELS[transaction.type] || transaction.type}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700">
              <svg
                className="h-6 w-6 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.75}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
            <p className="mb-1 font-medium text-slate-800 dark:text-white">
              No transactions found
            </p>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {filterType === "ALL"
                ? "Your transaction history will appear here"
                : `No ${TYPE_FILTERS.find((f) => f.key === filterType)?.label.toLowerCase()} found`}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4 dark:border-slate-700">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing {(page - 1) * pageSize + 1}-
              {Math.min(page * pageSize, filteredTransactions.length)} of{" "}
              {filteredTransactions.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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

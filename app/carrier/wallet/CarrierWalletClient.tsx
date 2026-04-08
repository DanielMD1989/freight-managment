"use client";

/**
 * Carrier Wallet Client Component
 *
 * Interactive wallet interface with:
 * - Balance display
 * - Earnings summary cards
 * - Transaction history with filtering and pagination
 * - Load more functionality for full transaction history
 */

import { useState, useCallback } from "react";
import Link from "next/link";
import { getCSRFToken } from "@/lib/csrfFetch";

type TransactionFilter =
  | "ALL"
  | "SETTLEMENT"
  | "WITHDRAWAL"
  | "DEPOSIT"
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

interface ApiTransaction {
  id: string;
  createdAt: string;
  type: string;
  description: string;
  reference: string | null;
  amount: number;
  loadId: string | null;
}

interface WalletData {
  balance: number;
  currency: string;
  // Per-category totals (single source of truth from journal)
  totalDeposited: number;
  totalRefunded: number;
  serviceFeesPaid: number;
  totalWithdrawn: number;
  // Legacy / aggregated labels
  totalEarnings: number;
  totalWithdrawals: number;
  pendingTripsCount: number;
  completedTripsCount: number;
  minimumBalance: number;
  ledgerDrift: number;
  isLedgerInSync: boolean;
  transactions: Transaction[];
}

const TYPE_FILTERS: { key: TransactionFilter; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "SETTLEMENT", label: "Earnings" },
  { key: "DEPOSIT", label: "Deposits" },
  { key: "WITHDRAWAL", label: "Withdrawals" },
  { key: "REFUND", label: "Refunds" },
];

const TYPE_LABELS: Record<string, string> = {
  DEPOSIT: "Deposit",
  WITHDRAWAL: "Withdrawal",
  SETTLEMENT: "Trip Earnings",
  REFUND: "Refund",
  SERVICE_FEE_REFUND: "Fee Refund",
  COMMISSION: "Commission",
};

const TYPE_COLORS: Record<string, { bg: string; text: string }> = {
  DEPOSIT: {
    bg: "bg-green-100 dark:bg-green-900/30",
    text: "text-green-700 dark:text-green-300",
  },
  SETTLEMENT: {
    bg: "bg-blue-100 dark:bg-blue-900/30",
    text: "text-blue-700 dark:text-blue-300",
  },
  WITHDRAWAL: {
    bg: "bg-orange-100 dark:bg-orange-900/30",
    text: "text-orange-700 dark:text-orange-300",
  },
  REFUND: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
  },
  SERVICE_FEE_REFUND: {
    bg: "bg-purple-100 dark:bg-purple-900/30",
    text: "text-purple-700 dark:text-purple-300",
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

export default function CarrierWalletClient({
  walletData,
}: {
  walletData: WalletData;
}) {
  const [filterType, setFilterType] = useState<TransactionFilter>("ALL");
  const [page, setPage] = useState(1);
  const [transactions, setTransactions] = useState<Transaction[]>(
    walletData.transactions
  );
  const [hasMore, setHasMore] = useState(walletData.transactions.length >= 50);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showDepositInfo, setShowDepositInfo] = useState(false);
  // Blueprint §8 self-service deposit form (mirror of shipper eb68304)
  const [depositAmount, setDepositAmount] = useState("");
  const [depositMethod, setDepositMethod] = useState<
    "BANK_TRANSFER_SLIP" | "TELEBIRR" | "MPESA"
  >("BANK_TRANSFER_SLIP");
  const [depositSlipUrl, setDepositSlipUrl] = useState("");
  const [depositReference, setDepositReference] = useState("");
  const [depositNotes, setDepositNotes] = useState("");
  const [depositSubmitting, setDepositSubmitting] = useState(false);
  const [depositError, setDepositError] = useState<string | null>(null);
  const [depositSuccess, setDepositSuccess] = useState<string | null>(null);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawBankName, setWithdrawBankName] = useState("");
  const [withdrawAccount, setWithdrawAccount] = useState("");
  const [withdrawHolder, setWithdrawHolder] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState<string | null>(null);
  const [withdrawSuccess, setWithdrawSuccess] = useState<string | null>(null);
  const pageSize = 10;

  const loadMoreTransactions = useCallback(async () => {
    setLoadingMore(true);
    setLoadError(null);
    try {
      const response = await fetch(
        `/api/wallet/transactions?offset=${transactions.length}&limit=50`
      );
      if (response.ok) {
        const data = await response.json();
        if (data.transactions && data.transactions.length > 0) {
          // Transform API response to match local format
          const newTransactions = data.transactions.map(
            (tx: ApiTransaction) => ({
              id: tx.id,
              date: tx.createdAt,
              type: tx.type,
              description: tx.description,
              reference: tx.reference,
              amount: Math.abs(tx.amount),
              isDebit: tx.amount < 0,
              loadId: tx.loadId,
              loadRoute: null,
            })
          );
          setTransactions((prev) => [...prev, ...newTransactions]);
          setHasMore(data.pagination?.hasMore ?? false);
        } else {
          setHasMore(false);
        }
      } else {
        setLoadError("Failed to load transactions");
      }
    } catch (error) {
      console.error("Failed to load more transactions:", error);
      setLoadError("Failed to load transactions. Please try again.");
    } finally {
      setLoadingMore(false);
    }
  }, [transactions.length]);

  // Blueprint §8: submit a self-service deposit request.
  // Admin approves via /api/admin/wallet-deposits/[id]; balance only changes on approve.
  const handleSubmitDeposit = async () => {
    setDepositError(null);
    setDepositSuccess(null);
    const amount = parseFloat(depositAmount);
    if (isNaN(amount) || amount <= 0) {
      setDepositError("Please enter a valid amount");
      return;
    }
    if (depositMethod === "BANK_TRANSFER_SLIP" && !depositSlipUrl.trim()) {
      setDepositError(
        "Bank transfer requires a slip file URL (upload your slip and paste the link)"
      );
      return;
    }
    if (
      (depositMethod === "TELEBIRR" || depositMethod === "MPESA") &&
      !depositReference.trim()
    ) {
      setDepositError(
        "Telebirr/M-Pesa deposits require a transaction reference"
      );
      return;
    }

    setDepositSubmitting(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/wallet/deposit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          amount,
          paymentMethod: depositMethod,
          slipFileUrl:
            depositMethod === "BANK_TRANSFER_SLIP" ? depositSlipUrl : undefined,
          externalReference:
            depositMethod !== "BANK_TRANSFER_SLIP"
              ? depositReference
              : undefined,
          notes: depositNotes || undefined,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to submit deposit request");
      }
      setDepositSuccess(
        "Deposit request submitted. Admin will review and approve within 1-2 business days."
      );
      setDepositAmount("");
      setDepositSlipUrl("");
      setDepositReference("");
      setDepositNotes("");
    } catch (err) {
      setDepositError(
        err instanceof Error ? err.message : "Failed to submit deposit request"
      );
    } finally {
      setDepositSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    const amount = parseFloat(withdrawAmount);
    if (isNaN(amount) || amount <= 0) {
      setWithdrawError("Please enter a valid amount");
      return;
    }
    if (!withdrawBankName.trim()) {
      setWithdrawError("Bank name is required");
      return;
    }
    if (!withdrawAccount.trim()) {
      setWithdrawError("Account number is required");
      return;
    }
    if (!withdrawHolder.trim()) {
      setWithdrawError("Account holder name is required");
      return;
    }

    setWithdrawing(true);
    setWithdrawError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/financial/withdraw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          amount,
          bankName: withdrawBankName,
          bankAccount: withdrawAccount,
          accountHolder: withdrawHolder,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to submit withdrawal request");
      }

      setWithdrawSuccess(
        "Withdrawal request submitted. Admin will process within 1-2 business days."
      );
      setWithdrawAmount("");
      setWithdrawBankName("");
      setWithdrawAccount("");
      setWithdrawHolder("");
    } catch (err: unknown) {
      setWithdrawError(
        err instanceof Error ? err.message : "An error occurred"
      );
    } finally {
      setWithdrawing(false);
    }
  };

  const filteredTransactions = transactions.filter((t) => {
    if (filterType === "ALL") return true;
    if (filterType === "REFUND")
      return t.type === "REFUND" || t.type === "SERVICE_FEE_REFUND";
    return t.type === filterType;
  });

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
          Manage your earnings and withdrawals
        </p>
      </div>

      {/* Balance Card */}
      <div className="mb-8 rounded-2xl bg-gradient-to-br from-teal-600 to-teal-700 p-8 text-white shadow-lg">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div>
            <p className="mb-1 text-sm font-medium text-white/80">
              Current Balance
            </p>
            <p
              data-testid="wallet-current-balance"
              className="text-4xl font-bold"
            >
              {formatCurrency(walletData.balance, walletData.currency)}
            </p>
            {walletData.minimumBalance > 0 && (
              <p className="mt-1 text-sm text-white/70">
                Minimum Balance:{" "}
                {formatCurrency(walletData.minimumBalance, walletData.currency)}
              </p>
            )}
          </div>
          <div>
            <p className="mb-1 text-sm font-medium text-white/80">
              Pending Trips
            </p>
            <p className="text-4xl font-bold">{walletData.pendingTripsCount}</p>
            {walletData.pendingTripsCount > 0 && (
              <p className="mt-1 text-sm text-white/70">
                Earnings pending upon delivery
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 border-t border-white/20 pt-6">
          <button
            onClick={() => setShowDepositInfo(true)}
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
          <button
            onClick={() => {
              setShowWithdrawModal(true);
              setWithdrawError(null);
              setWithdrawSuccess(null);
            }}
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
                d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            Withdraw
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
            Transaction History
          </a>
        </div>
      </div>

      {/* Minimum Balance Warning */}
      {walletData.minimumBalance > 0 &&
        walletData.balance < walletData.minimumBalance && (
          <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              Your balance is below the minimum required for marketplace access
              ({formatCurrency(walletData.minimumBalance, walletData.currency)}
              ). Please top up to resume activity.
            </p>
          </div>
        )}

      {/* Ledger Integrity Warning (only shown if drift detected) */}
      {!walletData.isLedgerInSync && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-900/20">
          <div className="flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                Wallet ledger drift detected
              </p>
              <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                Stored balance differs from journal sum by{" "}
                {formatCurrency(
                  Math.abs(walletData.ledgerDrift),
                  walletData.currency
                )}
                . Please contact support — your transactions will reconcile.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Financial Summary Cards */}
      <div className="mb-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Total Deposited */}
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
              {walletData.totalRefunded > 0 && (
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  +{" "}
                  {formatCurrency(
                    walletData.totalRefunded,
                    walletData.currency
                  )}{" "}
                  refunded
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Service Fees Paid */}
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
                Service Fees Paid
              </p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(
                  walletData.serviceFeesPaid,
                  walletData.currency
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Total Withdrawn */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100 dark:bg-orange-900/30">
              <svg
                className="h-5 w-5 text-orange-600 dark:text-orange-400"
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
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Total Withdrawn
              </p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {formatCurrency(walletData.totalWithdrawn, walletData.currency)}
              </p>
            </div>
          </div>
        </div>

        {/* Completed Trips */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <svg
                className="h-5 w-5 text-blue-600 dark:text-blue-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Completed Trips
              </p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">
                {walletData.completedTripsCount}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div
        id="transactions"
        className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
      >
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Transaction History
            </h2>
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
                                href={`/carrier/loads/${transaction.loadId}`}
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
                        className={`font-semibold ${transaction.isDebit ? "text-red-600 dark:text-red-400" : "text-green-600 dark:text-green-400"}`}
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

        {/* Hidden total count + full JSON for stable test reads */}
        <div
          data-testid="wallet-transaction-count"
          style={{ position: "absolute", left: "-9999px" }}
        >
          {filteredTransactions.length}
        </div>
        <div
          data-testid="wallet-transactions-json"
          style={{ position: "absolute", left: "-9999px" }}
        >
          {/* Sprint: data-consistency audit — emit SIGNED amount only */}
          {JSON.stringify(
            filteredTransactions.map((t) => ({
              id: t.id,
              type: t.type,
              amount: t.isDebit ? -Math.abs(t.amount) : Math.abs(t.amount),
            }))
          )}
        </div>

        {(totalPages > 1 || hasMore) && (
          <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-700">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Showing {(page - 1) * pageSize + 1}-
                {Math.min(page * pageSize, filteredTransactions.length)} of{" "}
                {filteredTransactions.length}
                {hasMore && " (more available)"}
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
            {loadError && (
              <div className="mb-2 text-center text-sm text-red-600 dark:text-red-400">
                {loadError}
              </div>
            )}
            {hasMore && (
              <div className="text-center">
                <button
                  onClick={loadMoreTransactions}
                  disabled={loadingMore}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loadingMore ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="h-4 w-4 animate-spin"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        />
                      </svg>
                      Loading...
                    </span>
                  ) : (
                    "Load More Transactions"
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Deposit Request Modal — Blueprint §8 self-service deposit form */}
      {showDepositInfo && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
            <h2 className="mb-1 text-lg font-semibold text-gray-900 dark:text-white">
              Deposit Funds
            </h2>
            <p className="mb-4 text-xs text-gray-500 dark:text-slate-400">
              Submit a deposit request. Admin verifies and credits your wallet
              within 1–2 business days.
            </p>

            {depositSuccess ? (
              <div className="space-y-4">
                <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                  {depositSuccess}
                </div>
                <button
                  onClick={() => {
                    setShowDepositInfo(false);
                    setDepositSuccess(null);
                  }}
                  className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                >
                  Close
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {depositError && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {depositError}
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                    Amount (ETB) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="1000000"
                    step="1"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    placeholder="e.g. 5000"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                    Payment Method <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={depositMethod}
                    onChange={(e) =>
                      setDepositMethod(
                        e.target.value as
                          | "BANK_TRANSFER_SLIP"
                          | "TELEBIRR"
                          | "MPESA"
                      )
                    }
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  >
                    <option value="BANK_TRANSFER_SLIP">
                      Bank Transfer Slip
                    </option>
                    <option value="TELEBIRR">Telebirr</option>
                    <option value="MPESA">M-Pesa</option>
                  </select>
                </div>

                {depositMethod === "BANK_TRANSFER_SLIP" ? (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                      Slip File URL <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="url"
                      value={depositSlipUrl}
                      onChange={(e) => setDepositSlipUrl(e.target.value)}
                      placeholder="https://… link to your transfer slip"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                    <p className="mt-1 text-[11px] text-gray-500 dark:text-slate-400">
                      Upload the bank slip image to a file host and paste the
                      link here. Admin reviews the slip before approving.
                    </p>
                  </div>
                ) : (
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                      Transaction Reference{" "}
                      <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={depositReference}
                      onChange={(e) => setDepositReference(e.target.value)}
                      placeholder="e.g. CT123456789"
                      maxLength={200}
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                )}

                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-700 dark:text-slate-300">
                    Notes (optional)
                  </label>
                  <textarea
                    value={depositNotes}
                    onChange={(e) => setDepositNotes(e.target.value)}
                    rows={2}
                    maxLength={500}
                    placeholder="Anything Admin should know about this deposit"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => {
                      setShowDepositInfo(false);
                      setDepositError(null);
                    }}
                    disabled={depositSubmitting}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitDeposit}
                    disabled={depositSubmitting}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {depositSubmitting ? "Submitting…" : "Submit Request"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Withdraw Modal */}
      {showWithdrawModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Withdraw Funds
            </h2>

            {withdrawSuccess ? (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-700 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300">
                  {withdrawSuccess}
                </div>
                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowWithdrawModal(false);
                      setWithdrawSuccess(null);
                    }}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
                  >
                    Close
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Amount (ETB) *
                    </label>
                    <input
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="Enter amount"
                      min="0.01"
                      step="0.01"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Bank Name *
                    </label>
                    <input
                      type="text"
                      value={withdrawBankName}
                      onChange={(e) => setWithdrawBankName(e.target.value)}
                      placeholder="e.g., Commercial Bank of Ethiopia"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Account Number *
                    </label>
                    <input
                      type="text"
                      value={withdrawAccount}
                      onChange={(e) => setWithdrawAccount(e.target.value)}
                      placeholder="Bank account number"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-slate-300">
                      Account Holder Name *
                    </label>
                    <input
                      type="text"
                      value={withdrawHolder}
                      onChange={(e) => setWithdrawHolder(e.target.value)}
                      placeholder="Name on the bank account"
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                    />
                  </div>
                </div>

                {withdrawError && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                    {withdrawError}
                  </div>
                )}

                <div className="mt-6 flex gap-3">
                  <button
                    onClick={() => {
                      setShowWithdrawModal(false);
                      setWithdrawError(null);
                    }}
                    className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleWithdraw}
                    disabled={withdrawing || !withdrawAmount}
                    className="flex-1 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                  >
                    {withdrawing ? "Submitting..." : "Submit Withdrawal"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

interface WalletData {
  balance: number;
  accountType: string;
  transactions: Transaction[];
}

interface Transaction {
  id: string;
  transactionType: string;
  amount: number;
  createdAt: string;
  description?: string;
}

export default function WalletPage() {
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDepositForm, setShowDepositForm] = useState(false);
  const [showWithdrawForm, setShowWithdrawForm] = useState(false);

  useEffect(() => {
    fetchWallet();
  }, []);

  const fetchWallet = async () => {
    try {
      const response = await fetch("/api/financial/wallet");
      if (response.ok) {
        const data = await response.json();
        setWallet(data);
      }
    } catch (error) {
      console.error("Failed to fetch wallet:", error);
    } finally {
      setLoading(false);
    }
  };

  const formatTransactionType = (type: string) => {
    const types: Record<string, string> = {
      DEPOSIT: "Deposit",
      WITHDRAWAL: "Withdrawal",
      ESCROW_HOLD: "Escrow Hold",
      ESCROW_RELEASE: "Escrow Release",
      COMMISSION: "Commission",
      SETTLEMENT: "Settlement",
    };
    return types[type] || type;
  };

  const getTransactionIcon = (type: string) => {
    if (type === "DEPOSIT" || type === "ESCROW_RELEASE" || type === "SETTLEMENT") {
      return "↓";
    }
    return "↑";
  };

  const getTransactionColor = (type: string) => {
    if (type === "DEPOSIT" || type === "ESCROW_RELEASE" || type === "SETTLEMENT") {
      return "text-green-600";
    }
    return "text-red-600";
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!wallet) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500 mb-4">No wallet found</p>
        <p className="text-sm text-gray-400">
          Please contact support to set up your wallet
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Wallet</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage your account balance and transactions
        </p>
      </div>

      {/* Balance Card */}
      <div className="mb-8 rounded-lg bg-gradient-to-r from-blue-600 to-blue-700 p-8 shadow-lg">
        <div className="text-white">
          <p className="text-sm font-medium opacity-90">Available Balance</p>
          <p className="mt-2 text-5xl font-bold">
            ETB {wallet.balance.toLocaleString()}
          </p>
          <p className="mt-2 text-sm opacity-75">
            Account Type: {wallet.accountType.replace(/_/g, " ")}
          </p>
        </div>

        <div className="mt-6 flex space-x-4">
          <button
            onClick={() => setShowDepositForm(true)}
            className="rounded-md bg-white px-4 py-2 text-sm font-semibold text-blue-600 shadow-sm hover:bg-gray-50"
          >
            + Deposit Funds
          </button>
          {wallet.accountType.includes("CARRIER") && (
            <button
              onClick={() => setShowWithdrawForm(true)}
              className="rounded-md border-2 border-white px-4 py-2 text-sm font-semibold text-white hover:bg-white hover:text-blue-600"
            >
              Withdraw Funds
            </button>
          )}
        </div>
      </div>

      {/* Deposit Form Modal */}
      {showDepositForm && (
        <DepositModal
          onClose={() => setShowDepositForm(false)}
          onSuccess={() => {
            setShowDepositForm(false);
            fetchWallet();
          }}
        />
      )}

      {/* Withdraw Form Modal */}
      {showWithdrawForm && (
        <WithdrawModal
          onClose={() => setShowWithdrawForm(false)}
          onSuccess={() => {
            setShowWithdrawForm(false);
            fetchWallet();
          }}
          currentBalance={wallet.balance}
        />
      )}

      {/* Transaction History */}
      <div className="rounded-lg bg-white shadow">
        <div className="border-b border-gray-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Transaction History
          </h2>
        </div>
        <div className="px-6 py-4">
          {wallet.transactions.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">
              No transactions yet
            </p>
          ) : (
            <div className="space-y-4">
              {wallet.transactions.map((transaction) => (
                <div
                  key={transaction.id}
                  className="flex items-center justify-between border-b border-gray-100 pb-4 last:border-0"
                >
                  <div className="flex items-center space-x-4">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-lg ${getTransactionColor(
                        transaction.transactionType
                      )}`}
                    >
                      {getTransactionIcon(transaction.transactionType)}
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">
                        {formatTransactionType(transaction.transactionType)}
                      </p>
                      <p className="text-sm text-gray-500">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </p>
                      {transaction.description && (
                        <p className="text-xs text-gray-400 mt-1">
                          {transaction.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div
                    className={`text-lg font-semibold ${getTransactionColor(
                      transaction.transactionType
                    )}`}
                  >
                    {transaction.transactionType === "DEPOSIT" ||
                    transaction.transactionType === "ESCROW_RELEASE" ||
                    transaction.transactionType === "SETTLEMENT"
                      ? "+"
                      : "-"}
                    ETB {transaction.amount.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Deposit Modal
function DepositModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch("/api/financial/wallet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parseFloat(amount) }),
      });

      if (response.ok) {
        alert("Deposit successful!");
        onSuccess();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to deposit funds");
      }
    } catch (error) {
      console.error("Failed to deposit:", error);
      alert("Failed to deposit funds");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Deposit Funds
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Amount (ETB) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="1"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 10000"
              />
            </div>

            <div className="rounded-md bg-blue-50 p-4">
              <p className="text-sm text-blue-700">
                <strong>Note:</strong> For MVP, this is a simulated deposit.
                Payment integration (Chapa/Stripe) will be added in Phase 2.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? "Processing..." : "Deposit"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Withdraw Modal
function WithdrawModal({
  onClose,
  onSuccess,
  currentBalance,
}: {
  onClose: () => void;
  onSuccess: () => void;
  currentBalance: number;
}) {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const withdrawAmount = parseFloat(amount);
    if (withdrawAmount > currentBalance) {
      alert("Insufficient balance");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/financial/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: withdrawAmount }),
      });

      if (response.ok) {
        alert(
          "Withdrawal request submitted! It will be reviewed by admin for approval."
        );
        onSuccess();
      } else {
        const data = await response.json();
        alert(data.error || "Failed to request withdrawal");
      }
    } catch (error) {
      console.error("Failed to withdraw:", error);
      alert("Failed to request withdrawal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full p-6">
          <h2 className="mb-4 text-xl font-bold text-gray-900">
            Withdraw Funds
          </h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Amount (ETB) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                min="1"
                max={currentBalance}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-blue-500"
                placeholder="e.g., 5000"
              />
              <p className="mt-1 text-xs text-gray-500">
                Available: ETB {currentBalance.toLocaleString()}
              </p>
            </div>

            <div className="rounded-md bg-yellow-50 p-4">
              <p className="text-sm text-yellow-700">
                <strong>Note:</strong> Withdrawal requests require admin
                approval. You will be notified once your request is processed.
              </p>
            </div>

            <div className="flex items-center justify-end space-x-4 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500 disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Request Withdrawal"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

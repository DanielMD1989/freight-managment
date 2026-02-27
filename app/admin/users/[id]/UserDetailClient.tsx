"use client";

/**
 * User Detail Client Component
 *
 * Interactive user detail view with edit functionality and wallet management
 * Sprint 10 - Story 10.2: User Management
 */

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCSRFToken } from "@/lib/csrfFetch";

interface UserDetail {
  id: string;
  email: string;
  phone: string | null;
  firstName: string | null;
  lastName: string | null;
  role: string;
  status: string;
  isActive: boolean;
  isEmailVerified: boolean;
  isPhoneVerified: boolean;
  organizationId: string | null;
  organization: {
    id: string;
    name: string;
    type: string;
    isVerified: boolean;
  } | null;
  createdAt: string;
  updatedAt: string;
  lastLoginAt: string | null;
}

interface WalletData {
  id: string;
  balance: number;
  currency: string;
  accountType: string;
}

interface Transaction {
  id: string;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
}

const STATUS_OPTIONS = [
  { value: "REGISTERED", label: "Registered" },
  { value: "PENDING_VERIFICATION", label: "Pending Verification" },
  { value: "ACTIVE", label: "Active" },
  { value: "SUSPENDED", label: "Suspended" },
  { value: "REJECTED", label: "Rejected" },
];

function formatDate(dateString: string | null): string {
  if (!dateString) return "Never";
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getRoleBadgeColor(role: string): string {
  const colors: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-800",
    SUPER_ADMIN: "bg-red-100 text-red-800",
    SHIPPER: "bg-green-100 text-green-800",
    CARRIER: "bg-yellow-100 text-yellow-800",
    DISPATCHER: "bg-blue-100 text-blue-800",
    DRIVER: "bg-gray-100 text-gray-800",
  };
  return colors[role] || "bg-gray-100 text-gray-800";
}

function getStatusBadgeColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: "bg-green-100 text-green-800",
    PENDING_VERIFICATION: "bg-yellow-100 text-yellow-800",
    REGISTERED: "bg-blue-100 text-blue-800",
    SUSPENDED: "bg-red-100 text-red-800",
    REJECTED: "bg-gray-100 text-gray-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export default function UserDetailClient({
  user,
  currentUserRole,
}: {
  user: UserDetail;
  currentUserRole: string;
}) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Edit form state
  const [phone, setPhone] = useState(user.phone || "");
  const [status, setStatus] = useState(user.status);

  // Wallet state
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [walletLoading, setWalletLoading] = useState(true);
  // L41 FIX: Add wallet error state to surface API failures
  const [walletError, setWalletError] = useState<string | null>(null);
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [topUpAmount, setTopUpAmount] = useState("");
  const [topUpPaymentMethod, setTopUpPaymentMethod] = useState("BANK_TRANSFER");
  const [topUpReference, setTopUpReference] = useState("");
  const [topUpNote, setTopUpNote] = useState("");
  const [topUpLoading, setTopUpLoading] = useState(false);

  // Check if current user can edit this user
  const canEdit =
    currentUserRole === "SUPER_ADMIN" ||
    (currentUserRole === "ADMIN" &&
      !["ADMIN", "SUPER_ADMIN"].includes(user.role));

  // Check if user has a wallet (shippers and carriers have wallets)
  const hasWallet = ["SHIPPER", "CARRIER"].includes(user.role);

  /**
   * Fetch wallet data
   */

  const fetchWalletData = useCallback(async () => {
    try {
      setWalletError(null);
      // Fetch wallet and transactions for the user
      const response = await fetch(`/api/admin/users/${user.id}/wallet`);
      if (response.ok) {
        const data = await response.json();
        if (data.wallet) {
          setWallet(data.wallet);
          setTransactions(data.transactions || []);
        }
      } else {
        // L41 FIX: Set wallet error state instead of silently failing
        setWalletError("Failed to fetch wallet data");
      }
    } catch (err) {
      // L41 FIX: Set wallet error state instead of just logging
      setWalletError("Network error while fetching wallet");
      console.error("Failed to fetch wallet:", err);
    } finally {
      setWalletLoading(false);
    }
  }, [user.id]);

  useEffect(() => {
    if (hasWallet && user.organizationId) {
      fetchWalletData();
    } else {
      setWalletLoading(false);
    }
  }, [user.organizationId, hasWallet, fetchWalletData]);

  /**
   * Handle wallet top-up
   */
  const handleTopUp = async () => {
    if (!wallet || !topUpAmount) return;

    const amount = parseFloat(topUpAmount);
    if (isNaN(amount) || amount <= 0) {
      setError("Please enter a valid amount");
      return;
    }

    setTopUpLoading(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/admin/users/${user.id}/wallet/topup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          amount,
          paymentMethod: topUpPaymentMethod,
          reference: topUpReference || undefined,
          notes: topUpNote || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setSuccess(
          `Successfully added ${formatCurrency(amount)} to wallet. New balance: ${formatCurrency(data.newBalance)}`
        );
        setShowTopUpModal(false);
        setTopUpAmount("");
        setTopUpPaymentMethod("BANK_TRANSFER");
        setTopUpReference("");
        setTopUpNote("");
        fetchWalletData(); // Refresh wallet data
      } else {
        const data = await response.json();
        setError(data.error || "Failed to top up wallet");
      }
    } catch {
      setError("An error occurred while processing top-up");
    } finally {
      setTopUpLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: "ETB",
      minimumFractionDigits: 2,
    }).format(amount);
  };

  /**
   * Handle save
   */
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const csrfToken = await getCSRFToken();
      const updates: Record<string, string> = {};

      // Only include changed fields
      if (phone !== (user.phone || "")) {
        updates.phone = phone;
      }
      if (status !== user.status) {
        updates.status = status;
      }

      if (Object.keys(updates).length === 0) {
        setError("No changes to save");
        setSaving(false);
        return;
      }

      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify(updates),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess("User updated successfully");
        setIsEditing(false);
        router.refresh();
      } else {
        setError(data.error || "Failed to update user");
      }
    } catch {
      setError("An error occurred while saving");
    } finally {
      setSaving(false);
    }
  };

  /**
   * Handle cancel
   */
  const handleCancel = () => {
    setPhone(user.phone || "");
    setStatus(user.status);
    setIsEditing(false);
    setError(null);
  };

  // L41 FIX: Add delete loading state
  const [isDeleting, setIsDeleting] = useState(false);

  /**
   * Handle delete
   */
  const handleDelete = async () => {
    if (
      !confirm(
        `Are you sure you want to delete ${user.email}? This action cannot be undone.`
      )
    ) {
      return;
    }

    // L41 FIX: Set loading state during deletion
    setIsDeleting(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        headers: {
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
      });

      if (response.ok) {
        router.push("/admin/users");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to delete user");
      }
    } catch {
      setError("An error occurred while deleting");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}
      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="text-green-800">{success}</p>
        </div>
      )}

      {/* User Info Card */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">
              {user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`
                : user.email}
            </h2>
            <p className="text-gray-600">{user.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${getRoleBadgeColor(user.role)}`}
            >
              {user.role.replace(/_/g, " ")}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-sm font-semibold ${getStatusBadgeColor(user.status)}`}
            >
              {user.status.replace(/_/g, " ")}
            </span>
          </div>
        </div>

        {/* User Details Grid */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {/* Contact Information */}
          <div>
            <h3 className="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase">
              Contact Information
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-600">Email</dt>
                <dd className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  {user.email}
                  {user.isEmailVerified && (
                    <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">
                      Verified
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Phone</dt>
                <dd className="flex items-center gap-2 text-sm font-medium text-gray-900">
                  {isEditing ? (
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                      placeholder="Phone number"
                    />
                  ) : (
                    <>
                      {user.phone || "Not set"}
                      {user.isPhoneVerified && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-600">
                          Verified
                        </span>
                      )}
                    </>
                  )}
                </dd>
              </div>
            </dl>
          </div>

          {/* Account Status */}
          <div>
            <h3 className="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase">
              Account Status
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-600">Status</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {isEditing ? (
                    <select
                      value={status}
                      onChange={(e) => setStatus(e.target.value)}
                      className="rounded-lg border border-gray-300 px-3 py-1 focus:border-transparent focus:ring-2 focus:ring-blue-500"
                    >
                      {STATUS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusBadgeColor(user.status)}`}
                    >
                      {user.status.replace(/_/g, " ")}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Active</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {user.isActive ? "Yes" : "No"}
                </dd>
              </div>
            </dl>
          </div>

          {/* Organization */}
          <div>
            <h3 className="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase">
              Organization
            </h3>
            {user.organization ? (
              <dl className="space-y-3">
                <div>
                  <dt className="text-sm text-gray-600">Name</dt>
                  <dd className="flex items-center gap-2 text-sm font-medium text-gray-900">
                    {user.organization.name}
                    {user.organization.isVerified && (
                      <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs text-blue-600">
                        Verified
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-600">Type</dt>
                  <dd className="text-sm font-medium text-gray-900">
                    {user.organization.type.replace(/_/g, " ")}
                  </dd>
                </div>
                <div>
                  <a
                    href={`/admin/organizations/${user.organization.id}`}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    View Organization
                  </a>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-gray-500">No organization</p>
            )}
          </div>

          {/* Timestamps */}
          <div>
            <h3 className="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase">
              Activity
            </h3>
            <dl className="space-y-3">
              <div>
                <dt className="text-sm text-gray-600">Created</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDate(user.createdAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Last Updated</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDate(user.updatedAt)}
                </dd>
              </div>
              <div>
                <dt className="text-sm text-gray-600">Last Login</dt>
                <dd className="text-sm font-medium text-gray-900">
                  {formatDate(user.lastLoginAt)}
                </dd>
              </div>
            </dl>
          </div>
        </div>

        {/* Actions */}
        {canEdit && (
          <div className="mt-8 flex justify-between border-t border-gray-200 pt-6">
            <div>
              {!isEditing ? (
                <button
                  onClick={() => setIsEditing(true)}
                  className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Edit User
                </button>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                  >
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={isSaving}
                    className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-700 transition-colors hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleDelete}
              disabled={isDeleting}
              className="rounded-lg px-4 py-2 font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete User"}
            </button>
          </div>
        )}

        {!canEdit && (
          <div className="mt-8 border-t border-gray-200 pt-6">
            <p className="text-sm text-gray-500">
              You do not have permission to edit this user.
            </p>
          </div>
        )}
      </div>

      {/* Wallet Section */}
      {hasWallet && (
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-6 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900">Wallet</h3>
            {canEdit && wallet && (
              <button
                onClick={() => setShowTopUpModal(true)}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-green-700"
              >
                Top Up
              </button>
            )}
          </div>

          {walletLoading ? (
            <div className="py-4 text-center text-gray-500">
              Loading wallet...
            </div>
          ) : walletError ? (
            /* L41 FIX: Show wallet error state */
            <div className="rounded-lg border border-red-200 bg-red-50 p-4">
              <p className="text-red-700">{walletError}</p>
              <button
                onClick={fetchWalletData}
                className="mt-2 text-sm font-medium text-red-600 hover:text-red-800"
              >
                Retry
              </button>
            </div>
          ) : wallet ? (
            <div className="space-y-6">
              {/* Balance Card */}
              <div className="rounded-xl bg-gradient-to-r from-green-500 to-green-600 p-6 text-white">
                <p className="text-sm opacity-80">Current Balance</p>
                <p className="mt-1 text-3xl font-bold">
                  {formatCurrency(wallet.balance)}
                </p>
                <p className="mt-2 text-sm opacity-80">
                  {wallet.accountType.replace(/_/g, " ")} Account
                </p>
              </div>

              {/* Recent Transactions */}
              <div>
                <h4 className="mb-3 text-sm font-medium tracking-wider text-gray-500 uppercase">
                  Recent Transactions
                </h4>
                {transactions.length > 0 ? (
                  <div className="space-y-2">
                    {transactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="flex items-center justify-between border-b border-gray-100 py-2 last:border-0"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            {tx.description || tx.type.replace(/_/g, " ")}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(tx.createdAt)}
                          </p>
                        </div>
                        <span
                          className={`text-sm font-semibold ${
                            tx.amount >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {tx.amount >= 0 ? "+" : ""}
                          {formatCurrency(tx.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500">No transactions yet</p>
                )}
              </div>
            </div>
          ) : (
            <div className="py-4 text-center text-gray-500">
              No wallet found for this user&apos;s organization
            </div>
          )}
        </div>
      )}

      {/* Top Up Modal */}
      {showTopUpModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Manual Top-Up
            </h3>
            <p className="mb-4 text-sm text-gray-600">
              Add funds to {user.firstName || user.email}&apos;s wallet
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Amount (ETB) *
                </label>
                <input
                  type="number"
                  value={topUpAmount}
                  onChange={(e) => setTopUpAmount(e.target.value)}
                  placeholder="Enter amount"
                  min="0"
                  step="0.01"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Payment Method *
                </label>
                <select
                  value={topUpPaymentMethod}
                  onChange={(e) => setTopUpPaymentMethod(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-green-500"
                >
                  <option value="BANK_TRANSFER">Bank Transfer</option>
                  <option value="CASH">Cash</option>
                  <option value="TELEBIRR">TeleBirr</option>
                  <option value="CBE_BIRR">CBE Birr</option>
                  <option value="MOBILE_MONEY">Other Mobile Money</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Reference Number
                </label>
                <input
                  type="text"
                  value={topUpReference}
                  onChange={(e) => setTopUpReference(e.target.value)}
                  placeholder="Bank slip #, receipt #, etc."
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  Notes (optional)
                </label>
                <textarea
                  value={topUpNote}
                  onChange={(e) => setTopUpNote(e.target.value)}
                  placeholder="Additional notes..."
                  rows={2}
                  className="w-full resize-none rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowTopUpModal(false);
                  setTopUpAmount("");
                  setTopUpPaymentMethod("BANK_TRANSFER");
                  setTopUpReference("");
                  setTopUpNote("");
                }}
                disabled={topUpLoading}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleTopUp}
                disabled={topUpLoading || !topUpAmount}
                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {topUpLoading ? "Processing..." : "Process Top-Up"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Back Link */}
      <div>
        <Link
          href="/admin/users"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          ← Back to Users
        </Link>
      </div>
    </div>
  );
}

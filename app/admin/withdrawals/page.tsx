"use client";

/**
 * Admin Withdrawal Requests Management
 *
 * Lists all withdrawal requests and allows admin to approve/reject.
 */

import { useState, useEffect, useCallback } from "react";

interface WithdrawalRequest {
  id: string;
  amount: string;
  currency: string;
  status: string;
  bankAccount: string;
  bankName: string;
  accountHolder: string;
  requestedById: string;
  rejectionReason?: string;
  createdAt: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  APPROVED: "bg-green-100 text-green-800",
  REJECTED: "bg-red-100 text-red-800",
  COMPLETED: "bg-blue-100 text-blue-800",
};

async function fetchCsrfToken(): Promise<string> {
  const res = await fetch("/api/csrf-token");
  const data = await res.json();
  return data.csrfToken;
}

export default function AdminWithdrawalsPage() {
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState("");
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState<{ id: string } | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const loadWithdrawals = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filterStatus) params.set("status", filterStatus);
      const res = await fetch(`/api/admin/withdrawals?${params}`);
      if (!res.ok) throw new Error("Failed to fetch withdrawals");
      const data = await res.json();
      setWithdrawals(data.withdrawals || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    loadWithdrawals();
  }, [loadWithdrawals]);

  const handleAction = async (
    id: string,
    action: "APPROVED" | "REJECTED",
    reason?: string
  ) => {
    setActionLoading(id);
    try {
      const csrfToken = await fetchCsrfToken();
      const res = await fetch(`/api/admin/withdrawals/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ action, rejectionReason: reason }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Action failed");
      }
      setRejectModal(null);
      setRejectReason("");
      await loadWithdrawals();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount: string, currency: string) =>
    `${parseFloat(amount).toLocaleString()} ${currency}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Withdrawal Requests
        </h1>
        <p className="mt-1 text-gray-600">
          Review and approve withdrawal requests
        </p>
      </div>

      {error && (
        <div className="flex justify-between rounded-lg border border-red-200 bg-red-50 p-4">
          <span className="text-sm text-red-800">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-sm text-red-600"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex gap-2">
          {["", "PENDING", "APPROVED", "REJECTED"].map((s) => (
            <button
              key={s}
              onClick={() => {
                setFilterStatus(s);
                setLoading(true);
              }}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                filterStatus === s
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-gray-500">Loading...</div>
        ) : withdrawals.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            No withdrawal requests found
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Account Holder
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Bank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {withdrawals.map((w) => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(w.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {w.accountHolder}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {w.bankName}
                    <div className="text-xs text-gray-400">{w.bankAccount}</div>
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {formatCurrency(w.amount, w.currency)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_STYLES[w.status] || "bg-gray-100 text-gray-800"}`}
                    >
                      {w.status}
                    </span>
                    {w.rejectionReason && (
                      <div className="mt-1 text-xs text-red-600">
                        {w.rejectionReason}
                      </div>
                    )}
                  </td>
                  <td className="space-x-2 px-6 py-4 text-right">
                    {w.status === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleAction(w.id, "APPROVED")}
                          disabled={actionLoading === w.id}
                          className="rounded bg-green-600 px-3 py-1 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => setRejectModal({ id: w.id })}
                          disabled={actionLoading === w.id}
                          className="rounded bg-red-600 px-3 py-1 text-sm text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-gray-900">
              Reject Withdrawal
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (optional)"
              className="mb-4 w-full rounded-lg border border-gray-300 p-3"
              rows={3}
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setRejectModal(null);
                  setRejectReason("");
                }}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm text-gray-700 hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  handleAction(rejectModal.id, "REJECTED", rejectReason)
                }
                disabled={actionLoading === rejectModal.id}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm text-white hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

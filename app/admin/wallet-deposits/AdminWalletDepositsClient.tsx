"use client";

/**
 * Admin Wallet Deposits Client
 *
 * Lists pending self-service deposit requests and lets Admin approve/reject.
 * Blueprint §8 + §9 — bank-slip review workflow.
 */

import React, { useEffect, useState, useCallback } from "react";
import { getCSRFToken } from "@/lib/csrfFetch";

type DepositStatus = "PENDING" | "CONFIRMED" | "REJECTED";

interface OrgRef {
  id: string;
  name: string;
}

interface UserRef {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

interface Deposit {
  id: string;
  amount: number | string;
  currency: string;
  paymentMethod: "BANK_TRANSFER_SLIP" | "TELEBIRR" | "MPESA";
  status: DepositStatus;
  slipFileUrl: string | null;
  externalReference: string | null;
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
  financialAccount: {
    accountType: string;
    organization: OrgRef | null;
  };
  requestedBy: UserRef | null;
  approvedBy: UserRef | null;
}

interface DepositsResponse {
  deposits: Deposit[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  pendingCount: number;
}

const STATUS_TABS: { key: DepositStatus | "ALL"; label: string }[] = [
  { key: "PENDING", label: "Pending" },
  { key: "CONFIRMED", label: "Approved" },
  { key: "REJECTED", label: "Rejected" },
  { key: "ALL", label: "All" },
];

function formatAmount(amount: number | string, currency: string): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  return `${n.toLocaleString()} ${currency}`;
}

function formatDate(d: string | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString();
}

function userName(u: UserRef | null): string {
  if (!u) return "—";
  const name = [u.firstName, u.lastName].filter(Boolean).join(" ");
  return name || u.email;
}

function methodLabel(m: Deposit["paymentMethod"]): string {
  switch (m) {
    case "BANK_TRANSFER_SLIP":
      return "Bank Slip";
    case "TELEBIRR":
      return "Telebirr";
    case "MPESA":
      return "M-Pesa";
  }
}

export default function AdminWalletDepositsClient() {
  const [statusFilter, setStatusFilter] = useState<DepositStatus | "ALL">(
    "PENDING"
  );
  const [data, setData] = useState<DepositsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = statusFilter === "ALL" ? "" : `?status=${statusFilter}`;
      const res = await fetch(`/api/admin/wallet-deposits${qs}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to load deposits");
      }
      const json: DepositsResponse = await res.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load deposits");
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchDeposits();
  }, [fetchDeposits]);

  async function approveDeposit(id: string) {
    setActionId(id);
    setActionError(null);
    try {
      const csrfToken = await getCSRFToken();
      const res = await fetch(`/api/admin/wallet-deposits/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to approve deposit");
      }
      await fetchDeposits();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to approve deposit"
      );
    } finally {
      setActionId(null);
    }
  }

  async function submitReject(id: string) {
    if (!rejectReason.trim() || rejectReason.trim().length < 1) {
      setActionError("Rejection reason is required");
      return;
    }
    setActionId(id);
    setActionError(null);
    try {
      const csrfToken = await getCSRFToken();
      const res = await fetch(`/api/admin/wallet-deposits/${id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          action: "reject",
          rejectionReason: rejectReason.trim(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to reject deposit");
      }
      setRejectingId(null);
      setRejectReason("");
      await fetchDeposits();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Failed to reject deposit"
      );
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="space-y-4">
      {/* Status filter tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-700">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
              statusFilter === tab.key
                ? "border-emerald-500 text-emerald-600 dark:text-emerald-400"
                : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            }`}
          >
            {tab.label}
            {tab.key === "PENDING" && data?.pendingCount ? (
              <span className="ml-2 inline-flex items-center justify-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300">
                {data.pendingCount}
              </span>
            ) : null}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
          {error}
        </div>
      )}

      {actionError && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
          Loading deposits…
        </div>
      ) : !data || data.deposits.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No {statusFilter === "ALL" ? "" : statusFilter.toLowerCase()} deposit
          requests
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase dark:text-slate-300">
                  Requested
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase dark:text-slate-300">
                  Organization
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase dark:text-slate-300">
                  Requested by
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase dark:text-slate-300">
                  Amount
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase dark:text-slate-300">
                  Method
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase dark:text-slate-300">
                  Proof
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase dark:text-slate-300">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase dark:text-slate-300">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-700 dark:bg-slate-900">
              {data.deposits.map((d) => {
                const isPending = d.status === "PENDING";
                const isActing = actionId === d.id;
                const isRejecting = rejectingId === d.id;
                return (
                  <React.Fragment key={d.id}>
                    <tr>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {formatDate(d.createdAt)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {d.financialAccount.organization?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        <div>{userName(d.requestedBy)}</div>
                        {d.requestedBy?.email && (
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {d.requestedBy.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 dark:text-white">
                        {formatAmount(d.amount, d.currency)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {methodLabel(d.paymentMethod)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {d.slipFileUrl ? (
                          <a
                            href={d.slipFileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 underline hover:text-emerald-700 dark:text-emerald-400"
                          >
                            View slip
                          </a>
                        ) : d.externalReference ? (
                          <code className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-200">
                            {d.externalReference}
                          </code>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            d.status === "PENDING"
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                              : d.status === "CONFIRMED"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                                : "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300"
                          }`}
                        >
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-sm">
                        {isPending && !isRejecting ? (
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => approveDeposit(d.id)}
                              disabled={isActing}
                              className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {isActing ? "…" : "Approve"}
                            </button>
                            <button
                              onClick={() => {
                                setRejectingId(d.id);
                                setRejectReason("");
                                setActionError(null);
                              }}
                              disabled={isActing}
                              className="rounded-md border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-700 dark:text-red-300 dark:hover:bg-red-900/20"
                            >
                              Reject
                            </button>
                          </div>
                        ) : null}
                        {!isPending &&
                          d.status === "REJECTED" &&
                          d.rejectionReason && (
                            <div className="text-xs text-red-600 dark:text-red-400">
                              {d.rejectionReason}
                            </div>
                          )}
                      </td>
                    </tr>
                    {isRejecting && (
                      <tr className="bg-red-50/50 dark:bg-red-900/10">
                        <td colSpan={8} className="px-4 py-3">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <input
                              type="text"
                              placeholder="Rejection reason (required)"
                              value={rejectReason}
                              onChange={(e) => setRejectReason(e.target.value)}
                              maxLength={500}
                              className="flex-1 rounded-md border border-red-300 px-3 py-1.5 text-sm dark:border-red-700 dark:bg-slate-800 dark:text-white"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => submitReject(d.id)}
                                disabled={isActing || !rejectReason.trim()}
                                className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
                              >
                                {isActing ? "Rejecting…" : "Confirm Reject"}
                              </button>
                              <button
                                onClick={() => {
                                  setRejectingId(null);
                                  setRejectReason("");
                                  setActionError(null);
                                }}
                                disabled={isActing}
                                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                          {d.notes && (
                            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                              Requester notes: {d.notes}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>

          {data.pagination.totalCount > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
              {data.deposits.length} of {data.pagination.totalCount} deposit
              {data.pagination.totalCount === 1 ? "" : "s"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

interface DriverProfile {
  cdlNumber: string | null;
  cdlExpiry: string | null;
  medicalCertExp: string | null;
  isAvailable: boolean;
  createdAt: string;
}

interface Driver {
  id: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  email: string;
  status: string;
  createdAt: string;
  driverProfile: DriverProfile | null;
  activeTrips: number;
}

const STATUS_BADGES: Record<string, { label: string; className: string }> = {
  INVITED: {
    label: "Invited",
    className: "bg-gray-100 text-gray-700",
  },
  PENDING_VERIFICATION: {
    label: "Pending Approval",
    className: "bg-yellow-100 text-yellow-700",
  },
  ACTIVE: {
    label: "Active",
    className: "bg-green-100 text-green-700",
  },
  SUSPENDED: {
    label: "Suspended",
    className: "bg-red-100 text-red-700",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-red-100 text-red-600",
  },
};

const TABS = [
  { key: "all", label: "All" },
  { key: "ACTIVE", label: "Active" },
  { key: "PENDING_VERIFICATION", label: "Pending" },
  { key: "SUSPENDED", label: "Suspended" },
] as const;

export default function DriverManagementClient({
  initialDrivers,
  initialTotal,
}: {
  initialDrivers: Driver[];
  initialTotal: number;
}) {
  const [drivers, setDrivers] = useState<Driver[]>(initialDrivers);
  const [total, setTotal] = useState(initialTotal);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [loading, setLoading] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function fetchDrivers(status?: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50" });
      if (status && status !== "all") params.set("status", status);

      const res = await fetch(`/api/drivers?${params}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load drivers");
      const data = await res.json();
      setDrivers(data.drivers ?? []);
      setTotal(data.total ?? 0);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  }

  function handleTabChange(tab: string) {
    setActiveTab(tab);
    fetchDrivers(tab);
  }

  async function handleApprove(driverId: string) {
    try {
      const csrf = await fetch("/api/csrf-token", {
        credentials: "include",
      }).then((r) => r.json());
      // /api/csrf-token returns { csrfToken, ... }; fall back to .token for forward-compat.
      const csrfToken = csrf.csrfToken ?? csrf.token;

      const res = await fetch(`/api/drivers/${driverId}/approve`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to approve");
      }
      fetchDrivers(activeTab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Approve failed");
    }
  }

  async function handleReject(driverId: string) {
    if (!rejectReason.trim()) {
      setError("Rejection reason is required");
      return;
    }
    try {
      const csrf = await fetch("/api/csrf-token", {
        credentials: "include",
      }).then((r) => r.json());
      const csrfToken = csrf.csrfToken ?? csrf.token;

      const res = await fetch(`/api/drivers/${driverId}/reject`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken,
        },
        body: JSON.stringify({ reason: rejectReason }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to reject");
      }
      setRejectingId(null);
      setRejectReason("");
      fetchDrivers(activeTab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Reject failed");
    }
  }

  async function handleSuspend(driverId: string) {
    if (!confirm("Are you sure you want to suspend this driver?")) return;
    try {
      const csrf = await fetch("/api/csrf-token", {
        credentials: "include",
      }).then((r) => r.json());
      const csrfToken = csrf.csrfToken ?? csrf.token;

      const res = await fetch(`/api/drivers/${driverId}`, {
        method: "DELETE",
        credentials: "include",
        headers: { "X-CSRF-Token": csrfToken },
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to suspend");
      }
      fetchDrivers(activeTab);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Suspend failed");
    }
  }

  const stats = {
    total: initialTotal,
    active: initialDrivers.filter((d) => d.status === "ACTIVE").length,
    available: initialDrivers.filter(
      (d) => d.status === "ACTIVE" && d.driverProfile?.isAvailable
    ).length,
    pending: initialDrivers.filter((d) => d.status === "PENDING_VERIFICATION")
      .length,
  };

  return (
    <div className="space-y-6">
      {/* Actions bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-sm">
          <span className="rounded-lg bg-white px-3 py-1.5 font-medium text-slate-600 shadow-sm">
            Total: {stats.total}
          </span>
          <span className="rounded-lg bg-green-50 px-3 py-1.5 font-medium text-green-700 shadow-sm">
            Active: {stats.active}
          </span>
          <span className="rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-700 shadow-sm">
            Available: {stats.available}
          </span>
          {stats.pending > 0 && (
            <span className="rounded-lg bg-yellow-50 px-3 py-1.5 font-medium text-yellow-700 shadow-sm">
              Pending: {stats.pending}
            </span>
          )}
        </div>
        <Link
          href="/carrier/drivers/invite"
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700"
        >
          Invite Driver
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-white p-1 shadow-sm">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "bg-indigo-600 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading...</div>
        ) : drivers.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            No drivers found.{" "}
            <Link
              href="/carrier/drivers/invite"
              className="text-indigo-600 underline"
            >
              Invite your first driver
            </Link>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Available</th>
                <th className="px-4 py-3">Active Trips</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {drivers.map((d) => {
                const badge = STATUS_BADGES[d.status] ?? {
                  label: d.status,
                  className: "bg-gray-100 text-gray-600",
                };
                const name =
                  [d.firstName, d.lastName].filter(Boolean).join(" ") ||
                  "(no name)";

                return (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium">
                      <Link
                        href={`/carrier/drivers/${d.id}`}
                        className="text-indigo-600 hover:underline"
                      >
                        {name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.phone ?? "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.driverProfile
                        ? d.driverProfile.isAvailable
                          ? "Yes"
                          : "No"
                        : "-"}
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {d.activeTrips}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        {d.status === "PENDING_VERIFICATION" && (
                          <>
                            <button
                              onClick={() => handleApprove(d.id)}
                              className="rounded bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-green-700"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => setRejectingId(d.id)}
                              className="rounded bg-red-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-red-700"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {d.status === "ACTIVE" && (
                          <>
                            <Link
                              href={`/carrier/drivers/${d.id}`}
                              className="rounded bg-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-300"
                            >
                              View
                            </Link>
                            <button
                              onClick={() => handleSuspend(d.id)}
                              className="rounded bg-red-100 px-2.5 py-1 text-xs font-medium text-red-700 hover:bg-red-200"
                            >
                              Suspend
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Reject modal */}
      {rejectingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
            <h3 className="mb-4 text-lg font-semibold text-slate-800">
              Reject Driver
            </h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason for rejection (required)"
              className="mb-4 w-full rounded-lg border border-slate-300 p-3 text-sm focus:border-indigo-500 focus:outline-none"
              rows={3}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setRejectingId(null);
                  setRejectReason("");
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleReject(rejectingId)}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
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

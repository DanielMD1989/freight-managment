/**
 * Dispatcher Escalations Client Component
 *
 * Shows all escalations in the system for dispatchers to manage
 * Features: Status filters, priority indicators, assignment
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface Escalation {
  id: string;
  escalationType: string;
  priority: string;
  status: string;
  title: string;
  description: string | null;
  notes: string | null;
  resolution: string | null;
  assignedTo: string | null;
  createdAt: string;
  resolvedAt: string | null;
  load: {
    id: string;
    status: string;
    pickupCity: string;
    deliveryCity: string;
    assignedTruck?: {
      licensePlate: string;
      carrier?: {
        name: string;
      };
    };
    shipper?: {
      name: string;
    };
  };
}

interface EscalationStats {
  byStatus: Record<string, number>;
  byPriority: Record<string, number>;
}

type StatusFilter = "ALL" | "OPEN" | "IN_PROGRESS" | "RESOLVED";
type PriorityFilter = "ALL" | "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export default function EscalationsClient() {
  const [escalations, setEscalations] = useState<Escalation[]>([]);
  const [stats, setStats] = useState<EscalationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("OPEN");
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>("ALL");

  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const fetchEscalations = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (statusFilter !== "ALL") {
        params.append("status", statusFilter);
      }
      if (priorityFilter !== "ALL") {
        params.append("priority", priorityFilter);
      }

      const response = await fetch(`/api/escalations?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch escalations");
      }

      const data = await response.json();
      setEscalations(data.escalations || []);
      setTotal(data.total || 0);
      setStats(data.stats || null);
      // H5 FIX: Use unknown type with type guard
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch escalations";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEscalations();
  }, [offset, statusFilter, priorityFilter]);

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      OPEN: "bg-red-100 text-red-700 border border-red-200",
      IN_PROGRESS: "bg-amber-100 text-amber-700 border border-amber-200",
      RESOLVED: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    };
    return styles[status] || "bg-slate-100 text-slate-600";
  };

  const getPriorityBadge = (priority: string) => {
    const styles: Record<string, string> = {
      CRITICAL: "bg-red-500 text-white",
      HIGH: "bg-orange-500 text-white",
      MEDIUM: "bg-amber-400 text-amber-900",
      LOW: "bg-slate-200 text-slate-700",
    };
    return styles[priority] || "bg-slate-200 text-slate-700";
  };

  const getEscalationTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      DELAY: "Delivery Delay",
      DAMAGE: "Cargo Damage",
      MISSING: "Missing Cargo",
      ROUTE_DEVIATION: "Route Deviation",
      GPS_OFFLINE: "GPS Offline",
      PAYMENT_ISSUE: "Payment Issue",
      DRIVER_ISSUE: "Driver Issue",
      VEHICLE_BREAKDOWN: "Vehicle Breakdown",
      CUSTOMS_HOLD: "Customs Hold",
      OTHER: "Other",
    };
    return labels[type] || type;
  };

  const handleEscalateToAdmin = useCallback(
    async (escalationId: string, title: string) => {
      if (!confirm(`Escalate "${title}" to admin with CRITICAL priority?`))
        return;

      try {
        const response = await fetch(`/api/escalations/${escalationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "ESCALATED",
            priority: "CRITICAL",
            notes: "Escalated to admin by dispatcher",
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to escalate");
        }

        fetchEscalations();
        // H5 FIX: Use unknown type with type guard
      } catch (error: unknown) {
        const message =
          error instanceof Error ? error.message : "Failed to escalate";
        setError(message);
      }
    },
    []
  );

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  const openCount = stats?.byStatus?.OPEN || 0;
  const inProgressCount = stats?.byStatus?.IN_PROGRESS || 0;
  const criticalCount = stats?.byPriority?.CRITICAL || 0;

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-2xl font-bold text-slate-800">{total}</p>
          <p className="text-sm text-slate-500">Total Escalations</p>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="text-2xl font-bold text-red-700">{openCount}</p>
          <p className="text-sm text-red-600">Open</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-2xl font-bold text-amber-700">{inProgressCount}</p>
          <p className="text-sm text-amber-600">In Progress</p>
        </div>
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-2xl font-bold text-rose-700">{criticalCount}</p>
          <p className="text-sm text-rose-600">Critical Priority</p>
        </div>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {/* Status Filter */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setOffset(0);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Priority
            </label>
            <select
              value={priorityFilter}
              onChange={(e) => {
                setPriorityFilter(e.target.value as PriorityFilter);
                setOffset(0);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Priorities</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchEscalations}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            <svg
              className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-teal-500"></div>
            <p className="mt-3 text-sm text-slate-500">
              Loading escalations...
            </p>
          </div>
        ) : escalations.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-200">
              <svg
                className="h-8 w-8 text-emerald-600"
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
            <h3 className="text-lg font-semibold text-slate-800">All Clear!</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {statusFilter !== "ALL" || priorityFilter !== "ALL"
                ? "No escalations match your current filters. Try adjusting your criteria."
                : "No escalations require attention. All trips are running smoothly."}
            </p>
            <button
              onClick={fetchEscalations}
              className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Priority
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Load
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Issue
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Description
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {escalations.map((escalation) => (
                  <tr
                    key={escalation.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded px-2 py-0.5 text-xs font-bold ${getPriorityBadge(escalation.priority)}`}
                      >
                        {escalation.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {escalation.load.pickupCity} →{" "}
                          {escalation.load.deliveryCity}
                        </p>
                        <p className="text-xs text-slate-500">
                          {escalation.load.shipper?.name || "Unknown shipper"}
                        </p>
                        {escalation.load.assignedTruck && (
                          <p className="text-xs text-slate-400">
                            Truck: {escalation.load.assignedTruck.licensePlate}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {getEscalationTypeLabel(escalation.escalationType)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="max-w-[200px]">
                        <p className="truncate text-sm font-medium text-slate-800">
                          {escalation.title}
                        </p>
                        {escalation.description && (
                          <p className="truncate text-xs text-slate-500">
                            {escalation.description}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadge(escalation.status)}`}
                      >
                        {escalation.status.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-600">
                        {new Date(escalation.createdAt).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dispatcher/loads/${escalation.load.id}`}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                        >
                          View Load
                        </Link>
                        {(escalation.status === "OPEN" ||
                          escalation.status === "IN_PROGRESS") && (
                          <button
                            className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-amber-600"
                            onClick={() =>
                              handleEscalateToAdmin(
                                escalation.id,
                                escalation.title
                              )
                            }
                          >
                            Escalate
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

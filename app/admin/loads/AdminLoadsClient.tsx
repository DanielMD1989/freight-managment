"use client";

/**
 * Admin Loads Client Component
 *
 * Interactive table with filtering for all platform loads
 */

import { useState, useEffect } from "react";
import Link from "next/link";

// All valid LoadStatus values from Prisma schema + 'ALL' for filter
type LoadStatus =
  | "ALL"
  | "DRAFT"
  | "POSTED"
  | "SEARCHING"
  | "OFFERED"
  | "ASSIGNED"
  | "PICKUP_PENDING"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "COMPLETED"
  | "EXCEPTION"
  | "CANCELLED"
  | "EXPIRED"
  | "UNPOSTED";

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  truckType: string;
  weight: number;
  status: string;
  shipperServiceFee: number | null;
  createdAt: string;
  shipper: {
    id: string;
    name: string;
  } | null;
  corridor: {
    id: string;
    name: string;
    serviceFeePercent: number;
  } | null;
}

// All LoadStatus tabs - admins need to see ALL statuses
const STATUS_TABS: { key: LoadStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "POSTED", label: "Posted" },
  { key: "SEARCHING", label: "Searching" },
  { key: "OFFERED", label: "Offered" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "PICKUP_PENDING", label: "Pickup" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETED", label: "Completed" },
  { key: "EXCEPTION", label: "Exception" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "EXPIRED", label: "Expired" },
  { key: "UNPOSTED", label: "Unposted" },
];

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-800 dark:bg-slate-900/30 dark:text-slate-300",
  POSTED: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  SEARCHING:
    "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  OFFERED:
    "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  ASSIGNED:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  PICKUP_PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  IN_TRANSIT:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  DELIVERED: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  COMPLETED:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  EXCEPTION:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CANCELLED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  EXPIRED:
    "bg-stone-100 text-stone-800 dark:bg-stone-900/30 dark:text-stone-300",
  UNPOSTED: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
};

export default function AdminLoadsClient() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<LoadStatus>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  const fetchLoads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
        sortBy: "createdAt",
        sortOrder: "desc",
      });

      if (activeStatus !== "ALL") {
        params.append("status", activeStatus);
      }

      const response = await fetch(`/api/loads?${params}`);
      if (response.ok) {
        const data = await response.json();
        setLoads(data.loads || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch loads:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoads();
  }, [activeStatus, page]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return "-";
    return new Intl.NumberFormat("en-ET", {
      style: "currency",
      currency: "ETB",
      minimumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className="space-y-4">
      {/* Status Tabs */}
      <div className="inline-flex gap-1 rounded-2xl border border-slate-200/60 bg-white p-1 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveStatus(tab.key);
              setPage(1);
            }}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
              activeStatus === tab.key
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Summary */}
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {totalCount} loads found
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Shipper
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Route
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Weight
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Corridor
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Rate
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Created
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {loading ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    Loading...
                  </td>
                </tr>
              ) : loads.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No loads found
                  </td>
                </tr>
              ) : (
                loads.map((load) => (
                  <tr
                    key={load.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/admin/loads/${load.id}`}
                        className="font-mono text-sm text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {load.id.slice(0, 8)}...
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {load.shipper?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {load.pickupCity} → {load.deliveryCity}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {load.truckType?.replace("_", " ") || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {load.weight ? `${load.weight.toLocaleString()} kg` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLORS[load.status] || "bg-gray-100 text-gray-800"}`}
                      >
                        {load.status?.replace("_", " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {load.corridor?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {load.shipperServiceFee != null
                        ? formatCurrency(load.shipperServiceFee)
                        : "—"}
                    </td>
                    <td className="px-4 py-3 text-sm whitespace-nowrap text-slate-500 dark:text-slate-400">
                      {formatDate(load.createdAt)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-700">
            <div className="text-sm text-slate-500 dark:text-slate-400">
              Page {page} of {totalPages}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
              >
                Previous
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1 text-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
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

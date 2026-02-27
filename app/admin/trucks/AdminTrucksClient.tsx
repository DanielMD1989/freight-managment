"use client";

/**
 * Admin Trucks Client Component
 *
 * Interactive table with filtering for all platform trucks
 */

import { useCallback, useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";

type ApprovalStatus = "ALL" | "APPROVED" | "PENDING" | "REJECTED";

interface Truck {
  id: string;
  licensePlate: string;
  truckType: string;
  maxWeight: number | null;
  capacityTons: number | null;
  maxLengthM: number | null;
  approvalStatus: string;
  currentCity: string | null;
  isAvailable: boolean;
  carrier: {
    id: string;
    name: string;
  } | null;
  activePosting: {
    id: string;
    status: string;
  } | null;
  createdAt: string;
}

const STATUS_TABS: { key: ApprovalStatus; label: string }[] = [
  { key: "ALL", label: "All" },
  { key: "APPROVED", label: "Approved" },
  { key: "PENDING", label: "Pending" },
  { key: "REJECTED", label: "Rejected" },
];

const APPROVAL_COLORS: Record<string, string> = {
  APPROVED:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  PENDING:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
};

export default function AdminTrucksClient() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeStatus, setActiveStatus] = useState<ApprovalStatus>("ALL");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "20",
      });

      if (activeStatus !== "ALL") {
        params.append("approvalStatus", activeStatus);
      }

      const response = await fetch(`/api/trucks?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTrucks(data.trucks || []);
        setTotalPages(data.pagination?.pages || 1);
        setTotalCount(data.pagination?.total || 0);
      }
    } catch (error) {
      console.error("Failed to fetch trucks:", error);
    } finally {
      setLoading(false);
    }
  }, [activeStatus, page]);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const handleDelete = async (truckId: string) => {
    setIsDeleting(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/trucks/${truckId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
      });

      if (!response.ok) {
        const error = await response.json();
        if (response.status === 409) {
          toast.error(
            error.message ||
              "Cannot delete truck with active trips or postings."
          );
        } else {
          toast.error(error.message || "Failed to delete truck");
        }
        return;
      }

      toast.success("Truck deleted successfully");
      setDeleteConfirmId(null);
      fetchTrucks();
    } catch (error) {
      console.error("Error deleting truck:", error);
      toast.error("An unexpected error occurred. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status Tabs + Pending Link */}
      <div className="flex flex-wrap items-center justify-between gap-4">
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

        <Link
          href="/admin/trucks/pending"
          className="rounded-xl bg-yellow-100 px-4 py-2 text-sm font-medium text-yellow-700 transition-colors hover:bg-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:hover:bg-yellow-900/50"
        >
          Review Pending Approvals →
        </Link>
      </div>

      {/* Summary */}
      <div className="text-sm text-slate-500 dark:text-slate-400">
        {totalCount} trucks found
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  License Plate
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Carrier
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Capacity
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Approval
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Current City
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Posted
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Created
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold tracking-wider text-slate-500 uppercase dark:text-slate-400">
                  Actions
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
              ) : trucks.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No trucks found
                  </td>
                </tr>
              ) : (
                trucks.map((truck) => (
                  <tr
                    key={truck.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {truck.licensePlate}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {truck.carrier?.name || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {truck.truckType?.replace("_", " ") || "-"}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {truck.maxWeight
                        ? `${truck.maxWeight.toLocaleString()} kg`
                        : truck.capacityTons
                          ? `${truck.capacityTons} tons`
                          : "-"}
                      {truck.maxLengthM && ` / ${truck.maxLengthM}m`}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${APPROVAL_COLORS[truck.approvalStatus] || "bg-gray-100 text-gray-800"}`}
                      >
                        {truck.approvalStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-300">
                      {truck.currentCity || "-"}
                    </td>
                    <td className="px-4 py-3">
                      {truck.activePosting ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900/30 dark:text-blue-300">
                          Active
                        </span>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(truck.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setDeleteConfirmId(truck.id)}
                        className="rounded-lg px-3 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                      >
                        Delete
                      </button>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="bg-gradient-to-r from-rose-500 to-rose-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">
                Confirm Delete
              </h3>
            </div>
            <div className="p-6">
              <p className="mb-6 text-slate-600 dark:text-slate-300">
                Are you sure you want to delete this truck? This will also
                remove associated postings, documents, and GPS records. This
                action cannot be undone.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={isDeleting}
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDelete(deleteConfirmId)}
                  disabled={isDeleting}
                  className="flex-1 rounded-xl bg-gradient-to-r from-rose-600 to-rose-500 px-4 py-2.5 font-medium text-white shadow-md shadow-rose-500/25 transition-all hover:from-rose-700 hover:to-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeleting ? "Deleting..." : "Delete Truck"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

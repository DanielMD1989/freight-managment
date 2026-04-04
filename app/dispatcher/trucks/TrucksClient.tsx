/**
 * Dispatcher Trucks Client Component
 *
 * Fleet view of all trucks for dispatchers (§5: "View all trucks — All statuses, all orgs")
 * Features: Search, filters, pagination, posting badge, "Find Loads" action
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import FindMatchesModal from "@/components/dispatcher/FindMatchesModal";
import { TRUCK_TYPES as TRUCK_TYPES_CONST } from "@/lib/constants/truckTypes";

interface Truck {
  id: string;
  licensePlate: string;
  truckType: string;
  capacity: number;
  approvalStatus: string;
  currentCity: string | null;
  isAvailable: boolean;
  gpsStatus?: string;
  createdAt: string;
  carrier?: {
    id: string;
    name: string;
    isVerified?: boolean;
  };
  gpsDevice?: {
    id: string;
    status: string;
    lastSeenAt: string | null;
  } | null;
  hasActivePosting: boolean;
  activePostingId: string | null;
  // §7 V1-V3: status badges
  postingStatus: string | null;
  activeTripId: string | null;
  activeTripStatus: string | null;
}

type ApprovalFilter = "ALL" | "APPROVED" | "PENDING" | "REJECTED";
type PostingFilter = "ALL" | "POSTED" | "UNPOSTED";

export default function TrucksClient() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Search + Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [approvalFilter, setApprovalFilter] = useState<ApprovalFilter>("ALL");
  const [postingFilter, setPostingFilter] = useState<PostingFilter>("ALL");
  const [truckTypeFilter, setTruckTypeFilter] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Find Loads Modal
  const [showFindLoads, setShowFindLoads] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);

  const fetchTrucks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (approvalFilter !== "ALL") {
        params.append("approvalStatus", approvalFilter);
      }
      if (truckTypeFilter) {
        params.append("truckType", truckTypeFilter);
      }
      if (postingFilter === "POSTED") {
        params.append("hasActivePosting", "true");
      } else if (postingFilter === "UNPOSTED") {
        params.append("hasActivePosting", "false");
      }

      const response = await fetch(`/api/trucks?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch trucks");
      }

      const data = await response.json();
      setTrucks(data.trucks || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.pages || 1);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to fetch trucks";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, approvalFilter, truckTypeFilter, postingFilter]);

  useEffect(() => {
    fetchTrucks();
  }, [fetchTrucks]);

  const handleFindLoads = (truck: Truck) => {
    setSelectedTruck(truck);
    setShowFindLoads(true);
  };

  const getApprovalBadge = (status: string) => {
    const styles: Record<string, string> = {
      APPROVED: "bg-emerald-100 text-emerald-700",
      PENDING: "bg-yellow-100 text-yellow-700",
      REJECTED: "bg-red-100 text-red-700",
    };
    return styles[status] || "bg-slate-100 text-slate-600";
  };

  const getGpsStatus = (device?: Truck["gpsDevice"]) => {
    if (device?.status === "ACTIVE") {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
          Active
        </span>
      );
    }
    return <span className="text-xs text-slate-400">No GPS</span>;
  };

  const truckTypes = TRUCK_TYPES_CONST.map((t) => t.value);

  // Client-side search filter
  const filteredTrucks = searchQuery
    ? trucks.filter((t) => {
        const q = searchQuery.toLowerCase();
        return (
          t.licensePlate.toLowerCase().includes(q) ||
          (t.carrier?.name || "").toLowerCase().includes(q) ||
          (t.currentCity || "").toLowerCase().includes(q) ||
          t.truckType.toLowerCase().replace(/_/g, " ").includes(q)
        );
      })
    : trucks;

  return (
    <div className="space-y-6">
      {/* Search + Filters */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-4">
          {/* Search */}
          <div className="min-w-[200px] flex-1">
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Search
            </label>
            <input
              type="text"
              placeholder="Search by plate, carrier, or city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Approval Status Filter */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Approval Status
            </label>
            <select
              value={approvalFilter}
              onChange={(e) => {
                setApprovalFilter(e.target.value as ApprovalFilter);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="APPROVED">Approved</option>
              <option value="PENDING">Pending</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Posting Filter */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Posting
            </label>
            <select
              value={postingFilter}
              onChange={(e) => {
                setPostingFilter(e.target.value as PostingFilter);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All</option>
              <option value="POSTED">With Active Posting</option>
              <option value="UNPOSTED">No Active Posting</option>
            </select>
          </div>

          {/* Truck Type Filter */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-500">
              Truck Type
            </label>
            <select
              value={truckTypeFilter}
              onChange={(e) => {
                setTruckTypeFilter(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Types</option>
              {truckTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchTrucks}
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

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Showing {trucks.length} of {total} trucks
        </p>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-teal-500"></div>
            <p className="mt-3 text-sm text-slate-500">Loading trucks...</p>
          </div>
        ) : trucks.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-100 to-teal-200">
              <svg
                className="h-8 w-8 text-teal-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">
              No Trucks Found
            </h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
              {truckTypeFilter || approvalFilter !== "ALL"
                ? "No trucks match your current filters. Try broadening your search criteria."
                : "No trucks have been registered on the platform yet."}
            </p>
            <button
              onClick={fetchTrucks}
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
                    License Plate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Type / Capacity
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Carrier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Approval
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Location
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    GPS
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Posting
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Trip
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrucks.map((truck) => (
                  <tr
                    key={truck.id}
                    className="transition-colors hover:bg-slate-50"
                  >
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-800">
                        {truck.licensePlate}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-700">
                          {truck.truckType?.replace(/_/g, " ")}
                        </p>
                        <p className="text-xs text-slate-500">
                          {Number(truck.capacity).toLocaleString()} kg
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {truck.carrier?.name || "Unknown"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${getApprovalBadge(truck.approvalStatus)}`}
                      >
                        {truck.approvalStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {truck.currentCity || "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getGpsStatus(truck.gpsDevice)}
                    </td>
                    <td className="px-4 py-3">
                      {truck.postingStatus === "ACTIVE" && (
                        <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-700">
                          Active
                        </span>
                      )}
                      {truck.postingStatus === "MATCHED" && (
                        <span className="inline-flex rounded-full bg-blue-100 px-2.5 py-1 text-xs font-medium text-blue-700">
                          Matched
                        </span>
                      )}
                      {truck.postingStatus === "EXPIRED" && (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          Expired
                        </span>
                      )}
                      {!truck.postingStatus && (
                        <span className="text-xs text-slate-400">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {truck.activeTripStatus ? (
                        <span
                          className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                            truck.activeTripStatus === "IN_TRANSIT"
                              ? "bg-orange-100 text-orange-700"
                              : truck.activeTripStatus === "DELIVERED"
                                ? "bg-teal-100 text-teal-700"
                                : truck.activeTripStatus === "EXCEPTION"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-purple-100 text-purple-700"
                          }`}
                        >
                          {truck.activeTripStatus.replace(/_/g, " ")}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dispatcher/trucks/${truck.id}`}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-200"
                        >
                          View
                        </Link>
                        {truck.hasActivePosting && truck.activePostingId && (
                          <button
                            onClick={() => handleFindLoads(truck)}
                            className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-700"
                          >
                            Find Loads
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
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm transition-colors hover:bg-slate-50 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Find Loads Modal */}
      {selectedTruck && selectedTruck.activePostingId && (
        <FindMatchesModal
          isOpen={showFindLoads}
          onClose={() => {
            setShowFindLoads(false);
            setSelectedTruck(null);
          }}
          type="loads"
          truckPostingId={selectedTruck.activePostingId}
          truckId={selectedTruck.id}
          truckDetails={{
            licensePlate: selectedTruck.licensePlate,
            truckType: selectedTruck.truckType,
            originCity: "Any",
            destinationCity: "Any",
          }}
          onProposalCreated={fetchTrucks}
        />
      )}
    </div>
  );
}

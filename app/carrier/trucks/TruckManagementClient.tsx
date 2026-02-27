"use client";

/**
 * Truck Management Client Component
 *
 * Interactive truck list with filtering, tabs for approval status, and actions
 * Sprint 12 - Story 12.2: Truck Management
 * Sprint 18 - Updated: Tabs for Approved/Pending/Rejected trucks
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ROUTES } from "@/lib/routes";

interface Truck {
  id: string;
  truckType: string;
  licensePlate: string;
  capacity: number;
  volume: number | null;
  currentCity: string | null;
  currentRegion: string | null;
  isAvailable: boolean;
  status: string;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  gpsDevice: {
    id: string;
    imei: string;
    status: string;
    lastSeenAt: string;
  } | null;
}

const TRUCK_TYPES = [
  { value: "all", label: "All Types" },
  { value: "FLATBED", label: "Flatbed" },
  { value: "REFRIGERATED", label: "Refrigerated" },
  { value: "TANKER", label: "Tanker" },
  { value: "CONTAINER", label: "Container" },
  { value: "DRY_VAN", label: "Dry Van" },
  { value: "LOWBOY", label: "Lowboy" },
  { value: "DUMP_TRUCK", label: "Dump Truck" },
  { value: "BOX_TRUCK", label: "Box Truck" },
];

const STATUS_OPTIONS = [
  { value: "all", label: "All Status" },
  { value: "ACTIVE", label: "Active" },
  { value: "IN_TRANSIT", label: "In Transit" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "INACTIVE", label: "Inactive" },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: "bg-emerald-50 text-emerald-700 border border-emerald-200",
    IN_TRANSIT: "bg-teal-50 text-teal-700 border border-teal-200",
    MAINTENANCE: "bg-amber-50 text-amber-700 border border-amber-200",
    INACTIVE: "bg-slate-100 text-slate-600 border border-slate-200",
  };
  return (
    colors[status] || "bg-slate-100 text-slate-600 border border-slate-200"
  );
}

interface Pagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  pages?: number;
  hasMore?: boolean;
}

interface TruckManagementClientProps {
  initialApprovedTrucks: Truck[];
  initialPendingTrucks: Truck[];
  initialRejectedTrucks: Truck[];
  approvedPagination: Pagination;
  pendingPagination: Pagination;
  rejectedPagination: Pagination;
  initialTab: string;
}

export default function TruckManagementClient({
  initialApprovedTrucks,
  initialPendingTrucks,
  initialRejectedTrucks,
  approvedPagination,
  pendingPagination,
  rejectedPagination,
  initialTab,
}: TruckManagementClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [activeTab, setActiveTab] = useState(initialTab);
  const [approvedTrucks] = useState<Truck[]>(initialApprovedTrucks);
  const [pendingTrucks] = useState<Truck[]>(initialPendingTrucks);
  const [rejectedTrucks] = useState<Truck[]>(initialRejectedTrucks);
  const [truckTypeFilter, setTruckTypeFilter] = useState(
    searchParams.get("truckType") || "all"
  );
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get("status") || "all"
  );
  // Get current trucks and pagination based on active tab
  const getCurrentTrucks = () => {
    switch (activeTab) {
      case "pending":
        return pendingTrucks;
      case "rejected":
        return rejectedTrucks;
      default:
        return approvedTrucks;
    }
  };

  const getCurrentPagination = () => {
    switch (activeTab) {
      case "pending":
        return pendingPagination;
      case "rejected":
        return rejectedPagination;
      default:
        return approvedPagination;
    }
  };

  const trucks = getCurrentTrucks();
  const pagination = getCurrentPagination();

  /**
   * Handle tab change
   */
  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tab);
    params.delete("page");
    router.push(`/carrier/trucks?${params.toString()}`);
  };

  /**
   * Handle truck type filter change
   */
  const handleTruckTypeChange = (type: string) => {
    setTruckTypeFilter(type);
    const params = new URLSearchParams(searchParams.toString());
    if (type !== "all") {
      params.set("truckType", type);
    } else {
      params.delete("truckType");
    }
    params.delete("page");
    router.push(`/carrier/trucks?${params.toString()}`);
  };

  /**
   * Handle status filter change
   */
  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    if (status !== "all") {
      params.set("status", status);
    } else {
      params.delete("status");
    }
    params.delete("page");
    router.push(`/carrier/trucks?${params.toString()}`);
  };

  /**
   * Handle page change
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/carrier/trucks?${params.toString()}`);
  };

  // Tab counts
  const approvedCount = approvedPagination?.total || 0;
  const pendingCount = pendingPagination?.total || 0;
  const rejectedCount = rejectedPagination?.total || 0;

  return (
    <div className="space-y-6">
      {/* Tabs */}
      <div className="inline-flex gap-1 rounded-2xl border border-slate-200/60 bg-white p-1.5 shadow-sm">
        <button
          onClick={() => handleTabChange("approved")}
          className={`${
            activeTab === "approved"
              ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25"
              : "text-slate-600 hover:bg-slate-100"
          } flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all`}
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
              d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Approved
          <span
            className={`${
              activeTab === "approved" ? "bg-white/20" : "bg-slate-100"
            } rounded-full px-2 py-0.5 text-xs font-bold`}
          >
            {approvedCount}
          </span>
        </button>
        <button
          onClick={() => handleTabChange("pending")}
          className={`${
            activeTab === "pending"
              ? "bg-gradient-to-r from-amber-500 to-amber-400 text-white shadow-md shadow-amber-500/25"
              : "text-slate-600 hover:bg-slate-100"
          } flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all`}
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
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Pending
          {pendingCount > 0 && (
            <span
              className={`${
                activeTab === "pending"
                  ? "bg-white/20"
                  : "bg-amber-100 text-amber-700"
              } rounded-full px-2 py-0.5 text-xs font-bold ${activeTab !== "pending" ? "animate-pulse" : ""}`}
            >
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => handleTabChange("rejected")}
          className={`${
            activeTab === "rejected"
              ? "bg-gradient-to-r from-rose-500 to-rose-400 text-white shadow-md shadow-rose-500/25"
              : "text-slate-600 hover:bg-slate-100"
          } flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium transition-all`}
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
              d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          Rejected
          {rejectedCount > 0 && (
            <span
              className={`${
                activeTab === "rejected"
                  ? "bg-white/20"
                  : "bg-rose-100 text-rose-700"
              } rounded-full px-2 py-0.5 text-xs font-bold`}
            >
              {rejectedCount}
            </span>
          )}
        </button>
      </div>

      {/* Filters and Actions - Only show for approved tab */}
      {activeTab === "approved" && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div className="flex flex-col gap-4 sm:flex-row">
              {/* Truck Type Filter */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Truck Type
                </label>
                <select
                  value={truckTypeFilter}
                  onChange={(e) => handleTruckTypeChange(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  {TRUCK_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Filter */}
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => handleStatusChange(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm transition-all outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Add Truck Button */}
            <Link
              href={ROUTES.carrier.trucks.add}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-2.5 font-medium text-white shadow-md shadow-teal-500/25 transition-all hover:from-teal-700 hover:to-teal-600"
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
              Add Truck
            </Link>
          </div>
        </div>
      )}

      {/* Add Truck Button for pending/rejected tabs */}
      {activeTab !== "approved" && (
        <div className="flex justify-end">
          <Link
            href={ROUTES.carrier.trucks.add}
            className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-2.5 font-medium text-white shadow-md shadow-teal-500/25 transition-all hover:from-teal-700 hover:to-teal-600"
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
            Add Truck
          </Link>
        </div>
      )}

      {/* Pending/Rejected Info Banner */}
      {activeTab === "pending" && pendingCount > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-yellow-50 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100">
              <svg
                className="h-5 w-5 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-amber-800">
                Trucks awaiting admin approval
              </p>
              <p className="mt-0.5 text-sm text-amber-700">
                Once approved, trucks will appear in the Approved tab and can be
                posted for loads.
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === "rejected" && rejectedCount > 0 && (
        <div className="rounded-2xl border border-rose-200 bg-gradient-to-r from-rose-50 to-red-50 p-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100">
              <svg
                className="h-5 w-5 text-rose-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-rose-800">
                These trucks were rejected by admin
              </p>
              <p className="mt-0.5 text-sm text-rose-700">
                You can edit and resubmit rejected trucks for approval. Check
                the rejection reason below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Trucks List */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
        <div className="border-b border-slate-100 bg-gradient-to-r from-slate-50 to-teal-50/30 px-6 py-4">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-800">
            <svg
              className="h-5 w-5 text-teal-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2"
              />
            </svg>
            {activeTab === "approved" && `Approved Trucks (${approvedCount})`}
            {activeTab === "pending" && `Pending Approval (${pendingCount})`}
            {activeTab === "rejected" && `Rejected Trucks (${rejectedCount})`}
          </h2>
        </div>

        {trucks.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full">
                <thead className="border-b border-slate-200 bg-gradient-to-r from-slate-100 to-slate-50">
                  <tr>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase">
                      License Plate
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase">
                      Type
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase">
                      Capacity
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase">
                      Location
                    </th>
                    {activeTab === "approved" && (
                      <th className="px-6 py-3.5 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase">
                        Status
                      </th>
                    )}
                    {activeTab === "rejected" && (
                      <th className="px-6 py-3.5 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase">
                        Rejection Reason
                      </th>
                    )}
                    <th className="px-6 py-3.5 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase">
                      GPS
                    </th>
                    <th className="px-6 py-3.5 text-left text-xs font-semibold tracking-wider text-slate-600 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {trucks.map((truck) => (
                    <tr
                      key={truck.id}
                      className="transition-colors hover:bg-slate-50"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-semibold text-slate-800">
                          {truck.licensePlate}
                        </div>
                        <div className="text-xs text-slate-400">
                          Added {formatDate(truck.createdAt)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {truck.truckType.replace(/_/g, " ")}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-700">
                          {truck.capacity.toLocaleString()} kg
                        </div>
                        {truck.volume && (
                          <div className="text-xs text-slate-400">
                            {truck.volume} m³
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-700">
                          {truck.currentCity || "Not set"}
                        </div>
                        {truck.currentRegion && (
                          <div className="text-xs text-slate-400">
                            {truck.currentRegion}
                          </div>
                        )}
                      </td>
                      {activeTab === "approved" && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${getStatusColor(
                              truck.status
                            )}`}
                          >
                            {truck.status}
                          </span>
                        </td>
                      )}
                      {activeTab === "rejected" && (
                        <td className="px-6 py-4">
                          <div className="max-w-xs text-sm text-rose-600">
                            {truck.rejectionReason || "No reason provided"}
                          </div>
                        </td>
                      )}
                      <td className="px-6 py-4 whitespace-nowrap">
                        {truck.gpsDevice ? (
                          <div className="text-sm">
                            <div className="flex items-center gap-1 font-medium text-emerald-600">
                              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500"></span>
                              Connected
                            </div>
                            <div className="text-xs text-slate-400">
                              {truck.gpsDevice.imei}
                            </div>
                          </div>
                        ) : (
                          <div className="text-sm text-slate-400">No GPS</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm whitespace-nowrap">
                        <div className="flex gap-3">
                          <Link
                            href={`/carrier/trucks/${truck.id}`}
                            className="font-medium text-teal-600 transition-colors hover:text-teal-700"
                          >
                            View
                          </Link>
                          <Link
                            href={`/carrier/trucks/${truck.id}/edit`}
                            className="font-medium text-slate-600 transition-colors hover:text-slate-700"
                          >
                            Edit
                          </Link>
                          {activeTab === "rejected" && (
                            <Link
                              href={`/carrier/trucks/${truck.id}/edit?resubmit=true`}
                              className="font-medium text-emerald-600 transition-colors hover:text-emerald-700"
                            >
                              Resubmit
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="divide-y divide-gray-200 md:hidden">
              {trucks.map((truck) => (
                <div key={truck.id} className="p-4">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <div className="font-medium text-gray-900">
                        {truck.licensePlate}
                      </div>
                      <div className="text-sm text-gray-600">
                        {truck.truckType.replace(/_/g, " ")}
                      </div>
                    </div>
                    {activeTab === "approved" && (
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(
                          truck.status
                        )}`}
                      >
                        {truck.status}
                      </span>
                    )}
                    {activeTab === "pending" && (
                      <span className="rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800">
                        Pending
                      </span>
                    )}
                    {activeTab === "rejected" && (
                      <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-800">
                        Rejected
                      </span>
                    )}
                  </div>

                  {activeTab === "rejected" && truck.rejectionReason && (
                    <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">
                      <strong>Reason:</strong> {truck.rejectionReason}
                    </div>
                  )}

                  <div className="mb-3 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-gray-500">Capacity</div>
                      <div className="font-medium">
                        {truck.capacity.toLocaleString()} kg
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-500">Location</div>
                      <div className="font-medium">
                        {truck.currentCity || "Not set"}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/carrier/trucks/${truck.id}`}
                      className="flex-1 rounded-lg border border-blue-600 px-4 py-2 text-center text-sm font-medium text-blue-600 hover:bg-blue-50"
                    >
                      View
                    </Link>
                    <Link
                      href={`/carrier/trucks/${truck.id}/edit`}
                      className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-center text-sm font-medium text-gray-600 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination &&
              (pagination.totalPages || pagination.pages || 0) > 1 && (
                <div className="flex items-center justify-between border-t border-gray-200 px-6 py-4">
                  <div className="text-sm text-gray-600">
                    Page {pagination.page} of{" "}
                    {pagination.totalPages || pagination.pages}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handlePageChange(pagination.page - 1)}
                      disabled={pagination.page === 1}
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Previous
                    </button>
                    <button
                      onClick={() => handlePageChange(pagination.page + 1)}
                      disabled={
                        pagination.page ===
                        (pagination.totalPages || pagination.pages)
                      }
                      className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
          </>
        ) : (
          /* Empty State */
          <div className="px-6 py-12 text-center">
            {activeTab === "approved" && (
              <>
                <div className="mb-4 text-6xl">🚛</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  No Approved Trucks Yet
                </h3>
                <p className="mb-6 text-gray-600">
                  {pendingCount > 0
                    ? `You have ${pendingCount} truck(s) awaiting admin approval.`
                    : "Add your first truck to start finding loads and earning revenue."}
                </p>
                <Link
                  href={ROUTES.carrier.trucks.add}
                  className="inline-block rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Add Your First Truck
                </Link>
              </>
            )}
            {activeTab === "pending" && (
              <>
                <div className="mb-4 text-6xl">✓</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  No Pending Trucks
                </h3>
                <p className="text-gray-600">
                  All your trucks have been reviewed.
                </p>
              </>
            )}
            {activeTab === "rejected" && (
              <>
                <div className="mb-4 text-6xl">✓</div>
                <h3 className="mb-2 text-lg font-semibold text-gray-900">
                  No Rejected Trucks
                </h3>
                <p className="text-gray-600">
                  None of your trucks have been rejected.
                </p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

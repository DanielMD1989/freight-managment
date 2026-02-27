"use client";

/**
 * Truck Approval Client Component
 *
 * Interactive truck approval with approve/reject actions
 * Sprint 18 - Truck Approval Workflow
 */

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";

interface Truck {
  id: string;
  truckType: string;
  licensePlate: string;
  capacity: number;
  volume: number | null;
  currentCity: string | null;
  currentRegion: string | null;
  approvalStatus: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  imei: string | null;
  gpsProvider: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Statistics {
  pending: number;
  approved: number;
  rejected: number;
}

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pending Approval", color: "yellow" },
  { value: "APPROVED", label: "Approved", color: "green" },
  { value: "REJECTED", label: "Rejected", color: "red" },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function getApprovalStatusColor(status: string): string {
  const colors: Record<string, string> = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    EXPIRED: "bg-gray-100 text-gray-800",
  };
  return colors[status] || "bg-gray-100 text-gray-800";
}

export default function TruckApprovalClient({
  initialTrucks,
  pagination,
  statistics,
  initialStatus,
}: {
  initialTrucks: Truck[];
  pagination: Pagination;
  statistics: Statistics;
  initialStatus?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [trucks, setTrucks] = useState<Truck[]>(initialTrucks);
  const [statusFilter, setStatusFilter] = useState(initialStatus || "PENDING");
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  /**
   * Handle status filter change
   */
  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());
    params.set("status", status);
    params.delete("page");
    router.push(`/admin/trucks/pending?${params.toString()}`);
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/admin/trucks/pending?${params.toString()}`);
  };

  /**
   * Handle truck approval
   */
  const handleApprove = async (truck: Truck) => {
    if (
      !confirm(
        `Are you sure you want to approve truck ${truck.licensePlate} from ${truck.carrier.name}?`
      )
    ) {
      return;
    }

    setIsSubmitting(true);

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error("Failed to get CSRF token. Please try again.");
        return;
      }

      const response = await fetch(`/api/trucks/${truck.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          action: "APPROVE",
        }),
        credentials: "include",
      });

      if (response.ok) {
        toast.success(`Truck ${truck.licensePlate} approved successfully!`);
        // Remove truck from list
        setTrucks((prev) => prev.filter((t) => t.id !== truck.id));
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(
          `Failed to approve truck: ${error.error || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error approving truck:", error);
      toast.error("Failed to approve truck. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle truck rejection (open modal)
   */
  const handleReject = (truck: Truck) => {
    setSelectedTruck(truck);
    setRejectionReason("");
  };

  /**
   * Submit rejection
   */
  const submitRejection = async () => {
    if (!selectedTruck) return;

    if (!rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setIsSubmitting(true);

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        toast.error("Failed to get CSRF token. Please try again.");
        return;
      }

      const response = await fetch(`/api/trucks/${selectedTruck.id}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          action: "REJECT",
          reason: rejectionReason.trim(),
        }),
        credentials: "include",
      });

      if (response.ok) {
        toast.success(`Truck ${selectedTruck.licensePlate} rejected.`);
        setTrucks((prev) => prev.filter((t) => t.id !== selectedTruck.id));
        setSelectedTruck(null);
        setRejectionReason("");
        router.refresh();
      } else {
        const error = await response.json();
        toast.error(
          `Failed to reject truck: ${error.error || "Unknown error"}`
        );
      }
    } catch (error) {
      console.error("Error rejecting truck:", error);
      toast.error("Failed to reject truck. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className={`cursor-pointer rounded-lg border-2 bg-white p-4 shadow ${
            statusFilter === "PENDING"
              ? "border-yellow-500"
              : "border-transparent"
          }`}
          onClick={() => handleStatusChange("PENDING")}
        >
          <div className="text-sm text-gray-600">Pending Approval</div>
          <div className="mt-1 text-2xl font-bold text-yellow-600">
            {statistics.pending}
          </div>
        </div>
        <div
          className={`cursor-pointer rounded-lg border-2 bg-white p-4 shadow ${
            statusFilter === "APPROVED"
              ? "border-green-500"
              : "border-transparent"
          }`}
          onClick={() => handleStatusChange("APPROVED")}
        >
          <div className="text-sm text-gray-600">Approved</div>
          <div className="mt-1 text-2xl font-bold text-green-600">
            {statistics.approved}
          </div>
        </div>
        <div
          className={`cursor-pointer rounded-lg border-2 bg-white p-4 shadow ${
            statusFilter === "REJECTED"
              ? "border-red-500"
              : "border-transparent"
          }`}
          onClick={() => handleStatusChange("REJECTED")}
        >
          <div className="text-sm text-gray-600">Rejected</div>
          <div className="mt-1 text-2xl font-bold text-red-600">
            {statistics.rejected}
          </div>
        </div>
      </div>

      {/* Status Filter */}
      <div className="rounded-lg bg-white p-6 shadow">
        <label
          htmlFor="status"
          className="mb-2 block text-sm font-medium text-gray-700"
        >
          Filter by Status
        </label>
        <select
          id="status"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
          className="w-full max-w-xs rounded-lg border border-gray-300 px-4 py-2 focus:border-transparent focus:ring-2 focus:ring-blue-500"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status.value} value={status.value}>
              {status.label}
            </option>
          ))}
        </select>
      </div>

      {/* Trucks Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Truck
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Carrier
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Specs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  GPS
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Submitted
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {trucks.map((truck) => (
                <tr key={truck.id} className="hover:bg-gray-50">
                  {/* Truck */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {truck.licensePlate}
                      </div>
                      <div className="text-xs text-gray-500">
                        {truck.truckType.replace(/_/g, " ")}
                      </div>
                    </div>
                  </td>

                  {/* Carrier */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-900">
                        {truck.carrier.name}
                      </div>
                      {truck.carrier.isVerified && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                          <svg
                            className="h-3 w-3"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                          Verified
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Specs */}
                  <td className="px-6 py-4">
                    <div className="flex flex-col text-sm">
                      <div>Capacity: {truck.capacity.toLocaleString()} kg</div>
                      {truck.volume && (
                        <div className="text-xs text-gray-500">
                          Volume: {truck.volume} m³
                        </div>
                      )}
                      {truck.currentCity && (
                        <div className="text-xs text-gray-500">
                          Location: {truck.currentCity}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* GPS */}
                  <td className="px-6 py-4">
                    {truck.imei ? (
                      <div className="flex flex-col text-sm">
                        <span className="font-medium text-green-600">
                          GPS Registered
                        </span>
                        <span className="font-mono text-xs text-gray-500">
                          {truck.imei}
                        </span>
                        {truck.gpsProvider && (
                          <span className="text-xs text-gray-400">
                            {truck.gpsProvider}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-sm text-gray-400">No GPS</span>
                    )}
                  </td>

                  {/* Submitted */}
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
                    {formatDate(truck.createdAt)}
                  </td>

                  {/* Status */}
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-semibold ${getApprovalStatusColor(
                        truck.approvalStatus
                      )}`}
                    >
                      {truck.approvalStatus}
                    </span>
                    {truck.rejectionReason && (
                      <div className="mt-1 max-w-xs text-xs text-red-600">
                        {truck.rejectionReason}
                      </div>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="px-6 py-4 text-sm font-medium whitespace-nowrap">
                    <Link
                      href={`/admin/trucks/${truck.id}`}
                      className="mr-3 text-blue-600 hover:text-blue-900"
                    >
                      View Details
                    </Link>
                    {truck.approvalStatus === "PENDING" && (
                      <>
                        <button
                          onClick={() => handleApprove(truck)}
                          disabled={isSubmitting}
                          className="mr-3 text-green-600 hover:text-green-900 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(truck)}
                          disabled={isSubmitting}
                          className="text-red-600 hover:text-red-900 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}

              {trucks.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-6 py-12 text-center text-gray-500"
                  >
                    {statusFilter === "PENDING"
                      ? "No trucks pending approval."
                      : `No ${statusFilter.toLowerCase()} trucks found.`}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-gray-200 bg-gray-50 px-6 py-4">
            <div className="text-sm text-gray-700">
              Showing{" "}
              <span className="font-medium">
                {(pagination.page - 1) * pagination.limit + 1}
              </span>{" "}
              to{" "}
              <span className="font-medium">
                {Math.min(pagination.page * pagination.limit, pagination.total)}
              </span>{" "}
              of <span className="font-medium">{pagination.total}</span> trucks
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange(pagination.page - 1)}
                disabled={pagination.page === 1}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-4 py-2 text-sm text-gray-700">
                Page {pagination.page} of {pagination.pages}
              </span>
              <button
                onClick={() => handlePageChange(pagination.page + 1)}
                disabled={pagination.page === pagination.pages}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Rejection Modal */}
      {selectedTruck && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
            <div className="p-6">
              <h3 className="mb-2 text-lg font-semibold text-gray-900">
                Reject Truck
              </h3>
              <div className="mb-4 rounded bg-gray-50 p-3 text-sm">
                <div>
                  <strong>License Plate:</strong> {selectedTruck.licensePlate}
                </div>
                <div>
                  <strong>Carrier:</strong> {selectedTruck.carrier.name}
                </div>
                <div>
                  <strong>Type:</strong>{" "}
                  {selectedTruck.truckType.replace(/_/g, " ")}
                </div>
              </div>
              <p className="mb-4 text-sm text-gray-600">
                Please provide a reason for rejecting this truck. The carrier
                will be notified and can resubmit after fixing the issues.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={4}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-transparent focus:ring-2 focus:ring-red-500"
              />
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => {
                    setSelectedTruck(null);
                    setRejectionReason("");
                  }}
                  disabled={isSubmitting}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={submitRejection}
                  disabled={isSubmitting || !rejectionReason.trim()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Rejecting..." : "Reject Truck"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

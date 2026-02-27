/**
 * Truck Requests Client Component
 *
 * Phase 2 - Story 16.15: Shipper-Led Truck Matching
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCSRFToken } from "@/lib/csrfFetch";

interface TruckRequest {
  id: string;
  status: string;
  notes: string | null;
  offeredRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  load: {
    id: string;
    referenceNumber: string;
    status: string;
    weight: number;
    truckType: string;
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
  };
  truck: {
    id: string;
    plateNumber: string;
    truckType: string;
    capacity: number;
    carrier: {
      id: string;
      name: string;
      isVerified: boolean;
      phone?: string;
    };
  };
  requestedBy: {
    id: string;
    name: string;
  } | null;
}

interface Props {
  requests: TruckRequest[];
}

type StatusFilter =
  | "all"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export default function TruckRequestsClient({
  requests: initialRequests,
}: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState<TruckRequest[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredRequests =
    statusFilter === "all"
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  const handleCancel = async (requestId: string) => {
    if (!confirm("Are you sure you want to cancel this request?")) return;

    setLoading(requestId);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/truck-requests/${requestId}`, {
        method: "DELETE",
        credentials: "include",
        headers: {
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel request");
      }

      setRequests(requests.filter((r) => r.id !== requestId));
      router.refresh();
    } catch (err) {
      // L42 FIX: Proper error handling without any
      setError(err instanceof Error ? err.message : "Failed to cancel request");
    } finally {
      setLoading(null);
    }
  };

  // Status colors from StatusBadge.tsx (source of truth)
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      APPROVED: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      REJECTED: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      EXPIRED: "bg-gray-500/10 text-gray-600 dark:text-gray-400",
      CANCELLED: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    };
    return styles[status] || "bg-slate-500/10 text-slate-600";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const statusCounts = {
    all: requests.length,
    PENDING: requests.filter((r) => r.status === "PENDING").length,
    APPROVED: requests.filter((r) => r.status === "APPROVED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
    EXPIRED: requests.filter((r) => r.status === "EXPIRED").length,
    CANCELLED: requests.filter((r) => r.status === "CANCELLED").length,
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-sm text-red-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            "all",
            "PENDING",
            "APPROVED",
            "REJECTED",
            "EXPIRED",
            "CANCELLED",
          ] as StatusFilter[]
        ).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
              statusFilter === status
                ? "bg-teal-600 text-white"
                : "bg-teal-700/10 text-slate-700 hover:bg-teal-700/20 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
            }`}
          >
            {status === "all" ? "All" : status} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow dark:border-slate-700 dark:bg-slate-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900/30">
            <svg
              className="h-8 w-8 text-teal-600 dark:text-teal-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-800 dark:text-white">
            {statusFilter === "all"
              ? "No Truck Requests Yet"
              : `No ${statusFilter} Requests`}
          </h3>
          <p className="mx-auto mb-6 max-w-sm text-slate-500 dark:text-slate-400">
            {statusFilter === "all"
              ? "When you request trucks from the loadboard, they'll appear here for tracking."
              : `You don't have any ${statusFilter.toLowerCase()} requests at the moment.`}
          </p>
          {statusFilter === "all" && (
            <a
              href="/shipper/loadboard?tab=SEARCH_TRUCKS"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2.5 font-medium text-white transition-colors hover:bg-teal-700"
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
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Search Trucks
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="rounded-lg border border-slate-200 bg-white p-6 shadow dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(
                        request.status
                      )}`}
                    >
                      {request.status}
                    </span>
                    {request.status === "PENDING" && (
                      <span className="text-sm text-orange-600 dark:text-orange-400">
                        Expires in {getTimeRemaining(request.expiresAt)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-400">
                    Requested on {formatDate(request.createdAt)}
                  </p>
                </div>
                {request.status === "PENDING" && (
                  <button
                    onClick={() => handleCancel(request.id)}
                    disabled={loading === request.id}
                    className="rounded-lg border border-red-200 px-3 py-1 text-sm text-red-600 hover:bg-red-50 hover:text-red-800 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-900/30"
                  >
                    {loading === request.id ? "Cancelling..." : "Cancel"}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Load Info */}
                <div className="rounded-lg bg-teal-50 p-4 dark:bg-slate-700">
                  <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Load
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-slate-700 dark:text-white">
                      {request.load.referenceNumber ||
                        request.load.id.slice(-8)}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      {request.load.pickupCity} → {request.load.deliveryCity}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      {request.load.weight.toLocaleString()} kg •{" "}
                      {request.load.truckType}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      Pickup:{" "}
                      {new Date(request.load.pickupDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Truck Info */}
                <div className="rounded-lg bg-teal-600/10 p-4 dark:bg-blue-900/20">
                  <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-blue-200 dark:text-slate-200">
                    Truck
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-slate-700 dark:text-white">
                      {request.truck.plateNumber}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      {request.truck.truckType} •{" "}
                      {request.truck.capacity.toLocaleString()} kg
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      Carrier: {request.truck.carrier.name}
                      {request.truck.carrier.isVerified && (
                        <span className="ml-1 text-green-600">✓</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                <div className="flex flex-wrap gap-4 text-sm">
                  {request.offeredRate && (
                    <div>
                      <span className="text-slate-700 dark:text-slate-400">
                        Offered Rate:
                      </span>{" "}
                      <span className="font-medium text-slate-700 dark:text-white">
                        {request.offeredRate.toLocaleString()} ETB
                      </span>
                    </div>
                  )}
                  {request.notes && (
                    <div className="flex-1">
                      <span className="text-slate-700 dark:text-slate-400">
                        Notes:
                      </span>{" "}
                      <span className="text-slate-700 dark:text-white">
                        {request.notes}
                      </span>
                    </div>
                  )}
                </div>
                {request.respondedAt && (
                  <p className="mt-2 text-sm text-slate-700 dark:text-slate-400">
                    Responded on {formatDate(request.respondedAt)}
                  </p>
                )}
              </div>

              {/* Contact to Negotiate - Shown when APPROVED */}
              {request.status === "APPROVED" && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4 dark:border-emerald-800 dark:from-emerald-900/20 dark:to-teal-900/20">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-800">
                      <svg
                        className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">
                        Contact to Negotiate Price
                      </h4>
                      <p className="mt-1 text-sm text-emerald-700 dark:text-emerald-300">
                        Request approved! Contact the carrier directly to
                        negotiate the freight price.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {request.truck.carrier.phone && (
                          <>
                            <a
                              href={`tel:${request.truck.carrier.phone}`}
                              className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
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
                                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                />
                              </svg>
                              Call
                            </a>
                            <a
                              href={`sms:${request.truck.carrier.phone}`}
                              className="inline-flex items-center gap-2 rounded-lg border border-emerald-300 bg-white px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50"
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
                                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                                />
                              </svg>
                              Message
                            </a>
                          </>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                        {request.truck.carrier.name} •{" "}
                        {request.truck.carrier.phone || "Contact via platform"}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

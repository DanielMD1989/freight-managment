/**
 * Load Requests Client Component
 *
 * Shipper view for incoming load requests from carriers
 * Allows shippers to accept or reject carrier requests
 */

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/csrfFetch";

interface LoadRequest {
  id: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
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
  };
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
    phone?: string;
  };
  requestedBy: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
}

interface Props {
  requests: LoadRequest[];
}

type StatusFilter = "all" | "PENDING" | "APPROVED" | "REJECTED";

export default function LoadRequestsClient({
  requests: initialRequests,
}: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState<LoadRequest[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>(
    {}
  );
  const [showResponseForm, setShowResponseForm] = useState<string | null>(null);

  const filteredRequests =
    statusFilter === "all"
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  const handleRespond = async (requestId: string, approve: boolean) => {
    setLoading(requestId);
    setError(null);

    try {
      const response = await csrfFetch(
        `/api/load-requests/${requestId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: approve ? "APPROVE" : "REJECT",
            responseNotes: responseNotes[requestId] || undefined,
          }),
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to respond to request");
      }

      // Update local state
      setRequests(
        requests.map((r) =>
          r.id === requestId
            ? {
                ...r,
                status: approve ? "APPROVED" : "REJECTED",
                respondedAt: new Date().toISOString(),
              }
            : r
        )
      );
      setShowResponseForm(null);
      router.refresh();
    } catch (err) {
      // L41 FIX: Proper error handling without any
      setError(
        err instanceof Error ? err.message : "Failed to process request"
      );
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

  const pendingCount = requests.filter((r) => r.status === "PENDING").length;

  const statusCounts = {
    all: requests.length,
    PENDING: pendingCount,
    APPROVED: requests.filter((r) => r.status === "APPROVED").length,
    REJECTED: requests.filter((r) => r.status === "REJECTED").length,
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

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/30">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-yellow-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium text-yellow-800 dark:text-yellow-200">
              You have {pendingCount} pending carrier request
              {pendingCount > 1 ? "s" : ""} awaiting your response
            </span>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(["PENDING", "APPROVED", "REJECTED", "all"] as StatusFilter[]).map(
          (status) => (
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
          )
        )}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="rounded-lg border border-slate-200 bg-white p-12 text-center shadow dark:border-slate-700 dark:bg-slate-800">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
            <svg
              className="h-8 w-8 text-blue-600 dark:text-blue-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-800 dark:text-white">
            {statusFilter === "all"
              ? "No Carrier Requests Yet"
              : `No ${statusFilter} Requests`}
          </h3>
          <p className="mx-auto mb-6 max-w-sm text-slate-500 dark:text-slate-400">
            {statusFilter === "all"
              ? "When carriers apply to haul your loads, their requests will appear here for your review."
              : `You don't have any ${statusFilter.toLowerCase()} requests at the moment.`}
          </p>
          {statusFilter === "all" && (
            <Link
              href="/shipper/loads"
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
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
              View My Loads
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className={`rounded-lg border bg-white shadow dark:bg-slate-800 ${
                request.status === "PENDING"
                  ? "border-yellow-300 dark:border-yellow-700"
                  : "border-slate-200 dark:border-slate-700"
              } p-6`}
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
                      <span className="text-sm font-medium text-orange-600 dark:text-orange-400">
                        Expires in {getTimeRemaining(request.expiresAt)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-700 dark:text-slate-400">
                    Received {formatDate(request.createdAt)}
                  </p>
                </div>

                {/* Response Actions */}
                {request.status === "PENDING" && (
                  <div className="flex gap-2">
                    {showResponseForm === request.id ? (
                      <button
                        onClick={() => setShowResponseForm(null)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-700 hover:bg-teal-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200/70"
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRespond(request.id, false)}
                          disabled={loading === request.id}
                          className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:hover:bg-red-900/30"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleRespond(request.id, true)}
                          disabled={loading === request.id}
                          className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {loading === request.id ? "Processing..." : "Accept"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Response Form */}
              {showResponseForm === request.id && (
                <div className="mb-4 rounded-lg bg-teal-50 p-4 dark:bg-slate-700">
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Response Notes (Optional)
                  </label>
                  <textarea
                    value={responseNotes[request.id] || ""}
                    onChange={(e) =>
                      setResponseNotes({
                        ...responseNotes,
                        [request.id]: e.target.value,
                      })
                    }
                    rows={2}
                    placeholder="Add any notes for the carrier..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-600 dark:text-white"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleRespond(request.id, false)}
                      disabled={loading === request.id}
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleRespond(request.id, true)}
                      disabled={loading === request.id}
                      className="rounded-lg bg-green-600 px-4 py-2 text-sm text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading === request.id ? "Processing..." : "Accept"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                {/* Load Info */}
                <div className="rounded-lg bg-teal-50 p-4 dark:bg-slate-700">
                  <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                    Your Load
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

                {/* Carrier Info */}
                <div className="rounded-lg bg-teal-600/10 p-4 dark:bg-blue-900/20">
                  <h3 className="mb-2 text-sm font-medium text-slate-700 dark:text-blue-200">
                    Carrier
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-slate-700 dark:text-white">
                      {request.carrier.name}
                      {request.carrier.isVerified && (
                        <span className="ml-1 text-green-600">✓ Verified</span>
                      )}
                    </p>
                    {request.requestedBy && (
                      <>
                        <p className="text-slate-700 dark:text-slate-400">
                          Contact: {request.requestedBy.name}
                        </p>
                        <p className="text-slate-700 dark:text-slate-400">
                          {request.requestedBy.email}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Truck Info */}
                <div className="rounded-lg bg-green-50 p-4 dark:bg-green-900/20">
                  <h3 className="mb-2 text-sm font-medium text-green-800 dark:text-green-200">
                    Their Truck
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="font-medium text-slate-700 dark:text-white">
                      {request.truck.plateNumber}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      {request.truck.truckType}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      Capacity: {request.truck.capacity.toLocaleString()} kg
                    </p>
                  </div>
                </div>
              </div>

              {/* Rate and Notes */}
              {(request.proposedRate || request.notes) && (
                <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700">
                  <div className="flex flex-wrap gap-4 text-sm">
                    {request.proposedRate && (
                      <div className="rounded-lg bg-yellow-50 px-3 py-2 dark:bg-yellow-900/20">
                        <span className="font-medium text-yellow-800 dark:text-yellow-200">
                          Proposed Rate: {request.proposedRate.toLocaleString()}{" "}
                          ETB
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
                </div>
              )}

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
                        {(request.carrier.phone ||
                          request.requestedBy?.phone) && (
                          <>
                            <a
                              href={`tel:${request.carrier.phone || request.requestedBy?.phone}`}
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
                              href={`sms:${request.carrier.phone || request.requestedBy?.phone}`}
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
                        {request.requestedBy?.email && (
                          <a
                            href={`mailto:${request.requestedBy.email}`}
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
                                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                              />
                            </svg>
                            Email
                          </a>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-emerald-600 dark:text-emerald-400">
                        {request.carrier.name} •{" "}
                        {request.carrier.phone ||
                          request.requestedBy?.phone ||
                          request.requestedBy?.email ||
                          "Contact via platform"}
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

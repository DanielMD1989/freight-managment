/**
 * Request Detail Client Component (Shipper View)
 *
 * Sprint 18 - Story 18.6: Shipper views request details
 *
 * Shows full request details with actions for approving/rejecting
 * and links to track approved loads
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/csrfFetch";

interface RequestData {
  id: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
  responseNotes: string | null;
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
    deliveryDate: string | null;
    pickupAddress: string | null;
    deliveryAddress: string | null;
    cargoDescription: string | null;
    isAssigned: boolean;
    assignedTruck: {
      id: string;
      licensePlate: string;
      truckType: string;
    } | null;
  };
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
    phone: string | null;
    email: string | null;
  };
  requestedBy: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
  } | null;
}

interface Props {
  request: RequestData;
}

export default function RequestDetailClient({ request }: Props) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-amber-100 text-amber-800 border-amber-200",
      APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
      REJECTED: "bg-rose-100 text-rose-800 border-rose-200",
      EXPIRED: "bg-slate-100 text-slate-800 border-slate-200",
      CANCELLED: "bg-slate-100 text-slate-800 border-slate-200",
    };
    return styles[status] || "bg-slate-100 text-slate-800 border-slate-200";
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

  const handleApprove = async () => {
    if (request.load.isAssigned) {
      alert("This load has already been assigned to another truck.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await csrfFetch(
        `/api/load-requests/${request.id}/respond`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "APPROVE",
          }),
        }
      );

      if (response.ok) {
        router.refresh();
        router.push(`/shipper/loads/${request.load.id}`);
      } else {
        const error = await response.json();
        alert(error.error || "Failed to approve request");
      }
    } catch (error) {
      console.error("Error approving request:", error);
      alert("Failed to approve request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    setIsLoading(true);
    try {
      const response = await csrfFetch(
        `/api/load-requests/${request.id}/respond`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "REJECT",
            responseNotes: rejectReason || undefined,
          }),
        }
      );

      if (response.ok) {
        setShowRejectModal(false);
        router.refresh();
      } else {
        const error = await response.json();
        alert(error.error || "Failed to reject request");
      }
    } catch (error) {
      console.error("Error rejecting request:", error);
      alert("Failed to reject request");
    } finally {
      setIsLoading(false);
    }
  };

  const handleViewLoad = () => {
    router.push(`/shipper/loads/${request.load.id}`);
  };

  const isPending = request.status === "PENDING";
  const isApproved = request.status === "APPROVED";
  const isRejected = request.status === "REJECTED";
  const isExpired = new Date(request.expiresAt) < new Date();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="rounded-lg p-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <svg
              className="h-5 w-5 text-slate-600 dark:text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
              Request Details
            </h1>
            <p className="text-slate-500 dark:text-slate-400">
              From {request.carrier.name}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-4 py-2 text-sm font-semibold ${getStatusBadge(request.status)}`}
        >
          {request.status}
        </span>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left Column - Load & Request Info */}
        <div className="space-y-6 lg:col-span-2">
          {/* Status Alert */}
          {isPending && !isExpired && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 dark:bg-amber-800">
                  <svg
                    className="h-5 w-5 text-amber-600 dark:text-amber-300"
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
                </div>
                <div>
                  <p className="font-semibold text-amber-800 dark:text-amber-200">
                    Awaiting Your Response
                  </p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    Expires in {getTimeRemaining(request.expiresAt)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {isPending && isExpired && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-800">
              <p className="text-slate-600 dark:text-slate-400">
                This request has expired.
              </p>
            </div>
          )}

          {isApproved && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-900/20">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-800">
                    <svg
                      className="h-5 w-5 text-emerald-600 dark:text-emerald-300"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                  <div>
                    <p className="font-semibold text-emerald-800 dark:text-emerald-200">
                      Request Approved
                    </p>
                    <p className="text-sm text-emerald-600 dark:text-emerald-400">
                      Load assigned to {request.truck.licensePlate}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleViewLoad}
                  className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white transition-colors hover:bg-emerald-700"
                >
                  Track Load
                </button>
              </div>
            </div>
          )}

          {isRejected && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-800 dark:bg-rose-900/20">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-100 dark:bg-rose-800">
                  <svg
                    className="h-5 w-5 text-rose-600 dark:text-rose-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-rose-800 dark:text-rose-200">
                    Request Rejected
                  </p>
                  {request.responseNotes && (
                    <p className="text-sm text-rose-600 dark:text-rose-400">
                      Reason: {request.responseNotes}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Load Information */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-teal-50/30 px-6 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Load Information
              </h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Reference
                  </p>
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {request.load.referenceNumber}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    request.load.status === "POSTED"
                      ? "bg-blue-100 text-blue-800"
                      : request.load.status === "ASSIGNED"
                        ? "bg-teal-100 text-teal-800"
                        : request.load.status === "IN_TRANSIT"
                          ? "bg-indigo-100 text-indigo-800"
                          : request.load.status === "DELIVERED"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-slate-100 text-slate-800"
                  }`}
                >
                  {request.load.status}
                </span>
              </div>

              {/* Route */}
              <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-700/50">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center">
                    <div className="h-3 w-3 rounded-full bg-teal-500" />
                    <div className="h-12 w-0.5 bg-slate-300 dark:bg-slate-600" />
                    <div className="h-3 w-3 rounded-full bg-rose-500" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-xs tracking-wider text-slate-500 uppercase dark:text-slate-400">
                        Pickup
                      </p>
                      <p className="font-semibold text-slate-800 dark:text-white">
                        {request.load.pickupCity}
                      </p>
                      {request.load.pickupAddress && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {request.load.pickupAddress}
                        </p>
                      )}
                      <p className="text-sm text-slate-500">
                        {formatDate(request.load.pickupDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs tracking-wider text-slate-500 uppercase dark:text-slate-400">
                        Delivery
                      </p>
                      <p className="font-semibold text-slate-800 dark:text-white">
                        {request.load.deliveryCity}
                      </p>
                      {request.load.deliveryAddress && (
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          {request.load.deliveryAddress}
                        </p>
                      )}
                      {request.load.deliveryDate && (
                        <p className="text-sm text-slate-500">
                          {formatDate(request.load.deliveryDate)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Load Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Weight
                  </p>
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {request.load.weight.toLocaleString()} kg
                  </p>
                </div>
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Truck Type
                  </p>
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {request.load.truckType}
                  </p>
                </div>
                {request.proposedRate && (
                  <div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Proposed Rate
                    </p>
                    <p className="font-semibold text-amber-600">
                      {request.proposedRate.toLocaleString()} ETB
                    </p>
                  </div>
                )}
              </div>

              {request.load.cargoDescription && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Cargo Description
                  </p>
                  <p className="text-slate-800 dark:text-white">
                    {request.load.cargoDescription}
                  </p>
                </div>
              )}

              {request.notes && (
                <div className="rounded-lg bg-amber-50 p-4 dark:bg-amber-900/20">
                  <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                    Carrier Notes:
                  </p>
                  <p className="text-amber-800 dark:text-amber-200">
                    {request.notes}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Carrier & Truck Info */}
        <div className="space-y-6">
          {/* Carrier Information */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-blue-50/30 px-6 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Carrier
              </h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900">
                  <span className="text-lg font-bold text-blue-600 dark:text-blue-300">
                    {request.carrier.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <p className="flex items-center gap-2 font-semibold text-slate-800 dark:text-white">
                    {request.carrier.name}
                    {request.carrier.isVerified && (
                      <span className="inline-flex items-center rounded bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                        Verified
                      </span>
                    )}
                  </p>
                </div>
              </div>

              {request.carrier.phone && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Phone
                  </p>
                  <p className="font-medium text-slate-800 dark:text-white">
                    {request.carrier.phone}
                  </p>
                </div>
              )}
              {request.carrier.email && (
                <div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Email
                  </p>
                  <p className="font-medium text-slate-800 dark:text-white">
                    {request.carrier.email}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Truck Information */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50/30 px-6 py-4 dark:border-slate-700 dark:from-slate-800 dark:to-slate-800">
              <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                Truck Offered
              </h2>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100 dark:bg-emerald-900">
                  <svg
                    className="h-6 w-6 text-emerald-600 dark:text-emerald-300"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 17h8M8 17v-4m8 4v-4m-8 4H6a2 2 0 01-2-2V9a2 2 0 012-2h1V5a2 2 0 012-2h6a2 2 0 012 2v2h1a2 2 0 012 2v6a2 2 0 01-2 2h-2"
                    />
                  </svg>
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white">
                    {request.truck.licensePlate}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    {request.truck.truckType}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Capacity
                </p>
                <p className="font-medium text-slate-800 dark:text-white">
                  {request.truck.capacity.toLocaleString()} kg
                </p>
              </div>
            </div>
          </div>

          {/* Requested By */}
          {request.requestedBy && (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
                  Requested By
                </h2>
              </div>
              <div className="space-y-2 p-6">
                <p className="font-medium text-slate-800 dark:text-white">
                  {request.requestedBy.name}
                </p>
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {request.requestedBy.email}
                </p>
                {request.requestedBy.phone && (
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    {request.requestedBy.phone}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-500">
                  Submitted {formatDate(request.createdAt)}
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          {isPending && !isExpired && (
            <div className="space-y-3">
              <button
                onClick={handleApprove}
                disabled={isLoading || request.load.isAssigned}
                className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 px-4 py-3 font-semibold text-white transition-all hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoading
                  ? "Processing..."
                  : request.load.isAssigned
                    ? "Load Already Assigned"
                    : "Approve Request"}
              </button>
              <button
                onClick={() => setShowRejectModal(true)}
                disabled={isLoading}
                className="w-full rounded-xl border border-rose-300 bg-white px-4 py-3 font-semibold text-rose-600 transition-all hover:bg-rose-50 disabled:opacity-50 dark:border-rose-700 dark:bg-slate-700 dark:text-rose-400 dark:hover:bg-rose-900/20"
              >
                Reject Request
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-800">
            <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-800 dark:text-white">
                Reject Request
              </h3>
            </div>
            <div className="space-y-4 p-6">
              <p className="text-slate-600 dark:text-slate-400">
                Are you sure you want to reject this request from{" "}
                {request.carrier.name}?
              </p>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Reason (optional)
                </label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Provide a reason for rejection..."
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-800 focus:border-transparent focus:ring-2 focus:ring-rose-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  rows={3}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 bg-slate-50 px-6 py-4 dark:bg-slate-700/50">
              <button
                onClick={() => setShowRejectModal(false)}
                disabled={isLoading}
                className="px-4 py-2 font-medium text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                disabled={isLoading}
                className="rounded-lg bg-rose-600 px-4 py-2 font-medium text-white hover:bg-rose-700 disabled:opacity-50"
              >
                {isLoading ? "Rejecting..." : "Reject"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

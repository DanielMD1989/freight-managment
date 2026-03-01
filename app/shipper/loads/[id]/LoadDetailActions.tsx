"use client";

/**
 * Load Detail Actions Component
 *
 * Status-aware action buttons for shipper load detail page.
 * Handles POD verification, load cancellation, and navigation.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { csrfFetch } from "@/lib/csrfFetch";
import toast from "react-hot-toast";

interface LoadDetailActionsProps {
  loadId: string;
  status: string;
  podUrl: string | null;
  podSubmitted: boolean;
  podVerified: boolean;
  podVerifiedAt: Date | string | null;
  tripId: string | null;
  pickupCity: string | null;
  deliveryCity: string | null;
}

export default function LoadDetailActions({
  loadId,
  status,
  podUrl,
  podSubmitted,
  podVerified,
  podVerifiedAt,
  tripId,
  pickupCity,
  deliveryCity,
}: LoadDetailActionsProps) {
  const router = useRouter();
  const [verifyingPod, setVerifyingPod] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const handleVerifyPod = async () => {
    setVerifyingPod(true);
    try {
      const response = await csrfFetch(`/api/loads/${loadId}/pod`, {
        method: "PUT",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to verify POD");
      }

      toast.success("POD verified — settlement processing");
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to verify POD";
      toast.error(message);
    } finally {
      setVerifyingPod(false);
    }
  };

  const handleCancelLoad = async () => {
    setCancelling(true);
    try {
      const response = await csrfFetch(`/api/loads/${loadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "CANCELLED",
          reason: cancelReason || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel load");
      }

      toast.success("Load cancelled");
      setShowCancelConfirm(false);
      router.refresh();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to cancel load";
      toast.error(message);
    } finally {
      setCancelling(false);
    }
  };

  const canCancel = status === "ASSIGNED" || status === "PICKUP_PENDING";
  const showViewTrip =
    tripId &&
    [
      "ASSIGNED",
      "PICKUP_PENDING",
      "IN_TRANSIT",
      "DELIVERED",
      "COMPLETED",
    ].includes(status);
  const showTrackOnMap = status === "IN_TRANSIT";
  const showFindTrucks = status === "POSTED";
  const showEditLoad = status === "DRAFT" || status === "POSTED";
  const showPodSection = status === "DELIVERED" && podSubmitted;

  return (
    <div className="rounded-lg bg-white p-6 shadow">
      <h2 className="mb-4 text-xl font-semibold text-gray-900">Actions</h2>
      <div className="space-y-3">
        {/* POD Verification Section */}
        {showPodSection && (
          <div className="mb-4">
            {podVerified ? (
              <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3">
                <svg
                  className="h-5 w-5 text-emerald-600"
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
                <div>
                  <span className="font-medium text-emerald-800">
                    POD Verified
                  </span>
                  {podVerifiedAt && (
                    <span className="ml-2 text-sm text-emerald-600">
                      {new Date(podVerifiedAt).toLocaleDateString("en-US", {
                        dateStyle: "medium",
                      })}
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {podUrl && (
                  <a
                    href={podUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-center text-sm font-medium text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    View POD Document
                  </a>
                )}
                <button
                  onClick={handleVerifyPod}
                  disabled={verifyingPod}
                  className="block w-full rounded-lg bg-emerald-600 px-4 py-2 text-center text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                >
                  {verifyingPod ? "Verifying..." : "Verify POD"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Find Trucks */}
        {showFindTrucks && (
          <Link
            href={`/shipper/loadboard?tab=SEARCH_TRUCKS&origin=${encodeURIComponent(pickupCity || "")}&destination=${encodeURIComponent(deliveryCity || "")}`}
            className="block w-full rounded-lg bg-blue-600 px-4 py-2 text-center text-white transition-colors hover:bg-blue-700"
          >
            Find Trucks
          </Link>
        )}

        {/* Edit Load */}
        {showEditLoad && (
          <Link
            href={`/shipper/loads/${loadId}/edit`}
            className="block w-full rounded-lg bg-gray-100 px-4 py-2 text-center text-gray-700 transition-colors hover:bg-gray-200"
          >
            Edit Load
          </Link>
        )}

        {/* View Trip */}
        {showViewTrip && (
          <Link
            href={`/shipper/trips/${tripId}`}
            className="block w-full rounded-lg bg-indigo-600 px-4 py-2 text-center text-white transition-colors hover:bg-indigo-700"
          >
            View Trip
          </Link>
        )}

        {/* Track on Map */}
        {showTrackOnMap && (
          <Link
            href={`/shipper/map?loadId=${loadId}`}
            className="block w-full rounded-lg bg-teal-600 px-4 py-2 text-center text-white transition-colors hover:bg-teal-700"
          >
            Track on Map
          </Link>
        )}

        {/* Cancel Load */}
        {canCancel && !showCancelConfirm && (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="block w-full rounded-lg border border-red-300 px-4 py-2 text-center text-red-600 transition-colors hover:bg-red-50"
          >
            Cancel Load
          </button>
        )}

        {/* Cancel Confirmation */}
        {showCancelConfirm && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="mb-3 text-sm font-medium text-red-800">
              Are you sure you want to cancel this load?
            </p>
            <textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Reason for cancellation (optional)"
              rows={2}
              className="mb-3 w-full rounded-lg border border-red-200 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2">
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-50"
              >
                Keep Load
              </button>
              <button
                onClick={handleCancelLoad}
                disabled={cancelling}
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700 disabled:opacity-50"
              >
                {cancelling ? "Cancelling..." : "Confirm Cancel"}
              </button>
            </div>
          </div>
        )}

        {/* Back to List */}
        <Link
          href="/shipper/loads"
          className="block w-full rounded-lg border border-gray-300 px-4 py-2 text-center text-gray-700 transition-colors hover:bg-gray-50"
        >
          Back to List
        </Link>
      </div>
    </div>
  );
}

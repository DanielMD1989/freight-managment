/**
 * Trip Detail Client Component
 *
 * Sprint 18 - Story 18.3 & 18.4: Trip management and POD upload
 *
 * Displays trip details with status-based actions
 * Updated to use proper Trip model and /api/trips endpoint
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { csrfFetch } from "@/lib/csrfFetch";
import StarRating from "@/components/StarRating";
import RatingModal from "@/components/RatingModal";
import TripChat from "@/components/TripChat";

interface Trip {
  id: string; // Trip ID
  loadId: string | null; // Associated Load ID (null for cancelled trips)
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
  pickupDockHours: string | null;
  deliveryDockHours: string | null;
  cargoDescription: string | null;
  safetyNotes: string | null;
  shipperContactName: string | null;
  shipperContactPhone: string | null;
  trackingEnabled: boolean;
  trackingUrl: string | null;
  tripProgressPercent: number | null;
  remainingDistanceKm: number | null;
  estimatedTripKm: number | null;
  shipper: {
    id: string;
    name: string;
    isVerified?: boolean;
  } | null;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
    carrier: {
      id: string;
      name: string;
    };
  } | null;
  driver?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    driverProfile?: {
      cdlNumber: string | null;
      isAvailable: boolean;
    } | null;
  } | null;
  driverId?: string | null;
  documents: {
    id: string;
    documentType: string;
    fileName: string;
    fileUrl: string;
    createdAt: string;
  }[];
  events: {
    id: string;
    eventType: string;
    description: string;
    createdAt: string;
  }[];
  // Trip-specific timestamps
  startedAt?: string | null;
  pickedUpAt?: string | null;
  deliveredAt?: string | null;
  completedAt?: string | null;
  // POD status
  podSubmitted: boolean;
  podVerified: boolean;
}

interface Props {
  trip: Trip;
  userId: string;
  /** True when viewer is an admin/super-admin (read-only chat access) */
  isAdmin?: boolean;
}

export default function TripDetailClient({
  trip: initialTrip,
  userId,
  isAdmin = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [trip, setTrip] = useState(initialTrip);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // POD upload removed — driver-only. Carrier views PODs via read-only section.

  // Delivery form state
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [receiverName, setReceiverName] = useState("");
  const [receiverPhone, setReceiverPhone] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");

  // Cancel modal state
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  // Driver assignment state (Task 19)
  const [availableDrivers, setAvailableDrivers] = useState<
    Array<{ id: string; firstName: string | null; lastName: string | null }>
  >([]);
  const [showDriverSelect, setShowDriverSelect] = useState(false);
  const [driverActionLoading, setDriverActionLoading] = useState(false);

  // Exception modal state
  const [showExceptionModal, setShowExceptionModal] = useState(false);
  const [exceptionReason, setExceptionReason] = useState("");

  // §12 Rating state
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [existingRating, setExistingRating] = useState<{
    stars: number;
    comment?: string | null;
  } | null>(null);

  useEffect(() => {
    if (trip.status === "DELIVERED" || trip.status === "COMPLETED") {
      fetch(`/api/trips/${trip.id}/rate`, { credentials: "include" })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.myRating) setExistingRating(data.myRating);
        })
        .catch(() => {});
    }
  }, [trip.id, trip.status]);

  // Trip progress state (for IN_TRANSIT — matches shipper W9 pattern)
  const [tripProgress, setTripProgress] = useState({
    percent: trip.tripProgressPercent || 0,
    remainingKm: trip.remainingDistanceKm,
    estimatedArrival: null as string | null,
  });

  const isActiveTrip = trip.status === "IN_TRANSIT";

  const fetchTripProgress = useCallback(async () => {
    if (!trip.loadId) return;
    try {
      const response = await fetch(`/api/loads/${trip.loadId}/progress`);
      if (response.ok) {
        const data = await response.json();
        setTripProgress({
          percent: data.progress?.percent || 0,
          remainingKm: data.progress?.remainingKm || null,
          estimatedArrival: data.progress?.estimatedArrival || null,
        });
      }
    } catch (error) {
      console.error("Failed to fetch trip progress:", error);
    }
  }, [trip.loadId]);

  useEffect(() => {
    if (isActiveTrip) {
      fetchTripProgress();
      const interval = setInterval(fetchTripProgress, 30000);
      return () => clearInterval(interval);
    }
  }, [isActiveTrip, fetchTripProgress]);

  // Auto-open POD upload modal if query param is present (only if POD not already submitted)
  // POD auto-open removed — driver handles POD upload now.

  const handleStatusChange = async (
    newStatus: string,
    additionalData?: Record<string, string>
  ) => {
    setLoading(true);
    setError(null);

    try {
      // Use the Trip API for status changes
      const response = await csrfFetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, ...additionalData }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update status");
      }

      // Refresh trip data
      router.refresh();
      setTrip((prev) => ({ ...prev, status: newStatus }));

      // Navigate based on new status
      if (newStatus === "PICKUP_PENDING" || newStatus === "IN_TRANSIT") {
        router.push("/carrier/trips?tab=active");
      } else if (newStatus === "DELIVERED") {
        setShowDeliveryModal(false);
        // POD upload is driver-only now — carrier just waits
      } else if (newStatus === "COMPLETED") {
        router.push("/carrier/trips?tab=completed");
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleMarkDelivered = () => {
    // Open delivery modal to collect receiver info
    setShowDeliveryModal(true);
  };

  const submitDelivery = async () => {
    await handleStatusChange("DELIVERED", {
      receiverName: receiverName || undefined,
      receiverPhone: receiverPhone || undefined,
      deliveryNotes: deliveryNotes || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Optional delivery fields
    } as any);
  };

  const handleCancelTrip = async () => {
    if (!cancelReason.trim()) {
      setError("Please provide a reason for cancellation");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await csrfFetch(`/api/trips/${trip.id}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to cancel trip");
      }

      setShowCancelModal(false);
      router.push("/carrier/trips");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  // handlePodUpload + finishPodUpload removed — driver-only POD upload.

  const getStatusBadge = (status: string) => {
    // For DELIVERED status, check POD sub-states
    if (status === "DELIVERED") {
      if (trip.podVerified) {
        return (
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
            POD Verified
          </span>
        );
      }
      if (trip.podSubmitted) {
        return (
          <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            POD Submitted
          </span>
        );
      }
    }

    const statusConfig: Record<
      string,
      { bg: string; text: string; label: string }
    > = {
      ASSIGNED: {
        bg: "bg-teal-100 dark:bg-teal-900",
        text: "text-teal-800 dark:text-teal-200",
        label: "Ready to Start",
      },
      PICKUP_PENDING: {
        bg: "bg-yellow-100 dark:bg-yellow-900",
        text: "text-yellow-800 dark:text-yellow-200",
        label: "Pickup Pending",
      },
      IN_TRANSIT: {
        bg: "bg-blue-100 dark:bg-blue-900",
        text: "text-blue-800 dark:text-blue-200",
        label: "In Transit",
      },
      DELIVERED: {
        bg: "bg-purple-100 dark:bg-purple-900",
        text: "text-purple-800 dark:text-purple-200",
        label: "POD Required",
      },
      COMPLETED: {
        bg: "bg-green-100 dark:bg-green-900",
        text: "text-green-800 dark:text-green-200",
        label: "Completed",
      },
      EXCEPTION: {
        bg: "bg-amber-100 dark:bg-amber-900",
        text: "text-amber-800 dark:text-amber-200",
        label: "Exception",
      },
      CANCELLED: {
        bg: "bg-red-100 dark:bg-red-900",
        text: "text-red-800 dark:text-red-200",
        label: "Cancelled",
      },
    };

    const config = statusConfig[status] || {
      bg: "bg-gray-100",
      text: "text-gray-800",
      label: status,
    };

    return (
      <span
        className={`rounded-full px-3 py-1 text-sm font-medium ${config.bg} ${config.text}`}
      >
        {config.label}
      </span>
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Task 19: driver assignment helpers
  const canAssignDriver =
    trip.status === "ASSIGNED" || trip.status === "PICKUP_PENDING";

  const fetchAvailableDrivers = async () => {
    try {
      const res = await fetch("/api/drivers?available=true&status=ACTIVE", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setAvailableDrivers(data.drivers ?? []);
      }
    } catch {
      /* non-critical */
    }
  };

  const handleAssignDriver = async (driverId: string) => {
    setDriverActionLoading(true);
    try {
      const res = await csrfFetch(`/api/trips/${trip.id}/assign-driver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ driverId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to assign driver");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Assign driver failed");
    } finally {
      setDriverActionLoading(false);
      setShowDriverSelect(false);
    }
  };

  const handleUnassignDriver = async () => {
    setDriverActionLoading(true);
    try {
      const res = await csrfFetch(`/api/trips/${trip.id}/unassign-driver`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to unassign driver");
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unassign driver failed");
    } finally {
      setDriverActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <button
            onClick={() => router.back()}
            className="mb-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          >
            ← Back to Trips
          </button>
          <h1 className="flex items-center gap-3 text-2xl font-bold text-gray-900 dark:text-white">
            {trip.referenceNumber}
            {getStatusBadge(trip.status)}
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            {trip.pickupCity} → {trip.deliveryCity}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-3">
          {trip.status === "ASSIGNED" && (
            <>
              <button
                onClick={() => handleStatusChange("PICKUP_PENDING")}
                disabled={loading}
                className="rounded-lg bg-[#1e9c99] px-6 py-2 font-medium text-white hover:bg-[#064d51] disabled:opacity-50"
              >
                {loading ? "Starting..." : "Start Trip"}
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="rounded-lg bg-red-50 px-6 py-2 font-medium text-red-600 hover:bg-red-100"
              >
                Cancel Trip
              </button>
            </>
          )}
          {trip.status === "PICKUP_PENDING" && (
            <>
              <button
                onClick={() => handleStatusChange("IN_TRANSIT")}
                disabled={loading}
                className="rounded-lg bg-blue-600 px-6 py-2 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? "Confirming..." : "Confirm Pickup"}
              </button>
              <button
                onClick={() => setShowCancelModal(true)}
                className="rounded-lg bg-red-50 px-6 py-2 font-medium text-red-600 hover:bg-red-100"
              >
                Cancel Trip
              </button>
            </>
          )}
          {trip.status === "IN_TRANSIT" && (
            <>
              <button
                onClick={() =>
                  (window.location.href = `/carrier/map?tripId=${trip.id}`)
                }
                className="rounded-lg bg-green-50 px-6 py-2 font-medium text-green-600 hover:bg-green-100"
              >
                Track Live
              </button>
              <button
                onClick={handleMarkDelivered}
                disabled={loading}
                className="rounded-lg bg-orange-600 px-6 py-2 font-medium text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {loading ? "Marking..." : "Mark Delivered"}
              </button>
              <button
                onClick={() => setShowExceptionModal(true)}
                disabled={loading}
                className="rounded-lg border border-amber-300 bg-amber-50 px-6 py-2 font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-50"
              >
                Report Exception
              </button>
            </>
          )}
          {trip.status === "EXCEPTION" && (
            <span className="rounded-lg border border-amber-300 bg-amber-50 px-6 py-2 font-medium text-amber-700">
              Exception — Under Review
            </span>
          )}
          {trip.status === "DELIVERED" && !trip.podSubmitted && (
            <span className="rounded-lg border border-slate-300 bg-slate-50 px-6 py-2 text-sm text-slate-500">
              Waiting for driver to upload POD
            </span>
          )}
          {trip.status === "DELIVERED" &&
            trip.podSubmitted &&
            !trip.podVerified && (
              <span className="rounded-lg border border-blue-200 bg-blue-50 px-6 py-2 font-medium text-blue-700">
                Awaiting Shipper Verification
              </span>
            )}
          {trip.status === "DELIVERED" && trip.podVerified && (
            <span className="rounded-lg border border-green-200 bg-green-50 px-6 py-2 font-medium text-green-700">
              POD Verified
            </span>
          )}
          {trip.status === "CANCELLED" && (
            <span className="rounded-lg bg-red-50 px-6 py-2 font-medium text-red-600">
              Trip Cancelled
            </span>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* POD Status — read-only (driver uploads POD, carrier views) */}
      {(trip.status === "DELIVERED" || trip.status === "COMPLETED") && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
          <h2 className="mb-3 text-lg font-semibold text-gray-900 dark:text-white">
            Proof of Delivery
          </h2>
          {trip.podSubmitted ? (
            <div className="text-green-700 dark:text-green-300">
              <p className="flex items-center gap-2 font-medium">
                <span>&#x2713;</span> POD uploaded by driver
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Waiting for driver to upload POD
            </p>
          )}
        </div>
      )}

      {/* Delivery Modal - Collect receiver info */}
      {showDeliveryModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Mark as Delivered
            </h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Please provide delivery details. Receiver information is optional
              but recommended.
            </p>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Receiver Name
                </label>
                <input
                  type="text"
                  value={receiverName}
                  onChange={(e) => setReceiverName(e.target.value)}
                  placeholder="Name of person who received the delivery"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Receiver Phone
                </label>
                <input
                  type="tel"
                  value={receiverPhone}
                  onChange={(e) => setReceiverPhone(e.target.value)}
                  placeholder="Phone number"
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Delivery Notes
                </label>
                <textarea
                  value={deliveryNotes}
                  onChange={(e) => setDeliveryNotes(e.target.value)}
                  placeholder="Any notes about the delivery..."
                  rows={3}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowDeliveryModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={submitDelivery}
                disabled={loading}
                className="flex-1 rounded-lg bg-orange-600 px-4 py-2 text-white hover:bg-orange-700 disabled:opacity-50"
              >
                {loading ? "Marking..." : "Mark Delivered"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cancel Trip Modal */}
      {showCancelModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Cancel Trip
            </h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Are you sure you want to cancel this trip? This action cannot be
              undone.
            </p>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason for cancellation *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Please explain why you are cancelling..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCancelModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
              >
                Back
              </button>
              <button
                onClick={handleCancelTrip}
                disabled={loading || !cancelReason.trim()}
                className="flex-1 rounded-lg bg-red-600 px-4 py-2 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {loading ? "Cancelling..." : "Cancel Trip"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Exception Modal */}
      {showExceptionModal && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Report Exception
            </h2>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
              Describe the issue preventing this trip from continuing. An admin
              will review and resolve it.
            </p>

            <div className="mb-4">
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Reason for exception *
              </label>
              <textarea
                value={exceptionReason}
                onChange={(e) => setExceptionReason(e.target.value)}
                placeholder="e.g., Vehicle breakdown, road closure, cargo damage..."
                rows={3}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                required
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowExceptionModal(false)}
                className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
              >
                Back
              </button>
              <button
                onClick={() => {
                  handleStatusChange("EXCEPTION", {
                    exceptionReason,
                  });
                  setShowExceptionModal(false);
                }}
                disabled={loading || exceptionReason.trim().length < 10}
                className="flex-1 rounded-lg bg-amber-600 px-4 py-2 text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {loading ? "Reporting..." : "Report Exception"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Exception Banner */}
      {trip.status === "EXCEPTION" && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-900/20">
          <span className="mt-0.5 text-xl text-amber-600">⚠</span>
          <div>
            <p className="font-semibold text-amber-800 dark:text-amber-200">
              Exception Reported
            </p>
            <p className="mt-1 text-sm text-amber-700 dark:text-amber-300">
              This trip has an active exception. An admin is reviewing the
              situation. You will be notified when it is resolved.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main Details */}
        <div className="space-y-6 lg:col-span-2">
          {/* Trip Progress (for IN_TRANSIT) */}
          {trip.status === "IN_TRANSIT" && tripProgress.percent > 0 && (
            <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
              <h3 className="mb-2 text-sm font-medium text-blue-800 dark:text-blue-200">
                Trip Progress
              </h3>
              <div className="h-3 w-full rounded-full bg-blue-200 dark:bg-blue-800">
                <div
                  className="h-3 rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${tripProgress.percent}%` }}
                />
              </div>
              <div className="mt-2 flex justify-between text-sm text-blue-700 dark:text-blue-300">
                <span>{tripProgress.percent}% complete</span>
                {tripProgress.remainingKm && (
                  <span>
                    {tripProgress.remainingKm.toFixed(1)} km remaining
                  </span>
                )}
              </div>
              {tripProgress.estimatedArrival && (
                <div className="mt-1 text-sm text-blue-600 dark:text-blue-400">
                  ETA:{" "}
                  {new Date(tripProgress.estimatedArrival).toLocaleTimeString(
                    [],
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </div>
              )}
            </div>
          )}

          {/* Load Details */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Load Details
            </h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Weight
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {trip.weight.toLocaleString()} kg
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Truck Type
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {trip.truckType}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Pickup Date
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {formatDate(trip.pickupDate)}
                </p>
              </div>
              {trip.deliveryDate && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Delivery Date
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {formatDate(trip.deliveryDate)}
                  </p>
                </div>
              )}
              {trip.estimatedTripKm && (
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Distance
                  </p>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {trip.estimatedTripKm.toFixed(0)} km
                  </p>
                </div>
              )}
            </div>

            {trip.cargoDescription && (
              <div className="mt-4 border-t border-gray-200 pt-4 dark:border-slate-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Cargo Description
                </p>
                <p className="font-medium text-gray-900 dark:text-white">
                  {trip.cargoDescription}
                </p>
              </div>
            )}

            {trip.safetyNotes && (
              <div className="mt-4 rounded-lg bg-yellow-50 p-3 dark:bg-yellow-900/20">
                <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                  Safety Notes
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  {trip.safetyNotes}
                </p>
              </div>
            )}
          </div>

          {/* Pickup & Delivery */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
              Route Details
            </h2>
            <div className="space-y-4">
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                  <span className="text-green-600 dark:text-green-400">A</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {trip.pickupCity}
                  </p>
                  {trip.pickupAddress && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {trip.pickupAddress}
                    </p>
                  )}
                  {trip.pickupDockHours && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Dock Hours: {trip.pickupDockHours}
                    </p>
                  )}
                </div>
              </div>
              <div className="ml-4 h-8 border-l-2 border-dashed border-gray-300 dark:border-slate-600" />
              <div className="flex items-start gap-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                  <span className="text-red-600 dark:text-red-400">B</span>
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {trip.deliveryCity}
                  </p>
                  {trip.deliveryAddress && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {trip.deliveryAddress}
                    </p>
                  )}
                  {trip.deliveryDockHours && (
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Dock Hours: {trip.deliveryDockHours}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Documents (POD) */}
          {trip.documents.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Documents
              </h2>
              <div className="space-y-2">
                {trip.documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-slate-700"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">📄</span>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {doc.fileName}
                        </p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {doc.documentType} • {formatDateTime(doc.createdAt)}
                        </p>
                      </div>
                    </div>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-[#1e9c99] hover:underline"
                    >
                      View
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Shipper Info */}
          {trip.shipper && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Shipper
              </h2>
              <p className="font-medium text-gray-900 dark:text-white">
                {trip.shipper.name}
                {trip.shipper.isVerified && (
                  <span className="ml-1 text-green-600">✓</span>
                )}
              </p>
              {trip.shipperContactName && (
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Contact: {trip.shipperContactName}
                </p>
              )}
              {trip.shipperContactPhone && (
                <a
                  href={`tel:${trip.shipperContactPhone}`}
                  className="text-sm text-[#1e9c99] hover:underline"
                >
                  {trip.shipperContactPhone}
                </a>
              )}
            </div>
          )}

          {/* §12 Rating */}
          {(trip.status === "DELIVERED" || trip.status === "COMPLETED") && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Rate Shipper
              </h2>
              {existingRating ? (
                <div>
                  <StarRating value={existingRating.stars} size="md" />
                  {existingRating.comment && (
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
                      &ldquo;{existingRating.comment}&rdquo;
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-400">Rating submitted</p>
                </div>
              ) : (
                <button
                  onClick={() => setShowRatingModal(true)}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
                >
                  Rate Your Experience
                </button>
              )}
            </div>
          )}

          <RatingModal
            isOpen={showRatingModal}
            onClose={() => setShowRatingModal(false)}
            tripId={trip.id}
            ratedOrgName={trip.shipper?.name || "Shipper"}
            raterLabel="Rate Shipper"
            onSuccess={() => {
              fetch(`/api/trips/${trip.id}/rate`, { credentials: "include" })
                .then((res) => (res.ok ? res.json() : null))
                .then((data) => {
                  if (data?.myRating) setExistingRating(data.myRating);
                })
                .catch(() => {});
            }}
          />

          {/* Truck Info */}
          {trip.truck && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Your Truck
              </h2>
              <p className="font-medium text-gray-900 dark:text-white">
                {trip.truck.licensePlate}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {trip.truck.truckType} • {trip.truck.capacity.toLocaleString()}{" "}
                kg
              </p>
            </div>
          )}

          {/* Driver Info — Task 19 */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Driver
              </h2>
              {canAssignDriver && !isAdmin && (
                <div className="flex gap-2">
                  {trip.driver && trip.status === "ASSIGNED" && (
                    <button
                      onClick={handleUnassignDriver}
                      disabled={driverActionLoading}
                      className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                    >
                      Unassign
                    </button>
                  )}
                  <button
                    onClick={() => {
                      fetchAvailableDrivers();
                      setShowDriverSelect(!showDriverSelect);
                    }}
                    disabled={driverActionLoading}
                    className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {trip.driver ? "Reassign" : "Assign Driver"}
                  </button>
                </div>
              )}
            </div>

            {trip.driver ? (
              <div>
                <p className="font-medium text-gray-900 dark:text-white">
                  {[trip.driver.firstName, trip.driver.lastName]
                    .filter(Boolean)
                    .join(" ") || "-"}
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {trip.driver.phone ?? "-"}
                </p>
                {trip.driver.driverProfile && (
                  <p className="mt-1 text-xs text-gray-400">
                    {trip.driver.driverProfile.isAvailable
                      ? "Available"
                      : "Unavailable"}
                    {trip.driver.driverProfile.cdlNumber &&
                      ` • CDL: ${trip.driver.driverProfile.cdlNumber}`}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400">No driver assigned</p>
            )}

            {/* Driver selection dropdown */}
            {showDriverSelect && (
              <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-600">
                  Select a driver:
                </p>
                {availableDrivers.length === 0 ? (
                  <p className="text-xs text-slate-400">
                    No available drivers found
                  </p>
                ) : (
                  <div className="max-h-40 space-y-1 overflow-y-auto">
                    {availableDrivers.map((d) => (
                      <button
                        key={d.id}
                        onClick={() => handleAssignDriver(d.id)}
                        disabled={driverActionLoading}
                        className="w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50 disabled:opacity-50"
                      >
                        {[d.firstName, d.lastName].filter(Boolean).join(" ") ||
                          "(no name)"}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Timeline */}
          {trip.events.length > 0 && (
            <div className="rounded-lg border border-gray-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-800">
              <h2 className="mb-4 text-lg font-semibold text-gray-900 dark:text-white">
                Activity
              </h2>
              <div className="space-y-4">
                {trip.events.slice(0, 10).map((event, index) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="relative">
                      <div className="mt-2 h-2 w-2 rounded-full bg-[#1e9c99]" />
                      {index < trip.events.length - 1 && (
                        <div className="absolute top-4 left-0.5 h-full w-0.5 bg-gray-200 dark:bg-slate-700" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {event.description}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {formatDateTime(event.createdAt)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* §13 In-App Messaging */}
      <TripChat
        tripId={trip.id}
        currentUserId={userId}
        isShipper={false}
        isAdmin={isAdmin}
      />
    </div>
  );
}

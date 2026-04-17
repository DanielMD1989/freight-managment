"use client";

/**
 * Admin Trip Detail Client Component
 *
 * Displays trip details with exception resolution panel for ADMIN users.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCSRFToken } from "@/lib/csrfFetch";
import ReassignTruckModal from "@/app/dispatcher/trips/[id]/ReassignTruckModal";
import { renderEventDescription } from "@/lib/eventDescriptions";
import type { TripDetail } from "./page";

const STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-purple-100 text-purple-800",
  PICKUP_PENDING: "bg-yellow-100 text-yellow-800",
  IN_TRANSIT: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-green-100 text-green-800",
  EXCEPTION: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-800",
};

const FEE_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  DEDUCTED: "bg-green-100 text-green-700",
  REFUNDED: "bg-blue-100 text-blue-700",
  WAIVED: "bg-purple-100 text-purple-700",
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return "—";
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function AdminTripDetailClient({ trip }: { trip: TripDetail }) {
  const router = useRouter();
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);

  const handleResolve = async (
    newStatus: "ASSIGNED" | "IN_TRANSIT" | "COMPLETED" | "CANCELLED"
  ) => {
    // Bug #10: API requires cancelReason when transitioning to CANCELLED.
    // Without it the EXCEPTION → CANCELLED resolution path silently 400'd
    // and the trip stayed in EXCEPTION forever.
    let cancelReason: string | undefined;
    if (newStatus === "CANCELLED") {
      const reason = window.prompt(
        "Reason for cancelling this trip (required):",
        "Resolved by admin from EXCEPTION"
      );
      if (!reason || !reason.trim()) {
        return;
      }
      cancelReason = reason.trim();
    }

    setResolving(newStatus);
    setResolveError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/trips/${trip.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          status: newStatus,
          ...(cancelReason ? { cancelReason } : {}),
        }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        setResolveError(data.error || "Failed to update trip status");
      }
    } catch {
      setResolveError("An error occurred while updating the trip");
    } finally {
      setResolving(null);
    }
  };

  const isException = trip.status === "EXCEPTION";

  return (
    <div className="space-y-6">
      {/* Status + Route Header */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-mono text-lg font-semibold text-gray-900">
              {trip.id}
            </h2>
            <p className="mt-1 text-2xl font-bold text-gray-800">
              {trip.load
                ? `${trip.load.pickupCity} → ${trip.load.deliveryCity}`
                : "Route unavailable"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[trip.status] || "bg-gray-100 text-gray-700"}`}
          >
            {trip.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <div>
            <dt className="text-sm text-gray-500">Shipper</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {trip.load?.shipper?.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Carrier</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {trip.carrier?.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Truck</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {trip.truck?.licensePlate || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Driver</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {trip.driver
                ? [trip.driver.firstName, trip.driver.lastName]
                    .filter(Boolean)
                    .join(" ") || "—"
                : "—"}
            </dd>
            {trip.driver?.phone && (
              <dd className="text-xs text-gray-500">{trip.driver.phone}</dd>
            )}
            {trip.driver?.driverProfile && (
              <dd className="text-xs text-gray-400">
                {trip.driver.driverProfile.isAvailable
                  ? "Available"
                  : "Unavailable"}
                {trip.driver.driverProfile.cdlNumber &&
                  ` | CDL: ${trip.driver.driverProfile.cdlNumber}`}
              </dd>
            )}
          </div>
        </div>
      </div>

      {/* Exception Resolution Panel */}
      {isException && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-6">
          <div className="mb-4 flex items-start gap-3">
            <svg
              className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h3 className="font-semibold text-amber-900">
                Trip in EXCEPTION State
              </h3>
              <p className="mt-1 text-sm text-amber-800">
                Only admins can resolve trip exceptions. Choose an action below.
              </p>
              {trip.exceptionReason && (
                <p className="mt-2 text-sm text-amber-700">
                  <span className="font-medium">Reason reported:</span>{" "}
                  {trip.exceptionReason}
                </p>
              )}
            </div>
          </div>

          {resolveError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{resolveError}</p>
            </div>
          )}

          {/* G-M32-6: All four EXCEPTION resolution options. Order:
              IN_TRANSIT (most common), ASSIGNED, COMPLETED, CANCELLED (destructive last). */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleResolve("IN_TRANSIT")}
              disabled={resolving !== null}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resolving === "IN_TRANSIT"
                ? "Resuming..."
                : "Resume Transit → IN_TRANSIT"}
            </button>
            <button
              onClick={() => handleResolve("ASSIGNED")}
              disabled={resolving !== null}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resolving === "ASSIGNED"
                ? "Restarting..."
                : "Restart Trip → ASSIGNED"}
            </button>
            <div className="flex flex-col items-start">
              <button
                onClick={() => handleResolve("COMPLETED")}
                disabled={resolving !== null}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resolving === "COMPLETED"
                  ? "Completing..."
                  : "Complete Trip → COMPLETED"}
              </button>
              <span className="mt-1 text-xs text-gray-500">
                Requires POD uploaded by carrier
              </span>
            </div>
            <button
              onClick={() => handleResolve("CANCELLED")}
              disabled={resolving !== null}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {resolving === "CANCELLED"
                ? "Cancelling..."
                : "Cancel Trip → CANCELLED"}
            </button>
            {trip.truck && trip.carrier && (
              <button
                onClick={() => setShowReassign(true)}
                disabled={resolving !== null}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Reassign Truck
              </button>
            )}
          </div>
        </div>
      )}

      {/* §7 Truck Reassignment Modal */}
      {showReassign && trip.truck && trip.carrier && (
        <ReassignTruckModal
          trip={{
            id: trip.id,
            truckId: trip.truck.id,
            truck: {
              carrierId: trip.carrier.id,
              licensePlate: trip.truck.licensePlate,
            },
          }}
          onSuccess={() => {
            setShowReassign(false);
            router.refresh();
          }}
          onClose={() => setShowReassign(false)}
        />
      )}

      {/* Timeline */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
          Timeline
        </h3>
        <dl className="space-y-3">
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Created</dt>
            <dd className="text-sm font-medium text-gray-900">
              {formatDate(trip.createdAt)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Pickup Started</dt>
            <dd className="text-sm font-medium text-gray-900">
              {formatDate(trip.startedAt)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">In Transit</dt>
            <dd className="text-sm font-medium text-gray-900">
              {formatDate(trip.pickedUpAt)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Delivered</dt>
            <dd className="text-sm font-medium text-gray-900">
              {formatDate(trip.deliveredAt)}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-sm text-gray-600">Completed</dt>
            <dd className="text-sm font-medium text-gray-900">
              {formatDate(trip.completedAt)}
            </dd>
          </div>
          {trip.cancelledAt && (
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Cancelled</dt>
              <dd className="text-sm font-medium text-red-700">
                {formatDate(trip.cancelledAt)}
              </dd>
            </div>
          )}
          {trip.exceptionAt && (
            <div className="flex justify-between">
              <dt className="text-sm text-gray-600">Exception Raised</dt>
              <dd className="text-sm font-medium text-amber-700">
                {formatDate(trip.exceptionAt)}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Service Fees */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
          Service Fees
        </h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-600">Shipper Fee</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(trip.shipperServiceFee)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${FEE_STATUS_COLORS[trip.shipperFeeStatus] || "bg-gray-100 text-gray-700"}`}
              >
                {trip.shipperFeeStatus}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Carrier Fee</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(trip.carrierServiceFee)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${FEE_STATUS_COLORS[trip.carrierFeeStatus] || "bg-gray-100 text-gray-700"}`}
              >
                {trip.carrierFeeStatus}
              </span>
            </dd>
          </div>
        </div>
      </div>

      {/* G-M33-2: Truck Reassignment */}
      {trip.reassignedAt && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-6">
          <h3 className="mb-4 text-sm font-medium tracking-wider text-amber-700 uppercase">
            Truck Reassignment
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-600">Reassigned At</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {formatDate(trip.reassignedAt)}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">Reason</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {trip.reassignmentReason || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">Previous Truck</dt>
              <dd className="mt-1 font-mono text-sm font-medium text-gray-900">
                {trip.previousTruckId
                  ? trip.previousTruckId.slice(0, 8) + "..."
                  : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-600">Current Truck</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {trip.truck?.licensePlate || "—"}
              </dd>
            </div>
          </div>
        </div>
      )}

      {/* G-M33-4: Audit Trail */}
      {trip.loadEvents && trip.loadEvents.length > 0 && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
            Audit Trail
          </h3>
          <div className="space-y-3">
            {trip.loadEvents.map((event) => (
              <div
                key={event.id}
                className="flex items-start justify-between border-b border-gray-100 pb-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-100 px-2 py-0.5 font-mono text-xs text-gray-700">
                      {event.eventType}
                    </span>
                    <span className="text-xs text-gray-400">
                      {event.userId
                        ? `by ${event.userId.slice(0, 8)}...`
                        : "System"}
                    </span>
                  </div>
                  {event.description && (
                    <p className="mt-1 text-sm text-gray-600">
                      {renderEventDescription(
                        { ...event, description: event.description ?? "" },
                        {
                          organizationId: null,
                          carrierId: trip.carrier?.id,
                          carrierName: trip.carrier?.name,
                          shipperId: trip.load?.shipper?.id,
                          shipperName: trip.load?.shipper?.name,
                        }
                      )}
                    </p>
                  )}
                </div>
                <span className="ml-4 shrink-0 text-xs text-gray-400">
                  {formatDate(event.createdAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Back Link */}
      <div>
        <Link
          href="/admin/trips"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          ← Back to Trips
        </Link>
      </div>
    </div>
  );
}

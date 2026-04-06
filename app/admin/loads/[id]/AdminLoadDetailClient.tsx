"use client";

/**
 * Admin Load Detail Client Component
 *
 * Displays load details with admin actions (cancel, force-complete).
 * G-M32-5: Admin load detail page.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getCSRFToken } from "@/lib/csrfFetch";
import type { LoadDetail } from "./page";

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-800",
  POSTED: "bg-blue-100 text-blue-800",
  SEARCHING: "bg-indigo-100 text-indigo-800",
  OFFERED: "bg-violet-100 text-violet-800",
  ASSIGNED: "bg-purple-100 text-purple-800",
  PICKUP_PENDING: "bg-yellow-100 text-yellow-800",
  IN_TRANSIT: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-green-100 text-green-800",
  EXCEPTION: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-800",
  EXPIRED: "bg-stone-100 text-stone-800",
  UNPOSTED: "bg-slate-100 text-slate-800",
};

const FEE_STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-gray-100 text-gray-700",
  DEDUCTED: "bg-green-100 text-green-700",
  REFUNDED: "bg-blue-100 text-blue-700",
  WAIVED: "bg-purple-100 text-purple-700",
};

const SETTLEMENT_COLORS: Record<string, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  PAID: "bg-green-100 text-green-700",
  DISPUTE: "bg-red-100 text-red-700",
  FAILED: "bg-red-100 text-red-700",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
};

function formatDate(dateString: string | null): string {
  if (!dateString) return "\u2014";
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateString));
}

function formatCurrency(amount: number | null): string {
  if (amount === null) return "\u2014";
  return new Intl.NumberFormat("en-ET", {
    style: "currency",
    currency: "ETB",
    minimumFractionDigits: 2,
  }).format(amount);
}

export default function AdminLoadDetailClient({ load }: { load: LoadDetail }) {
  const router = useRouter();
  const [acting, setActing] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleStatusChange = async (newStatus: string) => {
    // Blueprint §6: Cancellation requires a user-provided reason
    let reason: string | undefined;
    if (newStatus === "CANCELLED") {
      const input = window.prompt("Reason for cancellation (required):");
      if (!input || !input.trim()) {
        setActionError("Cancellation reason is required");
        return;
      }
      reason = input.trim();
    }

    setActing(newStatus);
    setActionError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${load.id}/status`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({ status: newStatus, ...(reason && { reason }) }),
      });

      if (response.ok) {
        router.refresh();
      } else {
        const data = await response.json();
        setActionError(data.error || "Failed to update load status");
      }
    } catch {
      setActionError("An error occurred while updating the load");
    } finally {
      setActing(null);
    }
  };

  const canCancel = ![
    "COMPLETED",
    "CANCELLED",
    "DELIVERED",
    "IN_TRANSIT",
  ].includes(load.status);
  const canForceComplete = load.status === "DELIVERED";

  return (
    <div className="space-y-6">
      {/* SECTION 1 — Load Header */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-mono text-lg font-semibold text-gray-900">
              {load.id}
            </h2>
            <p className="mt-1 text-2xl font-bold text-gray-800">
              {load.pickupCity || "N/A"} &rarr; {load.deliveryCity || "N/A"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[load.status] || "bg-gray-100 text-gray-700"}`}
          >
            {load.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* SECTION 2 — Load Info */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
          Load Information
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Cargo</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.cargoDescription || "\u2014"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Weight</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.weight ? `${load.weight} kg` : "\u2014"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Truck Type</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.truckType?.replace(/_/g, " ") || "\u2014"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Created</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {formatDate(load.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Pickup Date</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {formatDate(load.pickupDate)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Delivery Date</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {formatDate(load.deliveryDate)}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Corridor</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.corridor
                ? `${load.corridor.name} (${load.corridor.distanceKm} km)`
                : "\u2014"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Shipper</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.shipper?.name || "\u2014"}
              {load.shipper?.contactPhone && (
                <span className="ml-2 text-xs text-gray-500">
                  {load.shipper.contactPhone}
                </span>
              )}
            </dd>
          </div>
        </div>
      </div>

      {/* SECTION 3 — Assigned Carrier */}
      {load.assignedTruck && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
            Assigned Carrier
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">Carrier</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {load.assignedTruck.carrier?.name || "\u2014"}
                {load.assignedTruck.carrier?.contactPhone && (
                  <span className="ml-2 text-xs text-gray-500">
                    {load.assignedTruck.carrier.contactPhone}
                  </span>
                )}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Truck</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {load.assignedTruck.licensePlate}{" "}
                <span className="text-xs text-gray-500">
                  ({load.assignedTruck.truckType.replace(/_/g, " ")})
                </span>
              </dd>
            </div>
            {load.trip && (
              <>
                <div>
                  <dt className="text-sm text-gray-500">Trip</dt>
                  <dd className="mt-1 text-sm font-medium">
                    <Link
                      href={`/admin/trips/${load.trip.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      {load.trip.id.slice(0, 8)}...
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-gray-500">Trip Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[load.trip.status] || "bg-gray-100 text-gray-700"}`}
                    >
                      {load.trip.status.replace(/_/g, " ")}
                    </span>
                  </dd>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* SECTION 4 — Financial Summary */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
          Financial Summary
        </h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-600">Shipper Fee</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(load.shipperServiceFee)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${FEE_STATUS_COLORS[load.shipperFeeStatus] || "bg-gray-100 text-gray-700"}`}
              >
                {load.shipperFeeStatus}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Carrier Fee</dt>
            <dd className="mt-1 flex items-center gap-2">
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency(load.carrierServiceFee)}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${FEE_STATUS_COLORS[load.carrierFeeStatus] || "bg-gray-100 text-gray-700"}`}
              >
                {load.carrierFeeStatus}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Settlement</dt>
            <dd className="mt-1 flex items-center gap-2">
              {load.settlementStatus ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${SETTLEMENT_COLORS[load.settlementStatus] || "bg-gray-100 text-gray-700"}`}
                >
                  {load.settlementStatus}
                </span>
              ) : (
                <span className="text-sm text-gray-500">{"\u2014"}</span>
              )}
              {load.settledAt && (
                <span className="text-xs text-gray-500">
                  {formatDate(load.settledAt)}
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-600">Distance</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.actualTripKm
                ? `${load.actualTripKm} km (GPS)`
                : load.corridor
                  ? `${load.corridor.distanceKm} km (corridor)`
                  : "\u2014"}
            </dd>
          </div>
        </div>
      </div>

      {/* SECTION 5 — POD */}
      {load.podSubmitted && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
            Proof of Delivery
          </h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <dt className="text-sm text-gray-500">POD Submitted</dt>
              <dd className="mt-1 text-sm font-medium text-green-700">Yes</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Verified At</dt>
              <dd className="mt-1 text-sm font-medium text-gray-900">
                {formatDate(load.podVerifiedAt)}
              </dd>
            </div>
            {load.podDocument && (
              <div>
                <dt className="text-sm text-gray-500">Document</dt>
                <dd className="mt-1 text-sm font-medium text-gray-900">
                  {load.podDocument.fileName || load.podDocument.id.slice(0, 8)}
                </dd>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SECTION 6 — Admin Actions */}
      {(canCancel || canForceComplete) && (
        <div className="rounded-lg border-2 border-gray-200 bg-gray-50 p-6">
          <h3 className="mb-2 text-sm font-semibold text-gray-900">
            Admin Actions
          </h3>
          <p className="mb-4 text-sm text-gray-600">
            These actions are admin-only and cannot be undone.
          </p>

          {actionError && (
            <div className="mb-4 rounded border border-red-200 bg-red-50 p-3">
              <p className="text-sm text-red-800">{actionError}</p>
            </div>
          )}

          <div className="flex gap-3">
            {canForceComplete && (
              <button
                onClick={() => handleStatusChange("COMPLETED")}
                disabled={acting !== null}
                className="rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {acting === "COMPLETED" ? "Completing..." : "Force Complete"}
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => handleStatusChange("CANCELLED")}
                disabled={acting !== null}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {acting === "CANCELLED" ? "Cancelling..." : "Cancel Load"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Back Link */}
      <div>
        <Link
          href="/admin/loads"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          &larr; Back to Loads
        </Link>
      </div>
    </div>
  );
}

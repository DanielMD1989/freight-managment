"use client";

/**
 * Dispatcher Load Detail Client Component
 *
 * Read-only load detail view for dispatchers.
 * G-D3: No status change actions — dispatcher proposes only (Blueprint §5).
 */

import Link from "next/link";
import type { DispatcherLoadDetail } from "./page";

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

const TRIP_STATUS_COLORS: Record<string, string> = {
  ASSIGNED: "bg-purple-100 text-purple-800",
  PICKUP_PENDING: "bg-yellow-100 text-yellow-800",
  IN_TRANSIT: "bg-orange-100 text-orange-800",
  DELIVERED: "bg-teal-100 text-teal-800",
  COMPLETED: "bg-green-100 text-green-800",
  EXCEPTION: "bg-amber-100 text-amber-800",
  CANCELLED: "bg-red-100 text-red-800",
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

export default function DispatcherLoadDetailClient({
  load,
}: {
  load: DispatcherLoadDetail;
}) {
  const isPostTrip =
    load.status === "ASSIGNED" ||
    load.status === "PICKUP_PENDING" ||
    load.status === "IN_TRANSIT" ||
    load.status === "DELIVERED" ||
    load.status === "COMPLETED" ||
    load.status === "EXCEPTION";

  return (
    <div className="space-y-6">
      {/* Status + Route Header */}
      <div className="rounded-lg bg-white p-6 shadow">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="font-mono text-lg font-semibold text-gray-900">
              {load.id}
            </h2>
            <p className="mt-1 text-2xl font-bold text-gray-800">
              {load.pickupCity && load.deliveryCity
                ? `${load.pickupCity} → ${load.deliveryCity}`
                : "Route unavailable"}
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${STATUS_COLORS[load.status] || "bg-gray-100 text-gray-700"}`}
          >
            {load.status.replace(/_/g, " ")}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <dt className="text-sm text-gray-500">Shipper</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.shipper?.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Carrier</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.assignedTruck?.carrier?.name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Truck</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.assignedTruck?.licensePlate || "—"}
            </dd>
          </div>
        </div>
      </div>

      {/* Cargo Details */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
          Cargo Details
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <dt className="text-sm text-gray-500">Weight</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.weight ? `${load.weight.toLocaleString()} kg` : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-gray-500">Truck Type</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.truckType?.replace(/_/g, " ") || "—"}
            </dd>
          </div>
          <div className="md:col-span-2">
            <dt className="text-sm text-gray-500">Description</dt>
            <dd className="mt-1 text-sm font-medium text-gray-900">
              {load.cargoDescription || "—"}
            </dd>
          </div>
        </div>
      </div>

      {/* Dates */}
      <div className="rounded-lg bg-white p-6 shadow">
        <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
          Schedule
        </h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
        </div>
      </div>

      {/* Exception Banner */}
      {load.status === "EXCEPTION" && load.trip?.exceptionReason && (
        <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-6">
          <div className="flex items-start gap-3">
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
                Load in EXCEPTION State
              </h3>
              <p className="mt-1 text-sm text-amber-700">
                <span className="font-medium">Reason:</span>{" "}
                {load.trip.exceptionReason}
              </p>
              {load.trip.exceptionAt && (
                <p className="mt-1 text-xs text-amber-600">
                  Raised at {formatDate(load.trip.exceptionAt)}
                </p>
              )}
              <p className="mt-2 text-xs text-amber-600">
                Only Admin can resolve exceptions. Dispatcher can escalate.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Active Trip */}
      {load.trip && isPostTrip && (
        <div className="rounded-lg bg-white p-6 shadow">
          <h3 className="mb-4 text-sm font-medium tracking-wider text-gray-500 uppercase">
            Active Trip
          </h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="font-mono text-sm text-gray-700">
                {load.trip.id.slice(0, 8)}...
              </span>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${TRIP_STATUS_COLORS[load.trip.status] || "bg-gray-100 text-gray-700"}`}
              >
                {load.trip.status.replace(/_/g, " ")}
              </span>
            </div>
            <Link
              href={`/dispatcher/trips/${load.trip.id}`}
              className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-teal-700"
            >
              View Trip
            </Link>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4">
        <Link
          href="/dispatcher/loads"
          className="text-sm font-medium text-blue-600 hover:text-blue-800"
        >
          ← Back to Loads
        </Link>
        {load.status === "POSTED" && (
          <Link
            href={`/dispatcher/proposals?loadId=${load.id}`}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
          >
            Propose Match
          </Link>
        )}
      </div>
    </div>
  );
}

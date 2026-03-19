/**
 * Dispatcher Trip Detail Client Component
 *
 * Shows trip info, status, and reassignment action for EXCEPTION trips.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import ReassignTruckModal from "./ReassignTruckModal";

interface TripDetail {
  id: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  trackingEnabled: boolean;
  estimatedDistanceKm: number | null;
  createdAt: string;
  deliveredAt: string | null;
  reassignedAt: string | null;
  reassignmentReason: string | null;
  previousTruckId: string | null;
  load?: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    cargoDescription: string;
    weight: number;
    truckType: string;
    pickupDate: string;
    deliveryDate: string;
  };
  truck?: {
    id: string;
    licensePlate: string;
    truckType: string;
    contactName: string;
    contactPhone: string;
  };
  carrier?: {
    id: string;
    name: string;
  };
  shipper?: {
    id: string;
    name: string;
  };
}

const statusStyles: Record<string, string> = {
  ASSIGNED: "bg-amber-100 text-amber-700",
  PICKUP_PENDING: "bg-blue-100 text-blue-700",
  IN_TRANSIT: "bg-teal-100 text-teal-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  COMPLETED: "bg-slate-100 text-slate-700",
  CANCELLED: "bg-red-100 text-red-700",
  EXCEPTION: "bg-orange-100 text-orange-700",
};

export default function TripDetailClient({ tripId }: { tripId: string }) {
  const [trip, setTrip] = useState<TripDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showReassign, setShowReassign] = useState(false);

  const fetchTrip = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/trips/${tripId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch trip");
      }
      const data = await response.json();
      setTrip(data);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch trip";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-teal-500"></div>
        <p className="mt-3 text-sm text-slate-500">Loading trip details...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="space-y-4">
        <Link
          href="/dispatcher/trips"
          className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Trips
        </Link>
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error || "Trip not found"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link + Header */}
      <div>
        <Link
          href="/dispatcher/trips"
          className="mb-4 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-800"
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
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Trips
        </Link>
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">
              {trip.pickupCity} → {trip.deliveryCity}
            </h1>
            <p className="mt-1 font-mono text-sm text-slate-500">
              Trip {trip.id.slice(0, 8)}...
            </p>
          </div>
          <span
            className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${statusStyles[trip.status] || "bg-slate-100 text-slate-600"}`}
          >
            {trip.status.replace(/_/g, " ")}
          </span>
        </div>
      </div>

      {/* EXCEPTION alert banner */}
      {trip.status === "EXCEPTION" && (
        <div className="flex items-center justify-between rounded-xl border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-100">
              <svg
                className="h-5 w-5 text-orange-600"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-orange-800">
                This trip has an active exception
              </p>
              <p className="text-sm text-orange-600">
                Assign a replacement truck to resume transit.
              </p>
            </div>
          </div>
          <button
            onClick={() => setShowReassign(true)}
            className="rounded-lg bg-orange-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-orange-600"
          >
            Reassign Truck
          </button>
        </div>
      )}

      {/* Trip info card */}
      <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">
          Trip Details
        </h2>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">
              Carrier
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {trip.carrier?.name || "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">
              Truck
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {trip.truck?.licensePlate || "N/A"}
            </p>
            <p className="text-xs text-slate-500">
              {trip.truck?.truckType?.replace(/_/g, " ")}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">
              Shipper
            </p>
            <p className="mt-1 text-sm font-medium text-slate-800">
              {trip.shipper?.name || "Unknown"}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">
              Created
            </p>
            <p className="mt-1 text-sm text-slate-700">
              {new Date(trip.createdAt).toLocaleDateString()}
            </p>
          </div>
          {trip.deliveredAt && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Delivered
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {new Date(trip.deliveredAt).toLocaleDateString()}
              </p>
            </div>
          )}
          {trip.estimatedDistanceKm && (
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Distance
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {trip.estimatedDistanceKm} km
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Load info card */}
      {trip.load && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            Load Details
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Route
              </p>
              <p className="mt-1 text-sm font-medium text-slate-800">
                {trip.load.pickupCity} → {trip.load.deliveryCity}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Cargo
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {trip.load.cargoDescription || "General cargo"}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Weight
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {trip.load.weight?.toLocaleString()} kg
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Truck Type
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {trip.load.truckType?.replace(/_/g, " ")}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Pickup Date
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {new Date(trip.load.pickupDate).toLocaleDateString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Delivery Date
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {new Date(trip.load.deliveryDate).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Reassignment history */}
      {trip.reassignedAt && (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-slate-800">
            Reassignment History
          </h2>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Reassigned At
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {new Date(trip.reassignedAt).toLocaleString()}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500 uppercase">
                Reason
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {trip.reassignmentReason || "N/A"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        {(trip.status === "IN_TRANSIT" || trip.status === "PICKUP_PENDING") &&
          trip.trackingEnabled && (
            <Link
              href={`/dispatcher/map?tripId=${trip.id}`}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
            >
              View Map
            </Link>
          )}
      </div>

      {/* Reassign Truck Modal */}
      {showReassign && trip.truck && (
        <ReassignTruckModal
          trip={{
            id: trip.id,
            truckId: trip.truck.id,
            truck: {
              carrierId: trip.carrier?.id || "",
              licensePlate: trip.truck.licensePlate,
            },
          }}
          onSuccess={() => {
            setShowReassign(false);
            fetchTrip();
          }}
          onClose={() => setShowReassign(false)}
        />
      )}
    </div>
  );
}

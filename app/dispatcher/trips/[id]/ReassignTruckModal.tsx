/**
 * Reassign Truck Modal
 *
 * Allows dispatchers/admins to reassign a truck on an EXCEPTION trip.
 * Fetches available trucks from the same carrier org and submits
 * to POST /api/trips/[tripId]/reassign-truck.
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { getCSRFToken } from "@/lib/csrfFetch";

interface AvailableTruck {
  id: string;
  licensePlate: string;
  truckType: string;
}

interface ReassignTruckModalProps {
  trip: {
    id: string;
    truckId: string;
    truck: {
      carrierId: string;
      licensePlate: string;
    };
  };
  onSuccess: () => void;
  onClose: () => void;
}

export default function ReassignTruckModal({
  trip,
  onSuccess,
  onClose,
}: ReassignTruckModalProps) {
  const [trucks, setTrucks] = useState<AvailableTruck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const fetchAvailableTrucks = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        carrierId: trip.truck.carrierId,
        isAvailable: "true",
      });
      const response = await fetch(`/api/trucks?${params.toString()}`);

      if (!response.ok) {
        throw new Error("Failed to fetch available trucks");
      }

      const data = await response.json();
      const truckList: AvailableTruck[] = (data.trucks || []).filter(
        (t: AvailableTruck) => t.id !== trip.truckId
      );
      setTrucks(truckList);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to load trucks";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [trip.truck.carrierId, trip.truckId]);

  useEffect(() => {
    fetchAvailableTrucks();
  }, [fetchAvailableTrucks]);

  const handleSubmit = async () => {
    if (!selectedTruckId || !reason.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/trips/${trip.id}/reassign-truck`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          newTruckId: selectedTruckId,
          reason: reason.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to reassign truck");
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to reassign truck";
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">
            Reassign Truck
          </h2>
          <button
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg
              className="h-5 w-5"
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
          </button>
        </div>

        {/* Current truck info */}
        <div className="mb-4 rounded-lg bg-slate-50 p-3">
          <p className="text-xs font-medium text-slate-500 uppercase">
            Current Truck
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800">
            {trip.truck.licensePlate}
          </p>
        </div>

        {/* Success message */}
        {success && (
          <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
            Truck reassigned successfully. Refreshing...
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Available trucks list */}
        <div className="mb-4">
          <p className="mb-2 text-sm font-medium text-slate-700">
            Select replacement truck
          </p>
          {loading ? (
            <div className="py-8 text-center">
              <div className="inline-block h-6 w-6 animate-spin rounded-full border-b-2 border-teal-500"></div>
              <p className="mt-2 text-xs text-slate-500">
                Loading available trucks...
              </p>
            </div>
          ) : trucks.length === 0 ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center text-sm text-amber-700">
              No available trucks from this carrier. Contact the carrier to free
              a truck first.
            </div>
          ) : (
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {trucks.map((truck) => (
                <button
                  key={truck.id}
                  onClick={() => setSelectedTruckId(truck.id)}
                  disabled={success}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors ${
                    selectedTruckId === truck.id
                      ? "border-teal-500 bg-teal-50"
                      : "border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {truck.licensePlate}
                    </p>
                    <p className="text-xs text-slate-500">
                      {truck.truckType?.replace(/_/g, " ")}
                    </p>
                  </div>
                  {selectedTruckId === truck.id && (
                    <svg
                      className="h-5 w-5 text-teal-600"
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
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Reason field */}
        <div className="mb-4">
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Reason for reassignment
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. breakdown, mechanical failure"
            disabled={success}
            rows={3}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-2 focus:ring-teal-500 disabled:bg-slate-50"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={
              !selectedTruckId || !reason.trim() || submitting || success
            }
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
          >
            {submitting ? "Reassigning..." : "Reassign Truck"}
          </button>
        </div>
      </div>
    </div>
  );
}

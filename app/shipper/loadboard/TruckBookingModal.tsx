/**
 * Truck Booking Modal
 *
 * Phase 2 - Story 16.15: Shipper-Led Truck Matching
 * Task 16.15.2: Direct Booking Button
 *
 * Modal for shippers to request a specific truck for their load
 */

"use client";

import { useState, useEffect } from "react";
import { getCSRFToken } from "@/lib/csrfFetch";

interface Load {
  id: string;
  referenceNumber: string;
  status: string;
  pickupCityName: string;
  deliveryCityName: string;
  weight: number;
  truckType: string;
  pickupDate: string;
  offeredRate?: number;
}

// L33 FIX: Make carrier and originCity optional for flexibility
interface TruckPosting {
  id: string;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  carrier?: {
    name: string;
    isVerified?: boolean;
  };
  originCity?: {
    name: string;
  } | null;
  destinationCity?: {
    name: string;
  } | null;
  destinationCityObj?: {
    name: string;
  } | null;
  availableFrom: string;
  availableTo?: string | null;
  contactName?: string;
  contactPhone?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  truckPosting: TruckPosting | null;
  onRequestSent?: (truckId: string) => void;
}

export default function TruckBookingModal({
  isOpen,
  onClose,
  truckPosting,
  onRequestSent,
}: Props) {
  const [loads, setLoads] = useState<Load[]>([]);
  const [selectedLoadId, setSelectedLoadId] = useState<string>("");
  // No offeredRate - price negotiation happens outside platform
  const [notes, setNotes] = useState<string>("");
  const [expiryHours, setExpiryHours] = useState<string>("24");
  const [loading, setLoading] = useState(false);
  const [loadingLoads, setLoadingLoads] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Fetch shipper's posted loads
  useEffect(() => {
    if (isOpen) {
      fetchLoads();
      setError(null);
      setSuccess(false);
      setSelectedLoadId("");
      setNotes("");
    }
  }, [isOpen]);

  const fetchLoads = async () => {
    setLoadingLoads(true);
    try {
      // Include myLoads=true to only fetch loads belonging to the current user's organization
      const response = await fetch(
        "/api/loads?status=POSTED,SEARCHING,OFFERED&myLoads=true&limit=100"
      );
      // H34 FIX: Handle non-ok response with error state
      if (!response.ok) {
        console.error("Failed to fetch loads:", response.status);
        setError("Failed to load your posted loads. Please try again.");
        return;
      }
      const data = await response.json();
      setLoads(data.loads || []);
    } catch (err) {
      console.error("Failed to fetch loads:", err);
      setError("Failed to load your posted loads. Please try again.");
    } finally {
      setLoadingLoads(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLoadId || !truckPosting) return;

    setLoading(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      if (!csrfToken) {
        throw new Error("Failed to get security token. Please try again.");
      }

      const response = await fetch("/api/truck-requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          loadId: selectedLoadId,
          truckId: truckPosting.truck.id,
          notes: notes || undefined,
          // No offeredRate - price negotiation happens outside platform
          expiresInHours: parseInt(expiryHours, 10),
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create booking request");
      }

      setSuccess(true);
      // Notify parent that request was sent for this truck
      if (onRequestSent && truckPosting?.truck?.id) {
        onRequestSent(truckPosting.truck.id);
      }
      setTimeout(() => {
        onClose();
      }, 2000);
    } catch (err) {
      // L37 FIX: Proper error handling without any
      const message =
        err instanceof Error ? err.message : "Failed to send request";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !truckPosting) return null;

  const selectedLoad = loads.find((l) => l.id === selectedLoadId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-white shadow-xl dark:bg-slate-800">
        <div className="border-b border-slate-200 px-6 py-4 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-800 dark:text-white">
              Request Truck
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Truck Info */}
        <div className="border-b border-slate-200 bg-teal-600/10 px-6 py-4 dark:border-slate-700 dark:bg-blue-900/20">
          <h3 className="mb-2 text-sm font-medium text-slate-800 dark:text-blue-200">
            Selected Truck
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-slate-500 dark:text-gray-400 dark:text-slate-400">
                Plate:
              </span>{" "}
              <span className="font-medium text-slate-800 dark:text-white">
                {truckPosting.truck?.licensePlate || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-gray-400 dark:text-slate-400">
                Type:
              </span>{" "}
              <span className="font-medium text-slate-800 dark:text-white">
                {truckPosting.truck?.truckType || "N/A"}
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-gray-400 dark:text-slate-400">
                Capacity:
              </span>{" "}
              <span className="font-medium text-slate-800 dark:text-white">
                {truckPosting.truck?.capacity?.toLocaleString() || "N/A"} kg
              </span>
            </div>
            <div>
              <span className="text-slate-500 dark:text-gray-400 dark:text-slate-400">
                Carrier:
              </span>{" "}
              <span className="font-medium text-slate-800 dark:text-white">
                {truckPosting.carrier?.name || "Unknown"}
              </span>
            </div>
            <div className="col-span-2">
              <span className="text-slate-500 dark:text-gray-400 dark:text-slate-400">
                Route:
              </span>{" "}
              <span className="font-medium text-slate-800 dark:text-white">
                {truckPosting.originCity?.name || "N/A"}
                {truckPosting.destinationCity?.name
                  ? ` → ${truckPosting.destinationCity.name}`
                  : " (Anywhere)"}
              </span>
            </div>
          </div>
        </div>

        {success ? (
          <div className="px-6 py-8 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
              <svg
                className="h-8 w-8 text-green-600"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-slate-800 dark:text-white">
              Request Sent!
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              The carrier will be notified of your request.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 p-6">
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/30">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}

            {/* Load Selection */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Select Load *
              </label>
              {loadingLoads ? (
                <div className="h-10 animate-pulse rounded bg-gray-200 dark:bg-gray-700"></div>
              ) : loads.length === 0 ? (
                <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    You don&apos;t have any posted loads. Please post a load
                    first.
                  </p>
                </div>
              ) : (
                <select
                  value={selectedLoadId}
                  onChange={(e) => setSelectedLoadId(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-teal-500 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                >
                  <option value="">Select a load...</option>
                  {loads.map((load) => (
                    <option key={load.id} value={load.id}>
                      {load.referenceNumber || load.id.slice(-8)} -{" "}
                      {load.pickupCityName} → {load.deliveryCityName} (
                      {load.weight} kg, {load.truckType})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Selected Load Details */}
            {selectedLoad && (
              <div className="rounded-lg bg-gray-50 p-3 dark:bg-slate-700">
                <h4 className="mb-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Load Details
                </h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">
                      Route:
                    </span>{" "}
                    <span className="text-slate-800 dark:text-white">
                      {selectedLoad.pickupCityName} →{" "}
                      {selectedLoad.deliveryCityName}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">
                      Pickup:
                    </span>{" "}
                    <span className="text-slate-800 dark:text-white">
                      {new Date(selectedLoad.pickupDate).toLocaleDateString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">
                      Weight:
                    </span>{" "}
                    <span className="text-slate-800 dark:text-white">
                      {selectedLoad.weight.toLocaleString()} kg
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">
                      Type:
                    </span>{" "}
                    <span className="text-slate-800 dark:text-white">
                      {selectedLoad.truckType}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Service Fee Info */}
            <div className="rounded-lg border border-teal-200 bg-teal-50 p-3 dark:border-teal-800 dark:bg-teal-900/20">
              <div className="flex items-start gap-2">
                <svg
                  className="mt-0.5 h-5 w-5 text-teal-600 dark:text-teal-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-teal-800 dark:text-teal-200">
                    Price Negotiation
                  </h4>
                  <p className="mt-1 text-xs text-teal-700 dark:text-teal-300">
                    You will negotiate the freight rate directly with the
                    carrier after they accept your request. The platform only
                    charges a service fee based on distance.
                  </p>
                </div>
              </div>
            </div>

            {/* Request Expiry */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Request Valid For
              </label>
              <select
                value={expiryHours}
                onChange={(e) => setExpiryHours(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-teal-500 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              >
                <option value="6">6 hours</option>
                <option value="12">12 hours</option>
                <option value="24">24 hours</option>
                <option value="48">48 hours</option>
                <option value="72">72 hours</option>
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Notes
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Any special instructions or requirements..."
                className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:border-teal-500 focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-700 dark:text-white"
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-gray-700 hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedLoadId || loads.length === 0}
                className="rounded-lg bg-teal-600 px-4 py-2 text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "Sending..." : "Send Request"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

/**
 * Carrier Trip History Page
 *
 * Shows completed/delivered trips with:
 * - List view: origin, destination, delivery date, distance
 * - Map view with route playback
 * - Trip details on selection
 */

"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import TripHistoryPlayback from "@/components/TripHistoryPlayback";

interface CompletedTrip {
  id: string;
  loadId: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  pickupAddress?: string;
  deliveryAddress?: string;
  completedAt?: string;
  deliveredAt?: string;
  startedAt?: string;
  estimatedDistanceKm?: number;
  actualDistanceKm?: number;
  truck?: {
    id: string;
    licensePlate: string;
    truckType?: string;
  };
  shipper?: {
    id: string;
    name: string;
  };
  load?: {
    weight?: number;
    cargoDescription?: string;
  };
}

export default function TripHistoryPage() {
  const router = useRouter();
  const [trips, setTrips] = useState<CompletedTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<CompletedTrip | null>(null);
  const [showMap, setShowMap] = useState(false);

  useEffect(() => {
    fetchCompletedTrips();
  }, []);

  const fetchCompletedTrips = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch completed and delivered trips
      const response = await fetch("/api/trips?status=DELIVERED,COMPLETED");

      if (!response.ok) {
        throw new Error("Failed to fetch trip history");
      }

      const data = await response.json();
      setTrips(data.trips || []);
    } catch (err) {
      console.error("Error fetching trip history:", err);
      setError("Failed to load trip history");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return "-";
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleViewMap = (trip: CompletedTrip) => {
    setSelectedTrip(trip);
    setShowMap(true);
  };

  const handleCloseMap = () => {
    setShowMap(false);
    setSelectedTrip(null);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Trip History
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            View your completed deliveries and route history
          </p>
        </div>
        <button
          onClick={fetchCompletedTrips}
          className="rounded-lg bg-[#1e9c99]/10 px-4 py-2 text-sm font-medium text-[#1e9c99] hover:bg-[#1e9c99]/20"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}

      {/* Map Modal */}
      {showMap && selectedTrip && (
        <div className="bg-opacity-50 fixed inset-0 z-50 flex items-center justify-center bg-black p-4">
          <div className="w-full max-w-5xl overflow-hidden rounded-lg bg-white dark:bg-slate-800">
            <TripHistoryPlayback
              tripId={selectedTrip.id}
              height="600px"
              onClose={handleCloseMap}
            />
          </div>
        </div>
      )}

      {/* Trip List */}
      {loading ? (
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg bg-gray-200 dark:bg-slate-700"
            />
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="rounded-lg bg-gray-50 py-16 text-center dark:bg-slate-800">
          <div className="mb-4 text-5xl">🚚</div>
          <h3 className="mb-2 text-lg font-medium text-gray-900 dark:text-white">
            No completed trips yet
          </h3>
          <p className="mx-auto max-w-md text-gray-500 dark:text-gray-400">
            When you complete deliveries, they will appear here with full route
            history and details.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {trips.map((trip) => (
            <div
              key={trip.id}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  {/* Route Info */}
                  <div className="flex-1">
                    <div className="mb-2 flex items-center gap-3">
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-800 dark:bg-green-900 dark:text-green-200">
                        {trip.status === "COMPLETED"
                          ? "Completed"
                          : "Delivered"}
                      </span>
                      {trip.truck && (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {trip.truck.licensePlate}
                        </span>
                      )}
                    </div>

                    {/* Origin - Destination */}
                    <div className="mb-3 flex items-center gap-2">
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-green-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {trip.pickupCity}
                          </p>
                          {trip.pickupAddress && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {trip.pickupAddress}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="mx-2 flex-1 border-t-2 border-dashed border-gray-300 dark:border-slate-600" />

                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 rounded-full bg-red-500" />
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {trip.deliveryCity}
                          </p>
                          {trip.deliveryAddress && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {trip.deliveryAddress}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Trip Details Row */}
                    <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                      {trip.estimatedDistanceKm && (
                        <div className="flex items-center gap-1">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                            />
                          </svg>
                          <span>{Math.round(trip.estimatedDistanceKm)} km</span>
                        </div>
                      )}

                      <div className="flex items-center gap-1">
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        <span>
                          Delivered:{" "}
                          {formatDate(trip.deliveredAt || trip.completedAt)}
                        </span>
                      </div>

                      {trip.shipper && (
                        <div className="flex items-center gap-1">
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                            />
                          </svg>
                          <span>{trip.shipper.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* View Map Button */}
                  <button
                    onClick={() => handleViewMap(trip)}
                    className="ml-4 flex items-center gap-2 rounded-lg bg-[#1e9c99] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#064d51]"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                      />
                    </svg>
                    View Route
                  </button>
                </div>
              </div>

              {/* Expandable Details Section */}
              {trip.load && (
                <div className="px-4 pt-0 pb-4">
                  <div className="border-t border-gray-200 pt-3 dark:border-slate-700">
                    <div className="flex items-center gap-6 text-sm text-gray-600 dark:text-gray-400">
                      {trip.load.weight && (
                        <span>
                          Weight: {Number(trip.load.weight).toLocaleString()} kg
                        </span>
                      )}
                      {trip.load.cargoDescription && (
                        <span>Cargo: {trip.load.cargoDescription}</span>
                      )}
                      {trip.truck?.truckType && (
                        <span>Truck Type: {trip.truck.truckType}</span>
                      )}
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

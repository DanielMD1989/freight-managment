/**
 * Shipper Map Page
 *
 * Track shipment in real-time
 * MAP + GPS Implementation - Epic 4: Shipper Map Access
 *
 * Features:
 * - View active shipment location (only when IN_TRANSIT)
 * - Real-time GPS updates via WebSocket
 * - Trip progress tracking (%, remaining km, ETA)
 * - See pickup and delivery markers
 * - Route visualization
 * - Access control: Only after carrier approves load
 */

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import GoogleMap, { MapMarker, MapRoute } from "@/components/GoogleMap";
import { useGpsRealtime, GpsPosition } from "@/hooks/useGpsRealtime";
import TripHistoryPlayback from "@/components/TripHistoryPlayback";

interface TripProgress {
  percent: number;
  remainingKm: number | null;
  totalDistanceKm: number | null;
  travelledKm: number | null;
  estimatedArrival: string | null;
  isNearDestination: boolean;
  enteredDestGeofence: boolean;
  lastUpdate: string | null;
}

interface ShipmentTrip {
  id: string;
  loadId: string;
  status: string;
  truck: {
    id: string;
    plateNumber: string;
    truckType: string;
  };
  carrier: {
    name: string;
    phone?: string;
  };
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  pickupLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  deliveryLocation: {
    lat: number;
    lng: number;
    address: string;
  };
  estimatedArrival?: string;
  startedAt?: string;
}

export default function ShipperMapPage() {
  const searchParams = useSearchParams();
  const loadIdParam = searchParams.get("loadId");
  const showHistory = searchParams.get("history") === "true";

  const [activeTrips, setActiveTrips] = useState<ShipmentTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<ShipmentTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tripProgress, setTripProgress] = useState<TripProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [showHistoryPlayback, setShowHistoryPlayback] = useState(showHistory);

  // Ref to track selected truck ID for GPS callback (avoids re-creating callback on every GPS update)
  const selectedTruckIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedTruckIdRef.current = selectedTrip?.truck.id ?? null;
  }, [selectedTrip?.truck.id]);

  // Real-time GPS updates
  const { isConnected, subscribeToTrip, unsubscribeFromTrip } = useGpsRealtime({
    autoConnect: true,
    onPositionUpdate: useCallback((position: GpsPosition) => {
      // Update the selected trip's current location if it matches
      if (
        selectedTruckIdRef.current &&
        position.truckId === selectedTruckIdRef.current
      ) {
        setSelectedTrip((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            currentLocation: {
              lat: position.lat,
              lng: position.lng,
              updatedAt: position.timestamp,
            },
          };
        });
        // Also update in the activeTrips list
        setActiveTrips((prev) =>
          prev.map((trip) => {
            if (trip.truck.id === position.truckId) {
              return {
                ...trip,
                currentLocation: {
                  lat: position.lat,
                  lng: position.lng,
                  updatedAt: position.timestamp,
                },
              };
            }
            return trip;
          })
        );
      }
    }, []),
  });

  // Subscribe to selected trip's GPS updates
  useEffect(() => {
    if (selectedTrip?.loadId && selectedTrip.status === "IN_TRANSIT") {
      subscribeToTrip(selectedTrip.loadId);
      return () => {
        unsubscribeFromTrip(selectedTrip.loadId);
      };
    }
  }, [
    selectedTrip?.loadId,
    selectedTrip?.status,
    subscribeToTrip,
    unsubscribeFromTrip,
  ]);

  // Fetch trip progress when selected trip changes
  useEffect(() => {
    if (selectedTrip?.loadId && selectedTrip.status === "IN_TRANSIT") {
      fetchTripProgress(selectedTrip.loadId);
      // Refresh progress every 30 seconds
      const interval = setInterval(() => {
        if (selectedTrip?.loadId) {
          fetchTripProgress(selectedTrip.loadId);
        }
      }, 30000);
      return () => clearInterval(interval);
    } else {
      setTripProgress(null);
    }
  }, [selectedTrip?.loadId, selectedTrip?.status]);

  const fetchMyTrips = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // If loadId is specified and we want history, fetch that specific load
      if (loadIdParam && showHistory) {
        const response = await fetch(
          `/api/map/trips?role=shipper&loadId=${loadIdParam}&includeCompleted=true`
        );
        if (!response.ok) {
          throw new Error("Failed to fetch trip");
        }
        const data = await response.json();
        const trips = data.trips || [];
        setActiveTrips(trips);
        if (trips.length > 0) {
          setSelectedTrip(trips[0]);
          setShowHistoryPlayback(true);
        }
        return;
      }

      const response = await fetch("/api/map/trips?role=shipper");

      if (!response.ok) {
        throw new Error("Failed to fetch trips");
      }

      const data = await response.json();
      const trips = data.trips || [];
      setActiveTrips(trips);

      // Auto-select trip based on loadId param or first trip
      if (trips.length > 0) {
        if (loadIdParam) {
          const targetTrip = trips.find(
            (t: ShipmentTrip) => t.loadId === loadIdParam
          );
          if (targetTrip) {
            setSelectedTrip(targetTrip);
          } else {
            setSelectedTrip(trips[0]);
          }
        } else if (!selectedTrip) {
          setSelectedTrip(trips[0]);
        }
      }
    } catch (err) {
      setError("Failed to load shipment data");
      console.error("Shipment data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [loadIdParam, showHistory, selectedTrip]);

  useEffect(() => {
    fetchMyTrips();
  }, [fetchMyTrips]);

  const fetchTripProgress = async (loadId: string) => {
    try {
      setProgressLoading(true);
      const response = await fetch(`/api/loads/${loadId}/progress`);
      if (response.ok) {
        const data = await response.json();
        setTripProgress(data.progress);
      }
    } catch (err) {
      console.error("Failed to fetch trip progress:", err);
    } finally {
      setProgressLoading(false);
    }
  };

  // Build markers for selected trip
  const buildMarkers = (): MapMarker[] => {
    if (!selectedTrip) return [];

    const markers: MapMarker[] = [];

    // Pickup marker
    if (selectedTrip.pickupLocation) {
      markers.push({
        id: `pickup-${selectedTrip.id}`,
        position: selectedTrip.pickupLocation,
        title: `Pickup: ${selectedTrip.pickupLocation.address}`,
        type: "pickup",
      });
    }

    // Delivery marker
    if (selectedTrip.deliveryLocation) {
      markers.push({
        id: `delivery-${selectedTrip.id}`,
        position: selectedTrip.deliveryLocation,
        title: `Delivery: ${selectedTrip.deliveryLocation.address}`,
        type: "delivery",
      });
    }

    // Current truck location (only if IN_TRANSIT)
    if (selectedTrip.status === "IN_TRANSIT" && selectedTrip.currentLocation) {
      markers.push({
        id: `truck-${selectedTrip.id}`,
        position: selectedTrip.currentLocation,
        title: `${selectedTrip.truck.plateNumber} - In Transit`,
        type: "truck",
        status: "in_transit",
      });
    }

    return markers;
  };

  // Build route for selected trip
  const buildRoutes = (): MapRoute[] => {
    if (
      !selectedTrip ||
      !selectedTrip.pickupLocation ||
      !selectedTrip.deliveryLocation
    ) {
      return [];
    }

    return [
      {
        id: `route-${selectedTrip.id}`,
        origin: selectedTrip.pickupLocation,
        destination: selectedTrip.deliveryLocation,
        waypoints: selectedTrip.currentLocation
          ? [selectedTrip.currentLocation]
          : [],
        color: "#2563eb",
        tripId: selectedTrip.id,
      },
    ];
  };

  const formatETA = (eta: string | null) => {
    if (!eta) return "Calculating...";
    const date = new Date(eta);
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const formatDistance = (km: number | null) => {
    if (km === null) return "--";
    return `${km.toFixed(1)} km`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl animate-pulse">
          <div className="mb-2 h-8 w-1/4 rounded-lg bg-slate-200"></div>
          <div className="mb-6 h-4 w-1/3 rounded bg-slate-200"></div>
          <div className="h-[600px] rounded-2xl border border-slate-200/60 bg-white"></div>
        </div>
      </div>
    );
  }

  // No active trips
  if (activeTrips.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-7xl">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-800">
              Track Shipments
            </h1>
            <p className="mt-1 text-slate-500">
              Real-time GPS tracking of your active shipments
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200/60 bg-white p-12 text-center shadow-sm">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
              <svg
                className="h-8 w-8 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                />
              </svg>
            </div>
            <h2 className="mb-2 text-xl font-semibold text-slate-800">
              No Active Shipments
            </h2>
            <p className="mx-auto mb-6 max-w-md text-slate-500">
              You don&apos;t have any active shipments to track. Map tracking
              becomes available when your load is approved and the carrier
              starts the trip.
            </p>
            <a
              href="/shipper?tab=POST_LOADS"
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 px-5 py-2.5 text-sm font-medium text-white shadow-md shadow-teal-500/25 transition-all hover:shadow-lg hover:shadow-teal-500/30"
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
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Post a Load
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">
              Track Shipments
            </h1>
            <p className="mt-1 text-slate-500">
              Real-time GPS tracking of your active shipments
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* WebSocket Status */}
            <div className="flex items-center gap-2 rounded-full border border-slate-200/60 bg-white px-3 py-1.5 text-sm">
              <div
                className={`h-2 w-2 rounded-full ${isConnected ? "animate-pulse bg-emerald-500" : "bg-slate-400"}`}
              />
              <span className="text-slate-600">
                {isConnected ? "Live" : "Offline"}
              </span>
            </div>
            <button
              onClick={fetchMyTrips}
              className="rounded-xl border border-slate-200/60 bg-white px-4 py-2 text-sm font-medium text-teal-600 transition-colors hover:bg-teal-50"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
            {error}
          </div>
        )}

        {/* Trip Selector (if multiple trips) */}
        {activeTrips.length > 1 && (
          <div className="inline-flex gap-1 overflow-x-auto rounded-2xl border border-slate-200/60 bg-white p-1.5 shadow-sm">
            {activeTrips.map((trip) => (
              <button
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className={`rounded-xl px-4 py-2 text-sm font-medium whitespace-nowrap transition-all ${
                  selectedTrip?.id === trip.id
                    ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                Load #{trip.loadId.slice(-6)}
              </button>
            ))}
          </div>
        )}

        {/* Trip Progress Card */}
        {selectedTrip &&
          selectedTrip.status === "IN_TRANSIT" &&
          tripProgress && (
            <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-100 bg-gradient-to-r from-slate-50 to-teal-50/30 px-6 py-4">
                <div>
                  <h3 className="font-semibold text-slate-800">
                    Trip Progress
                  </h3>
                  <p className="text-sm text-slate-500">
                    Real-time journey tracking
                  </p>
                </div>
                {progressLoading && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-teal-500 border-t-transparent" />
                )}
              </div>
              <div className="p-6">
                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="mb-2 flex justify-between text-sm">
                    <span className="text-slate-500">
                      {tripProgress.travelledKm !== null
                        ? `${tripProgress.travelledKm.toFixed(1)} km travelled`
                        : "In progress"}
                    </span>
                    <span className="font-semibold text-slate-800">
                      {tripProgress.percent}%
                    </span>
                  </div>
                  <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-teal-600 to-teal-400 transition-all duration-500"
                      style={{ width: `${tripProgress.percent}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-slate-400">
                    <span>Pickup</span>
                    <span>
                      {tripProgress.remainingKm !== null
                        ? `${tripProgress.remainingKm.toFixed(1)} km remaining`
                        : ""}
                    </span>
                    <span>Delivery</span>
                  </div>
                </div>

                {/* Progress Stats */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <div className="text-2xl font-bold text-teal-600">
                      {tripProgress.percent}%
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Complete</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <div className="text-2xl font-bold text-slate-800">
                      {formatDistance(tripProgress.remainingKm)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">Remaining</div>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-4 text-center">
                    <div className="text-2xl font-bold text-emerald-600">
                      {formatETA(tripProgress.estimatedArrival)}
                    </div>
                    <div className="mt-1 text-xs text-slate-500">ETA</div>
                  </div>
                </div>

                {/* Near Destination Alert */}
                {tripProgress.isNearDestination && (
                  <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
                      <span className="text-sm font-medium text-emerald-700">
                        Approaching destination!
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Shipment Info Card */}
        {selectedTrip && (
          <div className="rounded-2xl border border-slate-200/60 bg-white p-6 shadow-sm">
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              <div>
                <div className="mb-1 text-sm text-slate-500">Status</div>
                <div
                  className={`font-semibold ${
                    selectedTrip.status === "IN_TRANSIT"
                      ? "text-teal-600"
                      : selectedTrip.status === "DELIVERED"
                        ? "text-emerald-600"
                        : "text-slate-600"
                  }`}
                >
                  {selectedTrip.status.replace("_", " ")}
                </div>
              </div>
              <div>
                <div className="mb-1 text-sm text-slate-500">Carrier</div>
                <div className="font-semibold text-slate-800">
                  {selectedTrip.carrier.name}
                </div>
              </div>
              <div>
                <div className="mb-1 text-sm text-slate-500">Truck</div>
                <div className="font-semibold text-slate-800">
                  {selectedTrip.truck.plateNumber}
                </div>
              </div>
              <div>
                <div className="mb-1 text-sm text-slate-500">ETA</div>
                <div className="font-semibold text-slate-800">
                  {tripProgress?.estimatedArrival
                    ? formatETA(tripProgress.estimatedArrival)
                    : selectedTrip.estimatedArrival || "Calculating..."}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-sm">
          <GoogleMap
            markers={buildMarkers()}
            routes={buildRoutes()}
            height="500px"
            autoFitBounds={true}
            showTraffic={true}
            refreshInterval={0} // Disabled - using WebSocket instead
          />
        </div>

        {/* Location Details */}
        {selectedTrip && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Pickup */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
                <span className="font-semibold text-slate-800">Pickup</span>
              </div>
              <p className="text-sm text-slate-500">
                {selectedTrip.pickupLocation?.address ||
                  "Address not available"}
              </p>
            </div>

            {/* Delivery */}
            <div className="rounded-2xl border border-slate-200/60 bg-white p-5 shadow-sm">
              <div className="mb-2 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-rose-500"></div>
                <span className="font-semibold text-slate-800">Delivery</span>
              </div>
              <p className="text-sm text-slate-500">
                {selectedTrip.deliveryLocation?.address ||
                  "Address not available"}
              </p>
            </div>
          </div>
        )}

        {/* GPS Status */}
        {selectedTrip && selectedTrip.status === "IN_TRANSIT" && (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className={`h-2 w-2 rounded-full ${isConnected ? "animate-pulse bg-teal-500" : "bg-slate-400"}`}
                ></div>
                <span className="text-sm text-teal-700">
                  {isConnected
                    ? "Live tracking active"
                    : "Connecting to live tracking..."}
                  {selectedTrip.currentLocation?.updatedAt && (
                    <span className="ml-2 text-teal-600">
                      - Last update:{" "}
                      {new Date(
                        selectedTrip.currentLocation.updatedAt
                      ).toLocaleTimeString()}
                    </span>
                  )}
                </span>
              </div>
              {tripProgress?.lastUpdate && (
                <span className="text-xs text-teal-500">
                  Progress updated:{" "}
                  {new Date(tripProgress.lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Access Info */}
        <div className="py-2 text-center text-xs text-slate-400">
          Map tracking is only available for approved loads with active trips.
          GPS data is provided by the carrier.
        </div>

        {/* View History Button for completed trips */}
        {selectedTrip &&
          (selectedTrip.status === "DELIVERED" ||
            selectedTrip.status === "COMPLETED") && (
            <div className="rounded-2xl border border-slate-200/60 bg-white p-6 text-center shadow-sm">
              <div className="mb-4">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-100">
                  <svg
                    className="h-6 w-6 text-emerald-600"
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
                </div>
                <h3 className="text-lg font-semibold text-slate-800">
                  Trip Completed
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  This shipment has been delivered. View the route history
                  below.
                </p>
              </div>
              <button
                onClick={() => setShowHistoryPlayback(true)}
                className="mx-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-6 py-3 font-medium text-white transition-all hover:shadow-lg hover:shadow-emerald-500/30"
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
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Replay Route History
              </button>
            </div>
          )}
      </div>

      {/* History Playback Modal */}
      {showHistoryPlayback && selectedTrip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-emerald-50/30 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">
                  Route History Playback
                </h2>
                <p className="text-sm text-slate-500">
                  {selectedTrip.pickupLocation?.address} →{" "}
                  {selectedTrip.deliveryLocation?.address}
                </p>
              </div>
              <button
                onClick={() => setShowHistoryPlayback(false)}
                className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
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
            <div className="p-4">
              <TripHistoryPlayback
                tripId={selectedTrip.loadId}
                onClose={() => setShowHistoryPlayback(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

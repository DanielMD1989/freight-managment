/**
 * Admin Map Page
 *
 * Global overview of all platform operations
 * MAP + GPS Implementation - Epic 1: Super Admin / Admin Map Access
 *
 * Features:
 * - View all active and historical trips
 * - Real-time GPS updates via WebSocket
 * - Fleet overview with GPS status
 * - Platform-wide statistics
 * - Filter by carrier, shipper, status, date
 * - Historical trip playback
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import GoogleMap, { MapMarker, MapRoute } from "@/components/GoogleMap";
import { useGpsRealtime, GpsPosition } from "@/hooks/useGpsRealtime";
import TripHistoryPlayback from "@/components/TripHistoryPlayback";

interface Vehicle {
  id: string;
  plateNumber: string;
  truckType: string;
  status: string;
  gpsStatus: "ACTIVE" | "OFFLINE" | "NO_DEVICE";
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt: string;
  };
  carrier: {
    id: string;
    name: string;
  };
}

interface Trip {
  id: string;
  loadId: string;
  status: string;
  truck: {
    id: string;
    plateNumber: string;
  };
  carrier: {
    id: string;
    name: string;
  };
  shipper: {
    id: string;
    name: string;
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
  startedAt?: string;
  completedAt?: string;
}

interface PlatformStats {
  totalVehicles: number;
  activeGps: number;
  offlineGps: number;
  noDevice: number;
  activeTrips: number;
  completedToday: number;
}

interface Carrier {
  id: string;
  name: string;
}

interface Shipper {
  id: string;
  name: string;
}

type ViewMode = "overview" | "fleet" | "trips" | "historical";

export default function AdminMapPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [historicalTrips, setHistoricalTrips] = useState<Trip[]>([]);
  const [filteredHistorical, setFilteredHistorical] = useState<Trip[]>([]);
  const [stats, setStats] = useState<PlatformStats>({
    totalVehicles: 0,
    activeGps: 0,
    offlineGps: 0,
    noDevice: 0,
    activeTrips: 0,
    completedToday: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("overview");
  const [selectedItem, setSelectedItem] = useState<MapMarker | null>(null);
  const [carriers, setCarriers] = useState<Carrier[]>([]);
  const [shippers, setShippers] = useState<Shipper[]>([]);
  const [filters, setFilters] = useState({
    carrier: "",
    shipper: "",
    status: "",
    dateFrom: "",
    dateTo: "",
  });
  const [showPlayback, setShowPlayback] = useState(false);
  const [playbackTripId, setPlaybackTripId] = useState<string | null>(null);

  // Real-time GPS updates (subscribe to all for admin)
  const { isConnected, positions } = useGpsRealtime({
    autoConnect: true,
    subscribeAll: true,
    onPositionUpdate: useCallback((position: GpsPosition) => {
      // Update vehicles with new position
      setVehicles((prev) =>
        prev.map((v) => {
          if (v.id === position.truckId) {
            return {
              ...v,
              currentLocation: {
                lat: position.lat,
                lng: position.lng,
                updatedAt: position.timestamp,
              },
              gpsStatus: "ACTIVE" as const,
            };
          }
          return v;
        })
      );

      // Update trips with new position
      setTrips((prev) =>
        prev.map((t) => {
          if (t.truck.id === position.truckId) {
            return {
              ...t,
              currentLocation: {
                lat: position.lat,
                lng: position.lng,
                updatedAt: position.timestamp,
              },
            };
          }
          return t;
        })
      );
    }, []),
  });

  useEffect(() => {
    fetchMapData();
    fetchFiltersData();
  }, []);

  // Apply filters to historical trips
  useEffect(() => {
    let filtered = [...historicalTrips];

    if (filters.carrier) {
      filtered = filtered.filter((t) => t.carrier.id === filters.carrier);
    }
    if (filters.shipper) {
      filtered = filtered.filter((t) => t.shipper.id === filters.shipper);
    }
    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom);
      filtered = filtered.filter(
        (t) => t.completedAt && new Date(t.completedAt) >= fromDate
      );
    }
    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(
        (t) => t.completedAt && new Date(t.completedAt) <= toDate
      );
    }

    setFilteredHistorical(filtered.slice(0, 20));
  }, [historicalTrips, filters]);

  const fetchMapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [vehiclesRes, tripsRes] = await Promise.all([
        fetch("/api/map/vehicles?includeAll=true"),
        fetch("/api/map/trips"),
      ]);

      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json();
        const vehicleList = data.vehicles || [];
        setVehicles(vehicleList);

        setStats((prev) => ({
          ...prev,
          totalVehicles: vehicleList.length,
          activeGps: vehicleList.filter(
            (v: Vehicle) => v.gpsStatus === "ACTIVE"
          ).length,
          offlineGps: vehicleList.filter(
            (v: Vehicle) => v.gpsStatus === "OFFLINE"
          ).length,
          noDevice: vehicleList.filter(
            (v: Vehicle) => v.gpsStatus === "NO_DEVICE"
          ).length,
        }));
      }

      if (tripsRes.ok) {
        const data = await tripsRes.json();
        const tripList = data.trips || [];
        const activeTrips = tripList.filter(
          (t: Trip) => t.status === "IN_TRANSIT"
        );
        const completed = tripList.filter((t: Trip) => {
          if (t.status !== "COMPLETED" || !t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          const today = new Date();
          return completedDate.toDateString() === today.toDateString();
        });

        setTrips(activeTrips);
        setHistoricalTrips(
          tripList.filter((t: Trip) => t.status === "COMPLETED")
        );

        setStats((prev) => ({
          ...prev,
          activeTrips: activeTrips.length,
          completedToday: completed.length,
        }));
      }
    } catch (err) {
      setError("Failed to load map data");
      console.error("Map data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchFiltersData = async () => {
    try {
      const [carriersRes, shippersRes] = await Promise.all([
        fetch("/api/organizations?type=CARRIER_COMPANY"),
        fetch("/api/organizations?type=SHIPPER"),
      ]);

      if (carriersRes.ok) {
        const data = await carriersRes.json();
        setCarriers(data.organizations || []);
      }

      if (shippersRes.ok) {
        const data = await shippersRes.json();
        setShippers(data.organizations || []);
      }
    } catch (err) {
      console.error("Failed to fetch filter options:", err);
    }
  };

  const buildMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];

    if (viewMode === "overview" || viewMode === "fleet") {
      vehicles.forEach((vehicle) => {
        if (vehicle.currentLocation) {
          markers.push({
            id: `vehicle-${vehicle.id}`,
            position: vehicle.currentLocation,
            title: `${vehicle.plateNumber} (${vehicle.carrier.name})`,
            type: "truck",
            status:
              vehicle.gpsStatus === "ACTIVE"
                ? "active"
                : vehicle.gpsStatus === "OFFLINE"
                  ? "offline"
                  : "available",
          });
        }
      });
    }

    if (viewMode === "overview" || viewMode === "trips") {
      trips.forEach((trip) => {
        if (trip.currentLocation) {
          markers.push({
            id: `trip-pos-${trip.id}`,
            position: trip.currentLocation,
            title: `${trip.truck.plateNumber} - In Transit`,
            type: "truck",
            status: "in_transit",
          });
        }

        if (trip.pickupLocation) {
          markers.push({
            id: `trip-pickup-${trip.id}`,
            position: trip.pickupLocation,
            title: `Pickup: ${trip.pickupLocation.address}`,
            type: "pickup",
          });
        }

        if (trip.deliveryLocation) {
          markers.push({
            id: `trip-delivery-${trip.id}`,
            position: trip.deliveryLocation,
            title: `Delivery: ${trip.deliveryLocation.address}`,
            type: "delivery",
          });
        }
      });
    }

    if (viewMode === "historical") {
      filteredHistorical.forEach((trip) => {
        if (trip.pickupLocation) {
          markers.push({
            id: `hist-pickup-${trip.id}`,
            position: trip.pickupLocation,
            title: `Pickup: ${trip.pickupLocation.address}`,
            type: "pickup",
          });
        }
        if (trip.deliveryLocation) {
          markers.push({
            id: `hist-delivery-${trip.id}`,
            position: trip.deliveryLocation,
            title: `Delivery: ${trip.deliveryLocation.address}`,
            type: "delivery",
          });
        }
      });
    }

    return markers;
  };

  const buildRoutes = (): MapRoute[] => {
    if (viewMode === "fleet") return [];

    const tripList = viewMode === "historical" ? filteredHistorical : trips;

    return tripList
      .filter((trip) => trip.pickupLocation && trip.deliveryLocation)
      .map((trip) => ({
        id: `route-${trip.id}`,
        origin: trip.pickupLocation,
        destination: trip.deliveryLocation,
        waypoints: trip.currentLocation ? [trip.currentLocation] : [],
        color: viewMode === "historical" ? "#94a3b8" : "#2563eb",
        tripId: trip.id,
      }));
  };

  const handleMarkerClick = (marker: MapMarker) => {
    const tripId = marker.id.replace(
      /^(trip-pos-|trip-pickup-|trip-delivery-|hist-pickup-|hist-delivery-)/,
      ""
    );
    const vehicleId = marker.id.replace("vehicle-", "");

    const trip = [...trips, ...historicalTrips].find((t) => t.id === tripId);
    const vehicle = vehicles.find((v) => v.id === vehicleId);

    if (trip) {
      setSelectedItem({ ...marker, data: trip });
    } else if (vehicle) {
      setSelectedItem({ ...marker, data: vehicle });
    } else {
      setSelectedItem(marker);
    }
  };

  const handleViewPlayback = (tripId: string) => {
    setPlaybackTripId(tripId);
    setShowPlayback(true);
  };

  const clearFilters = () => {
    setFilters({
      carrier: "",
      shipper: "",
      status: "",
      dateFrom: "",
      dateTo: "",
    });
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="mb-4 h-8 w-1/4 rounded bg-gray-200"></div>
          <div className="h-[600px] rounded bg-gray-200"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Map</h1>
          <p className="text-gray-500">Global overview of all operations</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div
              className={`h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            />
            <span className="text-gray-500">
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
          <button
            onClick={fetchMapData}
            className="rounded-lg bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Platform Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-6">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-900">
            {stats.totalVehicles}
          </div>
          <div className="text-sm text-gray-500">Total Vehicles</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-green-600">
            {stats.activeGps}
          </div>
          <div className="text-sm text-gray-500">GPS Active</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-orange-600">
            {stats.offlineGps}
          </div>
          <div className="text-sm text-gray-500">GPS Offline</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-gray-400">
            {stats.noDevice}
          </div>
          <div className="text-sm text-gray-500">No GPS Device</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-blue-600">
            {stats.activeTrips}
          </div>
          <div className="text-sm text-gray-500">Active Trips</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-2xl font-bold text-purple-600">
            {stats.completedToday}
          </div>
          <div className="text-sm text-gray-500">Completed Today</div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-2">
        {(["overview", "fleet", "trips", "historical"] as ViewMode[]).map(
          (mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`rounded-lg px-4 py-2 text-sm font-medium capitalize transition-colors ${
                viewMode === mode
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {mode}
            </button>
          )
        )}
      </div>

      {/* Filters (for historical view) */}
      {viewMode === "historical" && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Carrier
              </label>
              <select
                value={filters.carrier}
                onChange={(e) =>
                  setFilters({ ...filters, carrier: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All Carriers</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Shipper
              </label>
              <select
                value={filters.shipper}
                onChange={(e) =>
                  setFilters({ ...filters, shipper: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">All Shippers</option>
                {shippers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                From Date
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) =>
                  setFilters({ ...filters, dateFrom: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                To Date
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) =>
                  setFilters({ ...filters, dateTo: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Clear Filters
              </button>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            Showing {filteredHistorical.length} of {historicalTrips.length}{" "}
            historical trips
          </div>
        </div>
      )}

      {/* Map */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <GoogleMap
          markers={buildMarkers()}
          routes={buildRoutes()}
          height="550px"
          autoFitBounds={true}
          showTraffic={viewMode === "trips"}
          onMarkerClick={handleMarkerClick}
          refreshInterval={0}
        />
      </div>

      {/* Selected Item Details */}
      {selectedItem && (
        <SelectedItemCard
          selectedItem={selectedItem}
          viewMode={viewMode}
          onClose={() => setSelectedItem(null)}
          onViewPlayback={handleViewPlayback}
        />
      )}

      {/* Historical Trips List (for historical view) */}
      {viewMode === "historical" && filteredHistorical.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white">
          <div className="border-b border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900">Historical Trips</h3>
          </div>
          <div className="max-h-64 divide-y divide-gray-100 overflow-y-auto">
            {filteredHistorical.map((trip) => (
              <div
                key={trip.id}
                className="flex cursor-pointer items-center justify-between p-4 hover:bg-gray-50"
                onClick={() => handleViewPlayback(trip.id)}
              >
                <div>
                  <div className="font-medium text-gray-900">
                    {trip.truck.plateNumber} - {trip.carrier.name}
                  </div>
                  <div className="text-sm text-gray-500">
                    {trip.pickupLocation.address} →{" "}
                    {trip.deliveryLocation.address}
                  </div>
                  <div className="text-xs text-gray-400">
                    Completed:{" "}
                    {trip.completedAt
                      ? new Date(trip.completedAt).toLocaleDateString()
                      : "N/A"}
                  </div>
                </div>
                <button className="rounded bg-blue-50 px-3 py-1 text-sm text-blue-600 hover:bg-blue-100">
                  Playback
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-2 font-semibold text-gray-900">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-green-500"></div>
            <span className="text-gray-600">GPS Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-blue-500"></div>
            <span className="text-gray-600">In Transit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-orange-500"></div>
            <span className="text-gray-600">GPS Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full bg-gray-400"></div>
            <span className="text-gray-600">No GPS</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-emerald-500"></div>
            <span className="text-gray-600">Pickup</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded bg-red-500"></div>
            <span className="text-gray-600">Delivery</span>
          </div>
        </div>
      </div>

      {/* Trip History Playback Modal */}
      {showPlayback && playbackTripId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white">
            <div className="flex items-center justify-between border-b border-gray-200 p-4">
              <h2 className="text-lg font-semibold">Trip Playback</h2>
              <button
                onClick={() => {
                  setShowPlayback(false);
                  setPlaybackTripId(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                Close
              </button>
            </div>
            <div className="p-4">
              <TripHistoryPlayback
                tripId={playbackTripId}
                onClose={() => {
                  setShowPlayback(false);
                  setPlaybackTripId(null);
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Helper component for selected item details
function SelectedItemCard({
  selectedItem,
  viewMode,
  onClose,
  onViewPlayback,
}: {
  selectedItem: MapMarker;
  viewMode: ViewMode;
  onClose: () => void;
  onViewPlayback: (id: string) => void;
}) {
  const isVehicle = selectedItem.id.startsWith("vehicle-");
  const isTrip =
    selectedItem.id.includes("trip-") || selectedItem.id.includes("hist-");

  const vehicle = isVehicle ? (selectedItem.data as Vehicle) : null;
  const trip = isTrip ? (selectedItem.data as Trip) : null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-gray-900">{selectedItem.title}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          Close
        </button>
      </div>
      <div className="space-y-1 text-sm text-gray-600">
        {vehicle && (
          <div className="grid grid-cols-2 gap-2">
            <p>
              <strong>Type:</strong> {vehicle.truckType}
            </p>
            <p>
              <strong>Status:</strong> {vehicle.status}
            </p>
            <p>
              <strong>GPS:</strong> {vehicle.gpsStatus}
            </p>
            <p>
              <strong>Carrier:</strong> {vehicle.carrier.name}
            </p>
            {vehicle.currentLocation?.updatedAt && (
              <p className="col-span-2">
                <strong>Last Update:</strong>{" "}
                {new Date(vehicle.currentLocation.updatedAt).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {trip && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <p>
                <strong>Load ID:</strong> {trip.loadId.slice(0, 8)}...
              </p>
              <p>
                <strong>Status:</strong> {trip.status}
              </p>
              <p>
                <strong>Truck:</strong> {trip.truck.plateNumber}
              </p>
              <p>
                <strong>Carrier:</strong> {trip.carrier.name}
              </p>
              <p>
                <strong>Shipper:</strong> {trip.shipper.name}
              </p>
              {trip.startedAt && (
                <p>
                  <strong>Started:</strong>{" "}
                  {new Date(trip.startedAt).toLocaleString()}
                </p>
              )}
              {trip.completedAt && (
                <p>
                  <strong>Completed:</strong>{" "}
                  {new Date(trip.completedAt).toLocaleString()}
                </p>
              )}
            </div>
            {viewMode === "historical" && (
              <button
                onClick={() => onViewPlayback(trip.id)}
                className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                View Playback
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

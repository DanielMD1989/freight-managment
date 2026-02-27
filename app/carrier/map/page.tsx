/**
 * Carrier Map Page
 *
 * Professional fleet tracking dashboard with real-time GPS monitoring.
 * Design: Modern SaaS dashboard, clean minimal aesthetic.
 *
 * USES SHARED TYPE CONTRACT: lib/types/vehicle.ts
 * - VehicleMapData: Shape of vehicle from API
 * - VehicleMapStats: Shape of stats from API
 * - VehicleMapResponse: Complete API response shape
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import GoogleMap, { MapMarker, MapRoute } from "@/components/GoogleMap";
import { useGpsRealtime, GpsPosition } from "@/hooks/useGpsRealtime";
import TripHistoryPlayback from "@/components/TripHistoryPlayback";
import {
  VehicleMapData,
  VehicleMapStats,
  VehicleMapResponse,
  GpsDisplayStatus,
  TruckAvailabilityStatus,
} from "@/lib/types/vehicle";

// Use shared type contract - Vehicle is now VehicleMapData
type Vehicle = VehicleMapData;

// Use shared type contract - Stats is now VehicleMapStats
type Stats = VehicleMapStats;

/**
 * Trip data shape (not yet in shared types - could be added later)
 */
interface Trip {
  id: string;
  loadId: string;
  status: string;
  truck: {
    id: string;
    plateNumber: string;
  };
  shipper?: {
    name: string;
  };
  currentLocation?: {
    lat: number;
    lng: number;
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
  totalDistanceKm?: number;
}

type ViewMode = "fleet" | "trips" | "history" | "all";

/**
 * Fleet filter state - uses GpsDisplayStatus from shared types
 */
interface FleetFilters {
  gpsStatus: GpsDisplayStatus[];
  truckStatus: TruckAvailabilityStatus[];
  truckType: string[];
  searchQuery: string;
}

const defaultFilters: FleetFilters = {
  gpsStatus: [],
  truckStatus: [],
  truckType: [],
  searchQuery: "",
};

// Truck list item component - Clean minimal design
function TruckListItem({
  vehicle,
  isSelected,
  onClick,
}: {
  vehicle: Vehicle;
  isSelected: boolean;
  onClick: () => void;
}) {
  const isOnline = vehicle.gpsStatus === "ACTIVE";
  const isOffline = vehicle.gpsStatus === "OFFLINE";

  return (
    <button
      onClick={onClick}
      className={`w-full border-l-2 px-4 py-3 text-left transition-colors ${
        isSelected
          ? "border-l-blue-600 bg-blue-50"
          : "border-l-transparent hover:bg-gray-50"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          {/* Status dot */}
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${
              isOnline
                ? "bg-emerald-500"
                : isOffline
                  ? "bg-amber-500"
                  : "bg-gray-300"
            }`}
          />
          {/* Plate number */}
          <span className="truncate font-medium text-gray-900">
            {vehicle.plateNumber ?? "Unknown"}
          </span>
        </div>
        {/* Status label */}
        <span
          className={`rounded px-2 py-0.5 text-xs font-medium ${
            vehicle.status === "IN_TRANSIT"
              ? "bg-blue-100 text-blue-700"
              : "bg-gray-100 text-gray-600"
          }`}
        >
          {vehicle.status === "IN_TRANSIT" ? "Transit" : "Available"}
        </span>
      </div>
      {/* Secondary info */}
      <div className="mt-1 ml-5 text-xs text-gray-500">
        {vehicle.truckType ?? "Unknown type"}
        {vehicle.carrier?.name ? ` · ${vehicle.carrier.name}` : ""}
      </div>
    </button>
  );
}

// Selected item details panel - Clean minimal design
function SelectedItemDetails({
  selectedItem,
  viewMode,
  formatDate,
  onViewPlayback,
}: {
  selectedItem: MapMarker;
  viewMode: ViewMode;
  formatDate: (date?: string) => string;
  onViewPlayback: (id: string) => void;
}) {
  if (selectedItem.type === "truck" && selectedItem.data) {
    const vehicle = selectedItem.data as Vehicle;

    return (
      <div className="space-y-4">
        {/* Info rows */}
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <span className="text-sm text-gray-500">Type</span>
            <span className="text-sm font-medium text-gray-900">
              {vehicle.truckType ?? "Unknown"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <span className="text-sm text-gray-500">Capacity</span>
            <span className="text-sm font-medium text-gray-900">
              {vehicle.capacity?.toLocaleString() ?? "-"} kg
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <span className="text-sm text-gray-500">Status</span>
            <span
              className={`text-sm font-medium ${vehicle.status === "IN_TRANSIT" ? "text-blue-600" : "text-emerald-600"}`}
            >
              {vehicle.status === "IN_TRANSIT" ? "In Transit" : "Available"}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <span className="text-sm text-gray-500">GPS</span>
            <span className="flex items-center gap-2">
              <span
                className={`h-2 w-2 rounded-full ${
                  vehicle.gpsStatus === "ACTIVE"
                    ? "bg-emerald-500"
                    : vehicle.gpsStatus === "OFFLINE"
                      ? "bg-amber-500"
                      : "bg-gray-300"
                }`}
              />
              <span className="text-sm font-medium text-gray-900">
                {vehicle.gpsStatus === "ACTIVE"
                  ? "Active"
                  : vehicle.gpsStatus === "OFFLINE"
                    ? "Offline"
                    : "No Device"}
              </span>
            </span>
          </div>
          {vehicle.carrier?.name && (
            <div className="flex items-center justify-between border-b border-gray-100 py-2">
              <span className="text-sm text-gray-500">Carrier</span>
              <span className="text-sm font-medium text-gray-900">
                {vehicle.carrier.name}
              </span>
            </div>
          )}
        </div>

        {/* Driver card */}
        {vehicle.driver && (
          <div className="rounded-lg bg-gray-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600">
                <span className="text-sm font-medium text-white">
                  {vehicle.driver.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">
                  {vehicle.driver.name}
                </div>
                {vehicle.driver.phone && (
                  <div className="text-xs text-gray-500">
                    {vehicle.driver.phone}
                  </div>
                )}
              </div>
              {vehicle.driver.phone && (
                <a
                  href={`tel:${vehicle.driver.phone}`}
                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                  Call
                </a>
              )}
            </div>
          </div>
        )}

        {/* Last update */}
        {vehicle.currentLocation?.updatedAt && (
          <p className="text-xs text-gray-400">
            Last updated {formatDate(vehicle.currentLocation.updatedAt)}
          </p>
        )}
      </div>
    );
  }

  if (
    (selectedItem.type === "pickup" || selectedItem.type === "delivery") &&
    selectedItem.data
  ) {
    const trip = selectedItem.data as Trip;
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <span className="text-sm text-gray-500">Load ID</span>
            <span className="font-mono text-sm font-medium text-gray-900">
              {trip.loadId.slice(0, 8)}...
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <span className="text-sm text-gray-500">Truck</span>
            <span className="text-sm font-medium text-gray-900">
              {trip.truck.plateNumber}
            </span>
          </div>
          <div className="flex items-center justify-between border-b border-gray-100 py-2">
            <span className="text-sm text-gray-500">Status</span>
            <span className="text-sm font-medium text-blue-600">
              {trip.status}
            </span>
          </div>
          {trip.shipper && (
            <div className="flex items-center justify-between border-b border-gray-100 py-2">
              <span className="text-sm text-gray-500">Shipper</span>
              <span className="text-sm font-medium text-gray-900">
                {trip.shipper.name}
              </span>
            </div>
          )}
        </div>
        {trip.startedAt && (
          <p className="text-xs text-gray-400">
            Started {formatDate(trip.startedAt)}
          </p>
        )}
        {viewMode === "history" && trip.completedAt && (
          <button
            onClick={() => onViewPlayback(trip.loadId)}
            className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
          >
            View Trip Playback
          </button>
        )}
      </div>
    );
  }

  return null;
}

export default function CarrierMapPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [activeTrips, setActiveTrips] = useState<Trip[]>([]);
  const [historicalTrips, setHistoricalTrips] = useState<Trip[]>([]);
  const [stats, setStats] = useState<Stats>({
    total: 0,
    active: 0,
    offline: 0,
    noDevice: 0,
    available: 0,
    inTransit: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [selectedItem, setSelectedItem] = useState<MapMarker | null>(null);
  const [selectedHistoricalTripId, setSelectedHistoricalTripId] = useState<
    string | null
  >(null);
  const [fleetFilters, setFleetFilters] =
    useState<FleetFilters>(defaultFilters);
  // P0 Fix #2: Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Check if any filters are active
  const hasActiveFilters =
    fleetFilters.gpsStatus.length > 0 ||
    fleetFilters.truckStatus.length > 0 ||
    fleetFilters.truckType.length > 0 ||
    fleetFilters.searchQuery.length > 0;

  // Get filtered vehicles count
  const getFilteredVehicles = () => {
    return vehicles.filter((vehicle) => {
      // Search query filter
      if (fleetFilters.searchQuery) {
        const query = fleetFilters.searchQuery.toLowerCase();
        if (!vehicle.plateNumber?.toLowerCase().includes(query)) {
          return false;
        }
      }

      // GPS status filter
      if (fleetFilters.gpsStatus.length > 0) {
        if (
          !vehicle.gpsStatus ||
          !fleetFilters.gpsStatus.includes(vehicle.gpsStatus)
        ) {
          return false;
        }
      }

      // Truck status filter
      if (fleetFilters.truckStatus.length > 0) {
        if (
          !vehicle.status ||
          !fleetFilters.truckStatus.includes(
            vehicle.status as TruckAvailabilityStatus
          )
        ) {
          return false;
        }
      }

      // Truck type filter
      if (fleetFilters.truckType.length > 0) {
        if (
          !vehicle.truckType ||
          !fleetFilters.truckType.includes(vehicle.truckType)
        ) {
          return false;
        }
      }

      return true;
    });
  };

  const filteredVehicles = getFilteredVehicles();

  const [historyDateFrom, setHistoryDateFrom] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split("T")[0];
  });
  const [historyDateTo, setHistoryDateTo] = useState<string>(() => {
    return new Date().toISOString().split("T")[0];
  });

  const { isConnected } = useGpsRealtime({
    autoConnect: true,
    onPositionUpdate: (position: GpsPosition) => {
      setVehicles((prev) =>
        prev.map((v) =>
          v.id === position.truckId
            ? {
                ...v,
                currentLocation: {
                  lat: position.lat,
                  lng: position.lng,
                  updatedAt: position.timestamp,
                },
                gpsStatus: "ACTIVE" as const,
              }
            : v
        )
      );

      if (position.loadId) {
        setActiveTrips((prev) =>
          prev.map((t) =>
            t.loadId === position.loadId
              ? {
                  ...t,
                  currentLocation: {
                    lat: position.lat,
                    lng: position.lng,
                  },
                }
              : t
          )
        );
      }
    },
  });

  const fetchMapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [vehiclesRes, activeTripsRes, historicalTripsRes] =
        await Promise.all([
          fetch("/api/map/vehicles"),
          fetch("/api/map/trips?status=IN_TRANSIT"),
          fetch(
            `/api/map/trips?status=COMPLETED&dateFrom=${historyDateFrom}&dateTo=${historyDateTo}&limit=20`
          ),
        ]);

      if (vehiclesRes.ok) {
        // Type the response using shared contract
        const data: VehicleMapResponse = await vehiclesRes.json();
        setVehicles(data.vehicles);
        setStats(data.stats);
      }

      if (activeTripsRes.ok) {
        const data = await activeTripsRes.json();
        setActiveTrips(data.trips || []);
      }

      if (historicalTripsRes.ok) {
        const data = await historicalTripsRes.json();
        setHistoricalTrips(data.trips || []);
      }
    } catch (err) {
      setError("Failed to load map data");
      console.error("Map data fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [historyDateFrom, historyDateTo]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  const buildMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];

    if (viewMode === "fleet" || viewMode === "all") {
      // Use filtered vehicles when filters are applied
      const vehiclesToShow = hasActiveFilters ? filteredVehicles : vehicles;
      vehiclesToShow.forEach((vehicle) => {
        if (vehicle.currentLocation) {
          let status: "active" | "available" | "offline" | "in_transit";
          if (vehicle.gpsStatus === "ACTIVE") {
            status = vehicle.status === "IN_TRANSIT" ? "in_transit" : "active";
          } else if (vehicle.gpsStatus === "OFFLINE") {
            status = "offline";
          } else {
            status = "available";
          }

          markers.push({
            id: `vehicle-${vehicle.id}`,
            position: vehicle.currentLocation,
            title: vehicle.plateNumber ?? "Unknown",
            type: "truck",
            status,
            data: vehicle,
          });
        }
      });
    }

    if (viewMode === "trips" || viewMode === "all") {
      activeTrips.forEach((trip) => {
        if (trip.pickupLocation) {
          markers.push({
            id: `pickup-${trip.id}`,
            position: trip.pickupLocation,
            title: `Pickup: ${trip.pickupLocation.address}`,
            type: "pickup",
            data: trip,
          });
        }

        if (trip.deliveryLocation) {
          markers.push({
            id: `delivery-${trip.id}`,
            position: trip.deliveryLocation,
            title: `Delivery: ${trip.deliveryLocation.address}`,
            type: "delivery",
            data: trip,
          });
        }

        if (trip.currentLocation) {
          markers.push({
            id: `trip-truck-${trip.id}`,
            position: trip.currentLocation,
            title: `${trip.truck.plateNumber} - In Transit`,
            type: "truck",
            status: "in_transit",
            data: trip,
          });
        }
      });
    }

    if (viewMode === "history") {
      historicalTrips.forEach((trip) => {
        if (trip.pickupLocation) {
          markers.push({
            id: `hist-pickup-${trip.id}`,
            position: trip.pickupLocation,
            title: `Pickup: ${trip.pickupLocation.address}`,
            type: "pickup",
            data: trip,
          });
        }

        if (trip.deliveryLocation) {
          markers.push({
            id: `hist-delivery-${trip.id}`,
            position: trip.deliveryLocation,
            title: `Delivery: ${trip.deliveryLocation.address}`,
            type: "delivery",
            data: trip,
          });
        }
      });
    }

    return markers;
  };

  const buildRoutes = (): MapRoute[] => {
    if (viewMode === "fleet") return [];

    const routes: MapRoute[] = [];

    if (viewMode === "trips" || viewMode === "all") {
      activeTrips
        .filter((trip) => trip.pickupLocation && trip.deliveryLocation)
        .forEach((trip) => {
          routes.push({
            id: `route-${trip.id}`,
            origin: trip.pickupLocation,
            destination: trip.deliveryLocation,
            waypoints: trip.currentLocation ? [trip.currentLocation] : [],
            color: "#0d9488",
            tripId: trip.id,
          });
        });
    }

    if (viewMode === "history") {
      historicalTrips
        .filter((trip) => trip.pickupLocation && trip.deliveryLocation)
        .forEach((trip) => {
          routes.push({
            id: `hist-route-${trip.id}`,
            origin: trip.pickupLocation,
            destination: trip.deliveryLocation,
            color: "#94a3b8",
            tripId: trip.id,
          });
        });
    }

    return routes;
  };

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedItem(marker);
    // P0 Fix #2: Close sidebar on mobile when selecting a marker
    setSidebarOpen(false);
  };

  // P0 Fix #1: Handle clicking on a truck in the sidebar list
  const handleTruckListClick = (vehicle: Vehicle) => {
    if (vehicle.currentLocation) {
      const marker: MapMarker = {
        id: `vehicle-${vehicle.id}`,
        position: vehicle.currentLocation,
        title: vehicle.plateNumber ?? "Unknown",
        type: "truck",
        status:
          vehicle.gpsStatus === "ACTIVE"
            ? vehicle.status === "IN_TRANSIT"
              ? "in_transit"
              : "active"
            : vehicle.gpsStatus === "OFFLINE"
              ? "offline"
              : "available",
        data: vehicle,
      };
      setSelectedItem(marker);
      // Close sidebar on mobile after selection
      setSidebarOpen(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="flex h-screen bg-gray-50">
        {/* Sidebar Skeleton */}
        <div className="hidden w-80 flex-col border-r border-gray-200 bg-white md:flex">
          {/* Header skeleton */}
          <div className="border-b border-gray-100 px-4 py-4">
            <div className="h-6 w-32 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-4 w-24 animate-pulse rounded bg-gray-100" />
          </div>
          {/* Tabs skeleton */}
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-8 w-20 animate-pulse rounded-lg bg-gray-100"
                />
              ))}
            </div>
          </div>
          {/* Search skeleton */}
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="h-10 animate-pulse rounded-lg bg-gray-100" />
          </div>
          {/* List skeleton */}
          <div className="flex-1 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="border-b border-gray-50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-gray-200" />
                  <div className="flex-1">
                    <div className="h-4 w-24 animate-pulse rounded bg-gray-200" />
                    <div className="mt-1.5 h-3 w-32 animate-pulse rounded bg-gray-100" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Map Skeleton */}
        <div className="flex flex-1 items-center justify-center bg-gray-100">
          <div className="text-center">
            <svg
              className="mx-auto h-8 w-8 animate-spin text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            <p className="mt-3 text-sm text-gray-500">Loading fleet data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile hamburger toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-lg bg-white text-gray-600 shadow-md hover:bg-gray-50 md:hidden"
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
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 flex w-80 transform flex-col border-r border-gray-200 bg-white shadow-xl transition-transform duration-300 ease-in-out md:relative md:z-0 md:shadow-none ${sidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"} `}
      >
        {/* Header */}
        <div className="border-b border-gray-100 px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Fleet Tracker
              </h1>
              <p className="mt-0.5 flex items-center gap-2 text-sm text-gray-500">
                <span
                  className={`h-2 w-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-red-500"}`}
                />
                {stats.active} trucks online
              </p>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 md:hidden"
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
        </div>

        {/* Tab selector */}
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
            {(["all", "fleet", "trips", "history"] as ViewMode[]).map(
              (mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    viewMode === mode
                      ? "bg-white text-gray-900 shadow-sm"
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  {mode === "all"
                    ? "All"
                    : mode === "fleet"
                      ? "Fleet"
                      : mode === "trips"
                        ? "Trips"
                        : "History"}
                </button>
              )
            )}
          </div>
        </div>

        {/* Date Range for History */}
        {viewMode === "history" && (
          <div className="border-b border-gray-100 px-4 py-3">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">From</label>
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs text-gray-500">To</label>
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>
            <button
              onClick={fetchMapData}
              className="mt-3 w-full rounded-lg bg-blue-600 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        )}

        {/* Search */}
        <div className="border-b border-gray-100 px-4 py-3">
          <div className="relative">
            <svg
              className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              placeholder="Search trucks..."
              value={fleetFilters.searchQuery}
              onChange={(e) =>
                setFleetFilters({
                  ...fleetFilters,
                  searchQuery: e.target.value,
                })
              }
              className="w-full rounded-lg border border-gray-200 py-2.5 pr-4 pl-10 text-sm outline-none placeholder:text-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>

        {/* Quick filters */}
        <div className="flex flex-wrap gap-2 border-b border-gray-100 px-4 py-3">
          <button
            onClick={() =>
              setFleetFilters({
                ...fleetFilters,
                gpsStatus: fleetFilters.gpsStatus.includes("ACTIVE")
                  ? []
                  : ["ACTIVE"],
              })
            }
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              fleetFilters.gpsStatus.includes("ACTIVE")
                ? "bg-emerald-100 text-emerald-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Active ({stats.active})
          </button>
          <button
            onClick={() =>
              setFleetFilters({
                ...fleetFilters,
                gpsStatus: fleetFilters.gpsStatus.includes("OFFLINE")
                  ? []
                  : ["OFFLINE"],
              })
            }
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              fleetFilters.gpsStatus.includes("OFFLINE")
                ? "bg-amber-100 text-amber-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            Offline ({stats.offline})
          </button>
          <button
            onClick={() =>
              setFleetFilters({
                ...fleetFilters,
                truckStatus: fleetFilters.truckStatus.includes("IN_TRANSIT")
                  ? []
                  : ["IN_TRANSIT"],
              })
            }
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
              fleetFilters.truckStatus.includes("IN_TRANSIT")
                ? "bg-blue-100 text-blue-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            In Transit ({stats.inTransit})
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => setFleetFilters(defaultFilters)}
              className="rounded-full px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Truck List */}
        <div className="flex-1 overflow-y-auto">
          {vehicles.length === 0 ? (
            <div className="p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                <svg
                  className="h-6 w-6 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"
                  />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">
                No trucks registered
              </p>
              <p className="mt-1 text-xs text-gray-500">
                Add trucks to start tracking
              </p>
            </div>
          ) : (hasActiveFilters ? filteredVehicles : vehicles).length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500">
                No trucks match your filters
              </p>
              <button
                onClick={() => setFleetFilters(defaultFilters)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(hasActiveFilters ? filteredVehicles : vehicles).map(
                (vehicle) => (
                  <TruckListItem
                    key={vehicle.id}
                    vehicle={vehicle}
                    isSelected={selectedItem?.id === `vehicle-${vehicle.id}`}
                    onClick={() => handleTruckListClick(vehicle)}
                  />
                )
              )}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {hasActiveFilters
                ? `${filteredVehicles.length} of ${vehicles.length}`
                : `${vehicles.length} trucks`}
            </span>
            <button
              onClick={fetchMapData}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative flex-1">
        {/* Error banner */}
        {error && (
          <div className="absolute top-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
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
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            {error}
          </div>
        )}

        {/* Empty state overlay */}
        {!loading &&
          vehicles.length > 0 &&
          buildMarkers().length === 0 &&
          (viewMode === "fleet" || viewMode === "all") && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
              <div className="max-w-sm p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
                  <svg
                    className="h-6 w-6 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-900">
                  No trucks on map
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  {hasActiveFilters
                    ? "No trucks match your filters"
                    : "Trucks need GPS devices to appear here"}
                </p>
                {hasActiveFilters && (
                  <button
                    onClick={() => setFleetFilters(defaultFilters)}
                    className="mt-3 text-sm text-blue-600 hover:text-blue-700"
                  >
                    Clear filters
                  </button>
                )}
              </div>
            </div>
          )}

        {/* Map */}
        <div className="h-full">
          <GoogleMap
            markers={buildMarkers()}
            routes={buildRoutes()}
            height="100%"
            autoFitBounds={true}
            showTraffic={false}
            onMarkerClick={handleMarkerClick}
            refreshInterval={30000}
          />
        </div>

        {/* Selected Item Details Panel */}
        {selectedItem && (
          <div className="absolute right-4 bottom-4 left-4 z-20 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-lg md:right-4 md:left-auto md:w-80">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-3">
              <div>
                <h3 className="font-medium text-gray-900">
                  {selectedItem.title}
                </h3>
                <p className="text-xs text-gray-500">
                  {selectedItem.type === "truck"
                    ? "Vehicle"
                    : selectedItem.type === "pickup"
                      ? "Pickup"
                      : "Delivery"}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {/* Content */}
            <div className="max-h-64 overflow-y-auto p-4">
              <SelectedItemDetails
                selectedItem={selectedItem}
                viewMode={viewMode}
                formatDate={formatDate}
                onViewPlayback={setSelectedHistoricalTripId}
              />
            </div>
          </div>
        )}
      </div>

      {/* Trip History Playback Modal */}
      {selectedHistoricalTripId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-4xl overflow-hidden rounded-xl bg-white shadow-2xl">
            <TripHistoryPlayback
              tripId={selectedHistoricalTripId}
              height="600px"
              onClose={() => setSelectedHistoricalTripId(null)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

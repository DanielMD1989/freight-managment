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

'use client';

import { useState, useEffect, useCallback } from 'react';
import GoogleMap, { MapMarker, MapRoute } from '@/components/GoogleMap';
import { useGpsRealtime, GpsPosition } from '@/hooks/useGpsRealtime';
import TripHistoryPlayback from '@/components/TripHistoryPlayback';
import {
  VehicleMapData,
  VehicleMapStats,
  VehicleMapResponse,
  GpsDisplayStatus,
  TruckAvailabilityStatus,
} from '@/lib/types/vehicle';

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

type ViewMode = 'fleet' | 'trips' | 'history' | 'all';

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
  searchQuery: '',
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
  const isOnline = vehicle.gpsStatus === 'ACTIVE';
  const isOffline = vehicle.gpsStatus === 'OFFLINE';

  return (
    <button
      onClick={onClick}
      className={`w-full px-4 py-3 text-left transition-colors border-l-2 ${
        isSelected
          ? 'bg-blue-50 border-l-blue-600'
          : 'hover:bg-gray-50 border-l-transparent'
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 min-w-0">
          {/* Status dot */}
          <span
            className={`w-2 h-2 rounded-full flex-shrink-0 ${
              isOnline
                ? 'bg-emerald-500'
                : isOffline
                  ? 'bg-amber-500'
                  : 'bg-gray-300'
            }`}
          />
          {/* Plate number */}
          <span className="font-medium text-gray-900 truncate">
            {vehicle.plateNumber ?? 'Unknown'}
          </span>
        </div>
        {/* Status label */}
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            vehicle.status === 'IN_TRANSIT'
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {vehicle.status === 'IN_TRANSIT' ? 'Transit' : 'Available'}
        </span>
      </div>
      {/* Secondary info */}
      <div className="mt-1 ml-5 text-xs text-gray-500">
        {vehicle.truckType ?? 'Unknown type'}
        {vehicle.carrier?.name ? ` · ${vehicle.carrier.name}` : ''}
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
  if (selectedItem.type === 'truck' && selectedItem.data) {
    const vehicle = selectedItem.data as Vehicle;

    return (
      <div className="space-y-4">
        {/* Info rows */}
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Type</span>
            <span className="text-sm font-medium text-gray-900">{vehicle.truckType ?? 'Unknown'}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Capacity</span>
            <span className="text-sm font-medium text-gray-900">{vehicle.capacity?.toLocaleString() ?? '-'} kg</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Status</span>
            <span className={`text-sm font-medium ${vehicle.status === 'IN_TRANSIT' ? 'text-blue-600' : 'text-emerald-600'}`}>
              {vehicle.status === 'IN_TRANSIT' ? 'In Transit' : 'Available'}
            </span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">GPS</span>
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${
                vehicle.gpsStatus === 'ACTIVE' ? 'bg-emerald-500' :
                vehicle.gpsStatus === 'OFFLINE' ? 'bg-amber-500' : 'bg-gray-300'
              }`} />
              <span className="text-sm font-medium text-gray-900">
                {vehicle.gpsStatus === 'ACTIVE' ? 'Active' : vehicle.gpsStatus === 'OFFLINE' ? 'Offline' : 'No Device'}
              </span>
            </span>
          </div>
          {vehicle.carrier?.name && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Carrier</span>
              <span className="text-sm font-medium text-gray-900">{vehicle.carrier.name}</span>
            </div>
          )}
        </div>

        {/* Driver card */}
        {vehicle.driver && (
          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center flex-shrink-0">
                <span className="text-sm font-medium text-white">
                  {vehicle.driver.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{vehicle.driver.name}</div>
                {vehicle.driver.phone && (
                  <div className="text-xs text-gray-500">{vehicle.driver.phone}</div>
                )}
              </div>
              {vehicle.driver.phone && (
                <a
                  href={`tel:${vehicle.driver.phone}`}
                  className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
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

  if ((selectedItem.type === 'pickup' || selectedItem.type === 'delivery') && selectedItem.data) {
    const trip = selectedItem.data as Trip;
    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Load ID</span>
            <span className="text-sm font-medium text-gray-900 font-mono">{trip.loadId.slice(0, 8)}...</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Truck</span>
            <span className="text-sm font-medium text-gray-900">{trip.truck.plateNumber}</span>
          </div>
          <div className="flex justify-between items-center py-2 border-b border-gray-100">
            <span className="text-sm text-gray-500">Status</span>
            <span className="text-sm font-medium text-blue-600">{trip.status}</span>
          </div>
          {trip.shipper && (
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-500">Shipper</span>
              <span className="text-sm font-medium text-gray-900">{trip.shipper.name}</span>
            </div>
          )}
        </div>
        {trip.startedAt && (
          <p className="text-xs text-gray-400">Started {formatDate(trip.startedAt)}</p>
        )}
        {viewMode === 'history' && trip.completedAt && (
          <button
            onClick={() => onViewPlayback(trip.loadId)}
            className="w-full px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
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
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedItem, setSelectedItem] = useState<MapMarker | null>(null);
  const [selectedHistoricalTripId, setSelectedHistoricalTripId] = useState<string | null>(null);
  const [fleetFilters, setFleetFilters] = useState<FleetFilters>(defaultFilters);
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
        if (!vehicle.gpsStatus || !fleetFilters.gpsStatus.includes(vehicle.gpsStatus)) {
          return false;
        }
      }

      // Truck status filter
      if (fleetFilters.truckStatus.length > 0) {
        if (!vehicle.status || !fleetFilters.truckStatus.includes(vehicle.status as TruckAvailabilityStatus)) {
          return false;
        }
      }

      // Truck type filter
      if (fleetFilters.truckType.length > 0) {
        if (!vehicle.truckType || !fleetFilters.truckType.includes(vehicle.truckType)) {
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
    return date.toISOString().split('T')[0];
  });
  const [historyDateTo, setHistoryDateTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const { isConnected, positions } = useGpsRealtime({
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
                gpsStatus: 'ACTIVE' as const,
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

      const [vehiclesRes, activeTripsRes, historicalTripsRes] = await Promise.all([
        fetch('/api/map/vehicles'),
        fetch('/api/map/trips?status=IN_TRANSIT'),
        fetch(`/api/map/trips?status=COMPLETED&dateFrom=${historyDateFrom}&dateTo=${historyDateTo}&limit=20`),
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
      setError('Failed to load map data');
      console.error('Map data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [historyDateFrom, historyDateTo]);

  useEffect(() => {
    fetchMapData();
  }, [fetchMapData]);

  const buildMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];

    if (viewMode === 'fleet' || viewMode === 'all') {
      // Use filtered vehicles when filters are applied
      const vehiclesToShow = hasActiveFilters ? filteredVehicles : vehicles;
      vehiclesToShow.forEach((vehicle) => {
        if (vehicle.currentLocation) {
          let status: 'active' | 'available' | 'offline' | 'in_transit';
          if (vehicle.gpsStatus === 'ACTIVE') {
            status = vehicle.status === 'IN_TRANSIT' ? 'in_transit' : 'active';
          } else if (vehicle.gpsStatus === 'OFFLINE') {
            status = 'offline';
          } else {
            status = 'available';
          }

          markers.push({
            id: `vehicle-${vehicle.id}`,
            position: vehicle.currentLocation,
            title: vehicle.plateNumber ?? 'Unknown',
            type: 'truck',
            status,
            data: vehicle,
          });
        }
      });
    }

    if (viewMode === 'trips' || viewMode === 'all') {
      activeTrips.forEach((trip) => {
        if (trip.pickupLocation) {
          markers.push({
            id: `pickup-${trip.id}`,
            position: trip.pickupLocation,
            title: `Pickup: ${trip.pickupLocation.address}`,
            type: 'pickup',
            data: trip,
          });
        }

        if (trip.deliveryLocation) {
          markers.push({
            id: `delivery-${trip.id}`,
            position: trip.deliveryLocation,
            title: `Delivery: ${trip.deliveryLocation.address}`,
            type: 'delivery',
            data: trip,
          });
        }

        if (trip.currentLocation) {
          markers.push({
            id: `trip-truck-${trip.id}`,
            position: trip.currentLocation,
            title: `${trip.truck.plateNumber} - In Transit`,
            type: 'truck',
            status: 'in_transit',
            data: trip,
          });
        }
      });
    }

    if (viewMode === 'history') {
      historicalTrips.forEach((trip) => {
        if (trip.pickupLocation) {
          markers.push({
            id: `hist-pickup-${trip.id}`,
            position: trip.pickupLocation,
            title: `Pickup: ${trip.pickupLocation.address}`,
            type: 'pickup',
            data: trip,
          });
        }

        if (trip.deliveryLocation) {
          markers.push({
            id: `hist-delivery-${trip.id}`,
            position: trip.deliveryLocation,
            title: `Delivery: ${trip.deliveryLocation.address}`,
            type: 'delivery',
            data: trip,
          });
        }
      });
    }

    return markers;
  };

  const buildRoutes = (): MapRoute[] => {
    if (viewMode === 'fleet') return [];

    const routes: MapRoute[] = [];

    if (viewMode === 'trips' || viewMode === 'all') {
      activeTrips
        .filter((trip) => trip.pickupLocation && trip.deliveryLocation)
        .forEach((trip) => {
          routes.push({
            id: `route-${trip.id}`,
            origin: trip.pickupLocation,
            destination: trip.deliveryLocation,
            waypoints: trip.currentLocation ? [trip.currentLocation] : [],
            color: '#0d9488',
            tripId: trip.id,
          });
        });
    }

    if (viewMode === 'history') {
      historicalTrips
        .filter((trip) => trip.pickupLocation && trip.deliveryLocation)
        .forEach((trip) => {
          routes.push({
            id: `hist-route-${trip.id}`,
            origin: trip.pickupLocation,
            destination: trip.deliveryLocation,
            color: '#94a3b8',
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
        title: vehicle.plateNumber ?? 'Unknown',
        type: 'truck',
        status: vehicle.gpsStatus === 'ACTIVE'
          ? (vehicle.status === 'IN_TRANSIT' ? 'in_transit' : 'active')
          : vehicle.gpsStatus === 'OFFLINE' ? 'offline' : 'available',
        data: vehicle,
      };
      setSelectedItem(marker);
      // Close sidebar on mobile after selection
      setSidebarOpen(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="h-screen bg-gray-50 flex">
        {/* Sidebar Skeleton */}
        <div className="hidden md:flex w-80 bg-white border-r border-gray-200 flex-col">
          {/* Header skeleton */}
          <div className="px-4 py-4 border-b border-gray-100">
            <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-100 rounded mt-2 animate-pulse" />
          </div>
          {/* Tabs skeleton */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex gap-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-8 w-20 bg-gray-100 rounded-lg animate-pulse" />
              ))}
            </div>
          </div>
          {/* Search skeleton */}
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
          </div>
          {/* List skeleton */}
          <div className="flex-1 overflow-hidden">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="px-4 py-3 border-b border-gray-50">
                <div className="flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-gray-200 animate-pulse" />
                  <div className="flex-1">
                    <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                    <div className="h-3 w-32 bg-gray-100 rounded mt-1.5 animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Map Skeleton */}
        <div className="flex-1 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <svg className="w-8 h-8 mx-auto text-gray-400 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            <p className="mt-3 text-sm text-gray-500">Loading fleet data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex overflow-hidden">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Mobile hamburger toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-20 md:hidden w-10 h-10 bg-white rounded-lg shadow-md flex items-center justify-center text-gray-600 hover:bg-gray-50"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-40 md:z-0
        w-80 bg-white border-r border-gray-200 flex flex-col
        shadow-xl md:shadow-none
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Fleet Tracker</h1>
              <p className="text-sm text-gray-500 mt-0.5 flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
                {stats.active} trucks online
              </p>
            </div>
            {/* Mobile close button */}
            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Tab selector */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {(['all', 'fleet', 'trips', 'history'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode === 'all' ? 'All' : mode === 'fleet' ? 'Fleet' : mode === 'trips' ? 'Trips' : 'History'}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range for History */}
        {viewMode === 'history' && (
          <div className="px-4 py-3 border-b border-gray-100">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">From</label>
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs text-gray-500 mb-1 block">To</label>
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
                />
              </div>
            </div>
            <button
              onClick={fetchMapData}
              className="w-full mt-3 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
            >
              Apply
            </button>
          </div>
        )}

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="Search trucks..."
              value={fleetFilters.searchQuery}
              onChange={(e) => setFleetFilters({ ...fleetFilters, searchQuery: e.target.value })}
              className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none placeholder:text-gray-400"
            />
          </div>
        </div>

        {/* Quick filters */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap gap-2">
          <button
            onClick={() => setFleetFilters({ ...fleetFilters, gpsStatus: fleetFilters.gpsStatus.includes('ACTIVE') ? [] : ['ACTIVE'] })}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              fleetFilters.gpsStatus.includes('ACTIVE')
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Active ({stats.active})
          </button>
          <button
            onClick={() => setFleetFilters({ ...fleetFilters, gpsStatus: fleetFilters.gpsStatus.includes('OFFLINE') ? [] : ['OFFLINE'] })}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              fleetFilters.gpsStatus.includes('OFFLINE')
                ? 'bg-amber-100 text-amber-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Offline ({stats.offline})
          </button>
          <button
            onClick={() => setFleetFilters({ ...fleetFilters, truckStatus: fleetFilters.truckStatus.includes('IN_TRANSIT') ? [] : ['IN_TRANSIT'] })}
            className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
              fleetFilters.truckStatus.includes('IN_TRANSIT')
                ? 'bg-blue-100 text-blue-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            In Transit ({stats.inTransit})
          </button>
          {hasActiveFilters && (
            <button
              onClick={() => setFleetFilters(defaultFilters)}
              className="px-3 py-1.5 text-xs font-medium rounded-full text-red-600 hover:bg-red-50 transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Truck List */}
        <div className="flex-1 overflow-y-auto">
          {vehicles.length === 0 ? (
            <div className="p-8 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">No trucks registered</p>
              <p className="text-xs text-gray-500 mt-1">Add trucks to start tracking</p>
            </div>
          ) : (hasActiveFilters ? filteredVehicles : vehicles).length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-sm text-gray-500">No trucks match your filters</p>
              <button
                onClick={() => setFleetFilters(defaultFilters)}
                className="mt-2 text-sm text-blue-600 hover:text-blue-700"
              >
                Clear filters
              </button>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {(hasActiveFilters ? filteredVehicles : vehicles).map((vehicle) => (
                <TruckListItem
                  key={vehicle.id}
                  vehicle={vehicle}
                  isSelected={selectedItem?.id === `vehicle-${vehicle.id}`}
                  onClick={() => handleTruckListClick(vehicle)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer stats */}
        <div className="px-4 py-3 border-t border-gray-100 bg-gray-50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-500">
              {hasActiveFilters ? `${filteredVehicles.length} of ${vehicles.length}` : `${vehicles.length} trucks`}
            </span>
            <button
              onClick={fetchMapData}
              className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {/* Error banner */}
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* Empty state overlay */}
        {!loading && vehicles.length > 0 && buildMarkers().length === 0 && (viewMode === 'fleet' || viewMode === 'all') && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/90">
            <div className="text-center p-6 max-w-sm">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gray-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-900">No trucks on map</p>
              <p className="text-xs text-gray-500 mt-1">
                {hasActiveFilters
                  ? 'No trucks match your filters'
                  : 'Trucks need GPS devices to appear here'}
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
          <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-80 z-20 bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50">
              <div>
                <h3 className="font-medium text-gray-900">{selectedItem.title}</h3>
                <p className="text-xs text-gray-500">
                  {selectedItem.type === 'truck' ? 'Vehicle' : selectedItem.type === 'pickup' ? 'Pickup' : 'Delivery'}
                </p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Content */}
            <div className="p-4 max-h-64 overflow-y-auto">
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl bg-white rounded-xl overflow-hidden shadow-2xl">
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

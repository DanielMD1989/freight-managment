/**
 * Carrier Map Page
 *
 * Professional fleet overview and real-time trip tracking
 * Design System: Clean & Minimal with Teal accent
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

// P0 Fix #1: TruckListItem component for sidebar truck list
function TruckListItem({
  vehicle,
  isSelected,
  onClick,
}: {
  vehicle: Vehicle;
  isSelected: boolean;
  onClick: () => void;
}) {
  const statusColor =
    vehicle.gpsStatus === 'ACTIVE' ? 'bg-emerald-500' :
    vehicle.gpsStatus === 'OFFLINE' ? 'bg-amber-500' : 'bg-slate-300';

  return (
    <button
      onClick={onClick}
      className={`w-full px-3 py-2.5 text-left rounded-lg transition-all ${
        isSelected
          ? 'bg-teal-50 border border-teal-200'
          : 'hover:bg-slate-50 border border-transparent'
      }`}
    >
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${statusColor} flex-shrink-0`} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-slate-800 truncate">
            {vehicle.plateNumber ?? 'No Plate'}
          </div>
          <div className="text-xs text-slate-500 truncate">
            {vehicle.truckType ?? 'Unknown'} - {vehicle.status?.replace(/_/g, ' ') ?? 'Unknown'}
          </div>
        </div>
        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

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
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">Type</div>
            <div className="text-sm font-semibold text-slate-800">{vehicle.truckType ?? 'Unknown'}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">Capacity</div>
            <div className="text-sm font-semibold text-slate-800">{vehicle.capacity?.toLocaleString() ?? '-'} kg</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">Status</div>
            <div className="text-sm font-semibold text-slate-800">{vehicle.status ?? 'Unknown'}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">GPS Status</div>
            <div className={`text-sm font-semibold ${
              vehicle.gpsStatus === 'ACTIVE' ? 'text-emerald-600' :
              vehicle.gpsStatus === 'OFFLINE' ? 'text-amber-600' : 'text-slate-400'
            }`}>
              {vehicle.gpsStatus ?? 'Unknown'}
            </div>
          </div>
        </div>
        {/* P1 Fix #4: Driver contact info */}
        {vehicle.driver && (
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="text-xs font-medium text-slate-500 mb-2">Driver</div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-slate-800">{vehicle.driver.name}</div>
                {vehicle.driver.phone && (
                  <div className="text-xs text-slate-500">{vehicle.driver.phone}</div>
                )}
              </div>
              {vehicle.driver.phone && (
                <a
                  href={`tel:${vehicle.driver.phone}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gradient-to-r from-teal-600 to-teal-500 rounded-lg hover:from-teal-700 hover:to-teal-600 transition-all"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Call
                </a>
              )}
            </div>
          </div>
        )}
        {vehicle.currentLocation?.updatedAt && (
          <div className="text-xs text-slate-500">
            Last update: {formatDate(vehicle.currentLocation.updatedAt)}
          </div>
        )}
      </div>
    );
  }

  if ((selectedItem.type === 'pickup' || selectedItem.type === 'delivery') && selectedItem.data) {
    const trip = selectedItem.data as Trip;
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">Load ID</div>
            <div className="text-sm font-semibold text-slate-800 font-mono">{trip.loadId.slice(0, 8)}...</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">Truck</div>
            <div className="text-sm font-semibold text-slate-800">{trip.truck.plateNumber}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">Status</div>
            <div className="text-sm font-semibold text-teal-600">{trip.status}</div>
          </div>
          {trip.shipper && (
            <div className="p-3 rounded-lg bg-slate-50">
              <div className="text-xs font-medium text-slate-500 mb-1">Shipper</div>
              <div className="text-sm font-semibold text-slate-800">{trip.shipper.name}</div>
            </div>
          )}
        </div>
        {trip.startedAt && (
          <div className="text-xs text-slate-500">Started: {formatDate(trip.startedAt)}</div>
        )}
        {viewMode === 'history' && trip.completedAt && (
          <button
            onClick={() => onViewPlayback(trip.loadId)}
            className="w-full mt-2 px-4 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-teal-500 rounded-xl hover:from-teal-700 hover:to-teal-600 transition-all shadow-md shadow-teal-500/25"
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
      <div className="h-screen bg-slate-50 flex animate-pulse">
        {/* P0 Fix #2: Responsive loading state */}
        <div className="hidden md:block w-64 bg-white border-r border-slate-200/60" />
        <div className="flex-1 p-4">
          <div className="h-full bg-white rounded-2xl border border-slate-200/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-50 flex overflow-hidden">
      {/* P0 Fix #2: Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 z-30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* P0 Fix #2: Mobile hamburger toggle */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-20 md:hidden w-10 h-10 bg-white rounded-xl shadow-lg shadow-slate-200/50 flex items-center justify-center text-slate-600 hover:text-slate-800 transition-colors"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Left Control Panel - P0 Fix #2: Responsive sidebar */}
      <div className={`
        fixed md:relative inset-y-0 left-0 z-40 md:z-0
        w-72 md:w-64 bg-white border-r border-slate-200/60 flex flex-col
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h1 className="text-base font-semibold text-slate-800">Fleet Map</h1>
            <div className="flex items-center gap-2 mt-1">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-xs text-slate-500">{isConnected ? 'Live tracking' : 'Offline'}</span>
            </div>
          </div>
          {/* Mobile close button */}
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* View Mode */}
        <div className="px-4 py-4 border-b border-slate-100">
          <label className="text-xs font-medium text-slate-500 mb-2 block">View Mode</label>
          <div className="grid grid-cols-2 gap-1.5">
            {(['all', 'fleet', 'trips', 'history'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-2 text-xs font-medium rounded-lg transition-all ${
                  viewMode === mode
                    ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-sm shadow-teal-500/30'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {mode === 'all' ? 'All' : mode === 'fleet' ? 'Fleet' : mode === 'trips' ? 'Trips' : 'History'}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range for History */}
        {viewMode === 'history' && (
          <div className="px-4 py-4 border-b border-slate-100">
            <label className="text-xs font-medium text-slate-500 mb-2 block">Date Range</label>
            <div className="space-y-2">
              <div>
                <label className="text-xs text-slate-400 mb-1 block">From:</label>
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1 block">To:</label>
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
                />
              </div>
              <button
                onClick={fetchMapData}
                className="w-full py-2 text-xs font-medium text-white bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 rounded-lg transition-all shadow-sm"
              >
                Apply
              </button>
            </div>
          </div>
        )}

        {/* Filters Section */}
        <div className="px-4 py-4 border-b border-slate-100">
          <div className="flex items-center justify-between mb-3">
            <label className="text-xs font-medium text-slate-500">Filters</label>
            {hasActiveFilters && (
              <button
                onClick={() => setFleetFilters(defaultFilters)}
                className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-md transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Reset
              </button>
            )}
          </div>

          <div className="space-y-3">
            {/* Search */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Search Plate</label>
              <div className="relative">
                <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Plate number..."
                  value={fleetFilters.searchQuery}
                  onChange={(e) => setFleetFilters({ ...fleetFilters, searchQuery: e.target.value })}
                  className="w-full pl-8 pr-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none"
                />
              </div>
            </div>

            {/* GPS Status */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">GPS Status</label>
              <select
                value={fleetFilters.gpsStatus[0] || ''}
                onChange={(e) => {
                  const value = e.target.value as GpsDisplayStatus;
                  setFleetFilters({
                    ...fleetFilters,
                    gpsStatus: value ? [value] : []
                  });
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
              >
                <option value="">All</option>
                <option value="ACTIVE">Active ({stats.active})</option>
                <option value="OFFLINE">Offline ({stats.offline})</option>
                <option value="NO_DEVICE">No Device ({stats.noDevice})</option>
              </select>
            </div>

            {/* Truck Status */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Truck Status</label>
              <select
                value={fleetFilters.truckStatus[0] || ''}
                onChange={(e) => {
                  const value = e.target.value as TruckAvailabilityStatus;
                  setFleetFilters({
                    ...fleetFilters,
                    truckStatus: value ? [value] : []
                  });
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
              >
                <option value="">All</option>
                {[...new Set(vehicles.map(v => v.status).filter(Boolean))].map((status) => {
                  const count = vehicles.filter(v => v.status === status).length;
                  return (
                    <option key={status} value={status}>
                      {status.replace(/_/g, ' ')} ({count})
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Truck Type */}
            <div>
              <label className="text-xs text-slate-500 mb-1 block">Truck Type</label>
              <select
                value={fleetFilters.truckType[0] || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  setFleetFilters({
                    ...fleetFilters,
                    truckType: value ? [value] : []
                  });
                }}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none bg-white"
              >
                <option value="">All</option>
                {[...new Set(vehicles.map(v => v.truckType).filter(Boolean))].map((type) => {
                  const count = vehicles.filter(v => v.truckType === type).length;
                  return (
                    <option key={type} value={type}>
                      {type} ({count})
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          {/* Filter Count */}
          {hasActiveFilters && (
            <div className="mt-4 px-3 py-2 bg-teal-50 rounded-lg text-xs text-teal-700">
              Showing <span className="font-semibold">{filteredVehicles.length}</span> of {vehicles.length} trucks
            </div>
          )}
        </div>

        {/* P0 Fix #1: Truck List */}
        <div className="flex-1 overflow-y-auto border-b border-slate-100">
          <div className="px-4 py-3 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-500">Trucks</label>
              <span className="text-xs text-slate-400">
                {hasActiveFilters ? filteredVehicles.length : vehicles.length} total
              </span>
            </div>
          </div>

          {/* P1 Fix #3: Empty states */}
          {vehicles.length === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 flex items-center justify-center">
                <svg className="w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">No trucks registered</p>
              <p className="text-xs text-slate-400">Add trucks to your fleet to start tracking their locations.</p>
            </div>
          ) : stats.active === 0 && stats.offline === 0 ? (
            <div className="p-6 text-center">
              <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-amber-50 flex items-center justify-center">
                <svg className="w-6 h-6 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 mb-1">No GPS data available</p>
              <p className="text-xs text-slate-400">Install GPS devices on your trucks to enable real-time tracking.</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {(hasActiveFilters ? filteredVehicles : vehicles).map((vehicle) => (
                <TruckListItem
                  key={vehicle.id}
                  vehicle={vehicle}
                  isSelected={selectedItem?.id === `vehicle-${vehicle.id}`}
                  onClick={() => handleTruckListClick(vehicle)}
                />
              ))}
              {hasActiveFilters && filteredVehicles.length === 0 && (
                <div className="p-4 text-center">
                  <p className="text-xs text-slate-400">No trucks match your filters</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer - Stats & Refresh */}
        <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
            <span>{stats.total} Total</span>
            <span className="text-emerald-600">{stats.active} Active</span>
            <span className="text-amber-600">{stats.offline} Offline</span>
          </div>
          <button
            onClick={fetchMapData}
            className="w-full py-2 text-xs font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {error && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-4 py-2 bg-rose-50 border border-rose-200/60 rounded-xl text-rose-700 text-sm flex items-center gap-2 shadow-sm">
            <svg className="w-4 h-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* P1 Fix #3: Empty state overlay on map when no trucks have GPS */}
        {!loading && vehicles.length > 0 && buildMarkers().length === 0 && (viewMode === 'fleet' || viewMode === 'all') && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 backdrop-blur-sm">
            <div className="text-center p-8 max-w-sm">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-50 flex items-center justify-center">
                <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-800 mb-2">No trucks on map</h3>
              <p className="text-sm text-slate-500">
                {hasActiveFilters
                  ? 'No trucks match your current filters. Try adjusting your filters to see trucks on the map.'
                  : 'Your trucks don\'t have GPS location data yet. Install GPS devices to enable real-time tracking.'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={() => setFleetFilters(defaultFilters)}
                  className="mt-4 px-4 py-2 text-sm font-medium text-teal-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors"
                >
                  Clear Filters
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

        {/* Selected Item Details - Bottom Panel */}
        {selectedItem && (
          <div className="absolute bottom-4 left-4 right-4 z-20 bg-white rounded-2xl shadow-xl shadow-slate-200/50 border border-slate-200/60 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100 bg-slate-50">
              <h3 className="font-medium text-slate-800 text-sm">{selectedItem.title}</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-7 h-7 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-white flex items-center justify-center transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4 max-h-48 overflow-y-auto">
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl">
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

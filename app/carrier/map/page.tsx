/**
 * Carrier Map Page
 *
 * Fleet overview and active trips tracking
 * MAP + GPS Implementation - Epic 3: Carrier Map Access
 *
 * Features:
 * - View all trucks in the organization with GPS status color-coding
 * - Track active trips in real-time via WebSocket
 * - View trip history with playback
 * - Color-coded truck status (available, on-trip, offline)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import GoogleMap, { MapMarker, MapRoute } from '@/components/GoogleMap';
import { useGpsRealtime, GpsPosition } from '@/hooks/useGpsRealtime';
import TripHistoryPlayback from '@/components/TripHistoryPlayback';

interface Vehicle {
  id: string;
  plateNumber: string;
  truckType: string;
  capacity: number;
  status: string;
  gpsStatus: 'ACTIVE' | 'OFFLINE' | 'NO_DEVICE';
  currentLocation: {
    lat: number;
    lng: number;
    updatedAt?: string;
  } | null;
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

interface Stats {
  total: number;
  active: number;
  offline: number;
  noDevice: number;
  available: number;
  inTransit: number;
}

type ViewMode = 'fleet' | 'trips' | 'history' | 'all';

// Helper component for selected item details to avoid TypeScript issues with unknown data type
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
      <div className="text-sm text-gray-600 dark:text-gray-400">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-medium">Type:</span> {vehicle.truckType}
          </div>
          <div>
            <span className="font-medium">Capacity:</span>{' '}
            {vehicle.capacity?.toLocaleString()} kg
          </div>
          <div>
            <span className="font-medium">Status:</span> {vehicle.status}
          </div>
          <div>
            <span className="font-medium">GPS Status:</span>{' '}
            <span
              className={
                vehicle.gpsStatus === 'ACTIVE'
                  ? 'text-green-600'
                  : vehicle.gpsStatus === 'OFFLINE'
                  ? 'text-orange-500'
                  : 'text-gray-400'
              }
            >
              {vehicle.gpsStatus}
            </span>
          </div>
          {vehicle.currentLocation?.updatedAt && (
            <div className="col-span-2">
              <span className="font-medium">Last Update:</span>{' '}
              {formatDate(vehicle.currentLocation.updatedAt)}
            </div>
          )}
        </div>
      </div>
    );
  }

  if ((selectedItem.type === 'pickup' || selectedItem.type === 'delivery') && selectedItem.data) {
    const trip = selectedItem.data as Trip;
    return (
      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
        <div>
          <span className="font-medium">Load ID:</span> {trip.loadId}
        </div>
        <div>
          <span className="font-medium">Truck:</span> {trip.truck.plateNumber}
        </div>
        <div>
          <span className="font-medium">Status:</span> {trip.status}
        </div>
        {trip.shipper && (
          <div>
            <span className="font-medium">Shipper:</span> {trip.shipper.name}
          </div>
        )}
        {trip.startedAt && (
          <div>
            <span className="font-medium">Started:</span> {formatDate(trip.startedAt)}
          </div>
        )}
        {viewMode === 'history' && trip.completedAt && (
          <button
            onClick={() => onViewPlayback(trip.loadId)}
            className="mt-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
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

  // Date range for history view
  const [historyDateFrom, setHistoryDateFrom] = useState<string>(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [historyDateTo, setHistoryDateTo] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  // Real-time GPS updates via WebSocket
  const { isConnected, positions } = useGpsRealtime({
    autoConnect: true,
    onPositionUpdate: (position: GpsPosition) => {
      // Update vehicle position in real-time
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

      // Update active trips if the truck is on a trip
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

      // Fetch vehicles, active trips, and historical trips in parallel
      const [vehiclesRes, activeTripsRes, historicalTripsRes] = await Promise.all([
        fetch('/api/map/vehicles'),
        fetch('/api/map/trips?status=IN_TRANSIT'),
        fetch(`/api/map/trips?status=COMPLETED&dateFrom=${historyDateFrom}&dateTo=${historyDateTo}&limit=20`),
      ]);

      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json();
        setVehicles(data.vehicles || []);
        setStats(data.stats || {
          total: 0,
          active: 0,
          offline: 0,
          noDevice: 0,
          available: 0,
          inTransit: 0,
        });
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

  // Build markers based on view mode
  const buildMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];

    // Add vehicle markers (fleet view)
    if (viewMode === 'fleet' || viewMode === 'all') {
      vehicles.forEach((vehicle) => {
        if (vehicle.currentLocation) {
          // Color-code based on GPS status
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
            title: vehicle.plateNumber,
            type: 'truck',
            status,
            data: vehicle,
          });
        }
      });
    }

    // Add active trip markers (trips view)
    if (viewMode === 'trips' || viewMode === 'all') {
      activeTrips.forEach((trip) => {
        // Pickup marker
        if (trip.pickupLocation) {
          markers.push({
            id: `pickup-${trip.id}`,
            position: trip.pickupLocation,
            title: `Pickup: ${trip.pickupLocation.address}`,
            type: 'pickup',
            data: trip,
          });
        }

        // Delivery marker
        if (trip.deliveryLocation) {
          markers.push({
            id: `delivery-${trip.id}`,
            position: trip.deliveryLocation,
            title: `Delivery: ${trip.deliveryLocation.address}`,
            type: 'delivery',
            data: trip,
          });
        }

        // Current truck position on trip
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

    // Add historical trip markers (history view)
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

  // Build routes for trips
  const buildRoutes = (): MapRoute[] => {
    if (viewMode === 'fleet') return [];

    const routes: MapRoute[] = [];

    // Active trip routes (blue)
    if (viewMode === 'trips' || viewMode === 'all') {
      activeTrips
        .filter((trip) => trip.pickupLocation && trip.deliveryLocation)
        .forEach((trip) => {
          routes.push({
            id: `route-${trip.id}`,
            origin: trip.pickupLocation,
            destination: trip.deliveryLocation,
            waypoints: trip.currentLocation ? [trip.currentLocation] : [],
            color: '#2563eb',
            tripId: trip.id,
          });
        });
    }

    // Historical trip routes (gray)
    if (viewMode === 'history') {
      historicalTrips
        .filter((trip) => trip.pickupLocation && trip.deliveryLocation)
        .forEach((trip) => {
          routes.push({
            id: `hist-route-${trip.id}`,
            origin: trip.pickupLocation,
            destination: trip.deliveryLocation,
            color: '#9CA3AF',
            tripId: trip.id,
          });
        });
    }

    return routes;
  };

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedItem(marker);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="h-[600px] bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fleet Map</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Track your trucks and shipments in real-time
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* WebSocket connection indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                isConnected ? 'bg-green-500' : 'bg-red-500'
              }`}
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              {isConnected ? 'Live' : 'Disconnected'}
            </span>
          </div>
          <button
            onClick={fetchMapData}
            className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
          >
            Refresh
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* View Mode Toggle */}
      <div className="flex gap-2">
        {(['all', 'fleet', 'trips', 'history'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              viewMode === mode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
            }`}
          >
            {mode === 'all' ? 'All' : mode === 'fleet' ? 'Fleet' : mode === 'trips' ? 'Active Trips' : 'History'}
          </button>
        ))}
      </div>

      {/* Date Range Filter (History view only) */}
      {viewMode === 'history' && (
        <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">From:</label>
            <input
              type="date"
              value={historyDateFrom}
              onChange={(e) => setHistoryDateFrom(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-600 dark:text-gray-400">To:</label>
            <input
              type="date"
              value={historyDateTo}
              onChange={(e) => setHistoryDateTo(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg dark:bg-slate-700 dark:border-slate-600 dark:text-white"
            />
          </div>
          <button
            onClick={fetchMapData}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700"
          >
            Apply
          </button>
        </div>
      )}

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {stats.total}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Trucks</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-green-600">
            {stats.active}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">GPS Active</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-orange-500">
            {stats.offline}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">GPS Offline</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-gray-400">
            {stats.noDevice}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">No GPS</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-blue-600">
            {activeTrips.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Active Trips</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-emerald-600">
            {stats.available}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Available</div>
        </div>
      </div>

      {/* Map */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <GoogleMap
          markers={buildMarkers()}
          routes={buildRoutes()}
          height="600px"
          autoFitBounds={true}
          showTraffic={false}
          onMarkerClick={handleMarkerClick}
          refreshInterval={30000}
        />
      </div>

      {/* Selected Item Details */}
      {selectedItem && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {selectedItem.title}
            </h3>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>
          <SelectedItemDetails
            selectedItem={selectedItem}
            viewMode={viewMode}
            formatDate={formatDate}
            onViewPlayback={setSelectedHistoricalTripId}
          />
        </div>
      )}

      {/* Legend */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">GPS Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">In Transit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">GPS Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">No GPS Device</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Pickup</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Delivery</span>
          </div>
        </div>
      </div>

      {/* Trip History Playback Modal */}
      {selectedHistoricalTripId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
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

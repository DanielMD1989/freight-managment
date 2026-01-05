/**
 * Admin Map Page
 *
 * Global overview of all platform operations
 * MAP + GPS Implementation - Epic 1: Super Admin / Admin Map Access
 *
 * Features:
 * - View all active and historical trips
 * - Fleet overview with GPS status
 * - Platform-wide statistics
 * - Historical trip playback
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import GoogleMap, { MapMarker, MapRoute } from '@/components/GoogleMap';

interface Vehicle {
  id: string;
  plateNumber: string;
  truckType: string;
  status: string;
  gpsStatus: 'ACTIVE' | 'OFFLINE' | 'NO_DEVICE';
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

type ViewMode = 'overview' | 'fleet' | 'trips' | 'historical';

export default function AdminMapPage() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [historicalTrips, setHistoricalTrips] = useState<Trip[]>([]);
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
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedItem, setSelectedItem] = useState<MapMarker | null>(null);
  const [filters, setFilters] = useState({
    carrier: '',
    status: '',
    dateFrom: '',
    dateTo: '',
  });

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [vehiclesRes, tripsRes] = await Promise.all([
        fetch('/api/map/vehicles?includeAll=true'),
        fetch('/api/map/trips'),
      ]);

      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json();
        const vehicleList = data.vehicles || [];
        setVehicles(vehicleList);

        // Calculate stats
        setStats((prev) => ({
          ...prev,
          totalVehicles: vehicleList.length,
          activeGps: vehicleList.filter((v: Vehicle) => v.gpsStatus === 'ACTIVE').length,
          offlineGps: vehicleList.filter((v: Vehicle) => v.gpsStatus === 'OFFLINE').length,
          noDevice: vehicleList.filter((v: Vehicle) => v.gpsStatus === 'NO_DEVICE').length,
        }));
      }

      if (tripsRes.ok) {
        const data = await tripsRes.json();
        const tripList = data.trips || [];
        const activeTrips = tripList.filter((t: Trip) => t.status === 'IN_TRANSIT');
        const completed = tripList.filter((t: Trip) => {
          if (t.status !== 'COMPLETED' || !t.completedAt) return false;
          const completedDate = new Date(t.completedAt);
          const today = new Date();
          return completedDate.toDateString() === today.toDateString();
        });

        setTrips(activeTrips);
        setHistoricalTrips(tripList.filter((t: Trip) => t.status === 'COMPLETED'));

        setStats((prev) => ({
          ...prev,
          activeTrips: activeTrips.length,
          completedToday: completed.length,
        }));
      }
    } catch (err) {
      setError('Failed to load map data');
      console.error('Map data fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Build markers based on view mode
  const buildMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];

    // Vehicle markers
    if (viewMode === 'overview' || viewMode === 'fleet') {
      vehicles.forEach((vehicle) => {
        if (vehicle.currentLocation) {
          markers.push({
            id: `vehicle-${vehicle.id}`,
            position: vehicle.currentLocation,
            title: `${vehicle.plateNumber} (${vehicle.carrier.name})`,
            type: 'truck',
            status: vehicle.status === 'IN_TRANSIT' ? 'in_transit' :
                   vehicle.status === 'AVAILABLE' ? 'available' : 'offline',
            data: vehicle,
          });
        }
      });
    }

    // Active trip markers
    if (viewMode === 'overview' || viewMode === 'trips') {
      trips.forEach((trip) => {
        // Current position
        if (trip.currentLocation) {
          markers.push({
            id: `trip-pos-${trip.id}`,
            position: trip.currentLocation,
            title: `${trip.truck.plateNumber} - In Transit`,
            type: 'truck',
            status: 'in_transit',
            data: trip,
          });
        }

        // Pickup
        if (trip.pickupLocation) {
          markers.push({
            id: `trip-pickup-${trip.id}`,
            position: trip.pickupLocation,
            title: `Pickup: ${trip.pickupLocation.address}`,
            type: 'pickup',
            data: trip,
          });
        }

        // Delivery
        if (trip.deliveryLocation) {
          markers.push({
            id: `trip-delivery-${trip.id}`,
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

  // Build routes for active trips
  const buildRoutes = (): MapRoute[] => {
    if (viewMode === 'fleet') return [];

    const tripList = viewMode === 'historical' ? historicalTrips.slice(0, 10) : trips;

    return tripList
      .filter((trip) => trip.pickupLocation && trip.deliveryLocation)
      .map((trip) => ({
        id: `route-${trip.id}`,
        origin: trip.pickupLocation,
        destination: trip.deliveryLocation,
        waypoints: trip.currentLocation ? [trip.currentLocation] : [],
        color: viewMode === 'historical' ? '#94a3b8' : '#2563eb',
        data: trip,
      }));
  };

  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedItem(marker);
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Map</h1>
          <p className="text-gray-500">
            Global overview of all operations
          </p>
        </div>
        <button
          onClick={fetchMapData}
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
        >
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Platform Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-900">{stats.totalVehicles}</div>
          <div className="text-sm text-gray-500">Total Vehicles</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-green-600">{stats.activeGps}</div>
          <div className="text-sm text-gray-500">GPS Active</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-orange-600">{stats.offlineGps}</div>
          <div className="text-sm text-gray-500">GPS Offline</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-gray-400">{stats.noDevice}</div>
          <div className="text-sm text-gray-500">No GPS Device</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-blue-600">{stats.activeTrips}</div>
          <div className="text-sm text-gray-500">Active Trips</div>
        </div>
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="text-2xl font-bold text-purple-600">{stats.completedToday}</div>
          <div className="text-sm text-gray-500">Completed Today</div>
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex gap-2">
        {(['overview', 'fleet', 'trips', 'historical'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
              viewMode === mode
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {mode}
          </button>
        ))}
      </div>

      {/* Filters (for historical view) */}
      {viewMode === 'historical' && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Carrier</label>
              <select
                value={filters.carrier}
                onChange={(e) => setFilters({ ...filters, carrier: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="">All Carriers</option>
                {/* Carrier options would be populated dynamically */}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div className="flex items-end">
              <button className="w-full px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700">
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <GoogleMap
          markers={buildMarkers()}
          routes={buildRoutes()}
          height="550px"
          autoFitBounds={true}
          showTraffic={viewMode === 'trips'}
          onMarkerClick={handleMarkerClick}
          refreshInterval={30000}
        />
      </div>

      {/* Selected Item Details */}
      {selectedItem && (
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900">
              {selectedItem.title}
            </h3>
            <button
              onClick={() => setSelectedItem(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              Close
            </button>
          </div>
          <div className="text-sm text-gray-600 space-y-1">
            {/* Vehicle details */}
            {selectedItem.id.startsWith('vehicle-') && selectedItem.data && (
              <div className="grid grid-cols-2 gap-2">
                <p><strong>Type:</strong> {(selectedItem.data as Vehicle).truckType}</p>
                <p><strong>Status:</strong> {(selectedItem.data as Vehicle).status}</p>
                <p><strong>GPS:</strong> {(selectedItem.data as Vehicle).gpsStatus}</p>
                <p><strong>Carrier:</strong> {(selectedItem.data as Vehicle).carrier.name}</p>
                {(selectedItem.data as Vehicle).currentLocation?.updatedAt && (
                  <p className="col-span-2">
                    <strong>Last Update:</strong>{' '}
                    {new Date((selectedItem.data as Vehicle).currentLocation!.updatedAt).toLocaleString()}
                  </p>
                )}
              </div>
            )}

            {/* Trip details */}
            {selectedItem.id.startsWith('trip-') && selectedItem.data && (
              <div className="grid grid-cols-2 gap-2">
                <p><strong>Load ID:</strong> {(selectedItem.data as Trip).loadId}</p>
                <p><strong>Status:</strong> {(selectedItem.data as Trip).status}</p>
                <p><strong>Truck:</strong> {(selectedItem.data as Trip).truck.plateNumber}</p>
                <p><strong>Carrier:</strong> {(selectedItem.data as Trip).carrier.name}</p>
                <p><strong>Shipper:</strong> {(selectedItem.data as Trip).shipper.name}</p>
                {(selectedItem.data as Trip).startedAt && (
                  <p>
                    <strong>Started:</strong>{' '}
                    {new Date((selectedItem.data as Trip).startedAt!).toLocaleString()}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white p-4 rounded-lg border border-gray-200">
        <h3 className="font-semibold text-gray-900 mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-gray-600">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600">In Transit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
            <span className="text-gray-600">Offline</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-emerald-500 rounded"></div>
            <span className="text-gray-600">Pickup</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span className="text-gray-600">Delivery</span>
          </div>
        </div>
      </div>
    </div>
  );
}

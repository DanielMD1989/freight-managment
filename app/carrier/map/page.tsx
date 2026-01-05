/**
 * Carrier Map Page
 *
 * Fleet overview and active trips tracking
 * MAP + GPS Implementation - Epic 3: Carrier Map Access
 *
 * Features:
 * - View all trucks in the organization
 * - Track active trips in real-time
 * - Color-coded truck status (available, on-trip, offline)
 */

'use client';

import { useState, useEffect } from 'react';
import GoogleMap, { MapMarker, MapRoute } from '@/components/GoogleMap';

interface Truck {
  id: string;
  plateNumber: string;
  truckType: string;
  status: string;
  currentLocation?: {
    lat: number;
    lng: number;
  };
}

interface ActiveTrip {
  id: string;
  loadId: string;
  status: string;
  truck: {
    id: string;
    plateNumber: string;
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
}

type ViewMode = 'fleet' | 'trips' | 'all';

export default function CarrierMapPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [activeTrips, setActiveTrips] = useState<ActiveTrip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedItem, setSelectedItem] = useState<MapMarker | null>(null);

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch trucks and active trips in parallel
      const [trucksRes, tripsRes] = await Promise.all([
        fetch('/api/trucks?includeLocation=true'),
        fetch('/api/map/trips?status=IN_TRANSIT'),
      ]);

      if (trucksRes.ok) {
        const trucksData = await trucksRes.json();
        setTrucks(trucksData.trucks || []);
      }

      if (tripsRes.ok) {
        const tripsData = await tripsRes.json();
        setActiveTrips(tripsData.trips || []);
      }
    } catch (err) {
      setError('Failed to load map data');
      console.error('Map data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  // Build markers based on view mode
  const buildMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];

    // Add truck markers (fleet view)
    if (viewMode === 'fleet' || viewMode === 'all') {
      trucks.forEach((truck) => {
        if (truck.currentLocation) {
          markers.push({
            id: `truck-${truck.id}`,
            position: truck.currentLocation,
            title: truck.plateNumber,
            type: 'truck',
            status: truck.status === 'IN_TRANSIT' ? 'in_transit' :
                   truck.status === 'AVAILABLE' ? 'available' : 'offline',
            data: truck,
          });
        }
      });
    }

    // Add trip markers (pickup, delivery, current position)
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

    return markers;
  };

  // Build routes for active trips
  const buildRoutes = (): MapRoute[] => {
    if (viewMode === 'fleet') return [];

    return activeTrips
      .filter((trip) => trip.pickupLocation && trip.deliveryLocation)
      .map((trip) => ({
        id: `route-${trip.id}`,
        origin: trip.pickupLocation,
        destination: trip.deliveryLocation,
        waypoints: trip.currentLocation ? [trip.currentLocation] : [],
        color: '#2563eb',
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
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fleet Map</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Track your trucks and active shipments
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

      {/* View Mode Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setViewMode('all')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setViewMode('fleet')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'fleet'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
          }`}
        >
          Fleet Only
        </button>
        <button
          onClick={() => setViewMode('trips')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            viewMode === 'trips'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
          }`}
        >
          Active Trips
        </button>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {trucks.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Trucks</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-green-600">
            {trucks.filter((t) => t.status === 'AVAILABLE').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Available</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-blue-600">
            {activeTrips.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Active Trips</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-gray-400">
            {trucks.filter((t) => !t.currentLocation).length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">No GPS</div>
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
          <div className="flex items-center justify-between mb-2">
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
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {selectedItem.type === 'truck' && selectedItem.data && (
              <div className="space-y-1">
                <p>Type: {(selectedItem.data as Truck).truckType}</p>
                <p>Status: {(selectedItem.data as Truck).status}</p>
              </div>
            )}
            {(selectedItem.type === 'pickup' || selectedItem.type === 'delivery') && selectedItem.data && (
              <div className="space-y-1">
                <p>Load ID: {(selectedItem.data as ActiveTrip).loadId}</p>
                <p>Trip Status: {(selectedItem.data as ActiveTrip).status}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
        <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Legend</h3>
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">In Transit</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded-full"></div>
            <span className="text-gray-600 dark:text-gray-400">Offline/No GPS</span>
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
    </div>
  );
}

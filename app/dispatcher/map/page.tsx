/**
 * Dispatcher Map Page
 *
 * Global view of all vehicles, trips, and load matching
 * MAP + GPS Implementation - Epic 2: Dispatcher Map Access
 *
 * Features:
 * - View all trucks and their availability
 * - Track all active trips
 * - Load-truck matching visualization
 * - Calculate DH-O distances
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import GoogleMap, { MapMarker, MapRoute } from '@/components/GoogleMap';

interface Truck {
  id: string;
  plateNumber: string;
  truckType: string;
  capacity: number;
  status: string;
  currentLocation?: {
    lat: number;
    lng: number;
  };
  carrier: {
    name: string;
  };
}

interface Load {
  id: string;
  referenceNumber: string;
  status: string;
  cargoType: string;
  weight: number;
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
  shipper: {
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

type ViewMode = 'all' | 'trucks' | 'loads' | 'trips' | 'matching';

export default function DispatcherMapPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedItem, setSelectedItem] = useState<MapMarker | null>(null);
  const [filters, setFilters] = useState({
    truckType: '',
    region: '',
  });

  useEffect(() => {
    fetchMapData();
  }, []);

  const fetchMapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [trucksRes, loadsRes, tripsRes] = await Promise.all([
        fetch('/api/map/vehicles'),
        fetch('/api/map/loads?status=POSTED'),
        fetch('/api/map/trips?status=IN_TRANSIT'),
      ]);

      if (trucksRes.ok) {
        const data = await trucksRes.json();
        setTrucks(data.vehicles || data.trucks || []);
      }

      if (loadsRes.ok) {
        const data = await loadsRes.json();
        setLoads(data.loads || []);
      }

      if (tripsRes.ok) {
        const data = await tripsRes.json();
        setTrips(data.trips || []);
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

    // Truck markers
    if (viewMode === 'all' || viewMode === 'trucks' || viewMode === 'matching') {
      trucks.forEach((truck) => {
        if (truck.currentLocation) {
          markers.push({
            id: `truck-${truck.id}`,
            position: truck.currentLocation,
            title: `${truck.plateNumber} (${truck.carrier.name})`,
            type: 'truck',
            status: truck.status === 'IN_TRANSIT' ? 'in_transit' :
                   truck.status === 'AVAILABLE' ? 'available' : 'offline',
            data: truck,
          });
        }
      });
    }

    // Load markers (pickup locations)
    if (viewMode === 'all' || viewMode === 'loads' || viewMode === 'matching') {
      loads.forEach((load) => {
        if (load.pickupLocation) {
          markers.push({
            id: `load-${load.id}`,
            position: load.pickupLocation,
            title: `Load ${load.referenceNumber}`,
            type: 'pickup',
            data: load,
          });
        }
      });
    }

    // Active trip markers
    if (viewMode === 'all' || viewMode === 'trips') {
      trips.forEach((trip) => {
        // Current truck position
        if (trip.currentLocation) {
          markers.push({
            id: `trip-${trip.id}`,
            position: trip.currentLocation,
            title: `Trip: ${trip.truck.plateNumber}`,
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
            title: 'Pickup',
            type: 'pickup',
            data: trip,
          });
        }

        // Delivery
        if (trip.deliveryLocation) {
          markers.push({
            id: `trip-delivery-${trip.id}`,
            position: trip.deliveryLocation,
            title: 'Delivery',
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
    if (viewMode === 'trucks' || viewMode === 'loads') return [];

    return trips
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

  // Calculate DH-O distance (simplified - actual would use Google Routes API)
  const calculateDistance = (
    lat1: number, lng1: number,
    lat2: number, lng2: number
  ): number => {
    const R = 3959; // Earth radius in miles
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return Math.round(R * c);
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
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dispatch Map</h1>
            <p className="text-gray-500 dark:text-gray-400">
              Monitor all trucks, loads, and active trips
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
        <div className="flex gap-2 flex-wrap">
          {(['all', 'trucks', 'loads', 'trips', 'matching'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
              }`}
            >
              {mode === 'matching' ? 'Load Matching' : mode}
            </button>
          ))}
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
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
            <div className="text-2xl font-bold text-orange-600">
              {loads.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Posted Loads</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-blue-600">
              {trips.length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">Active Trips</div>
          </div>
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
            <div className="text-2xl font-bold text-purple-600">
              {trucks.filter((t) => t.currentLocation).length}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400">GPS Active</div>
          </div>
        </div>

        {/* Map */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <GoogleMap
            markers={buildMarkers()}
            routes={buildRoutes()}
            height="550px"
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
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              {/* Truck details */}
              {selectedItem.id.startsWith('truck-') && selectedItem.data && (
                <div className="grid grid-cols-2 gap-2">
                  <p><strong>Type:</strong> {(selectedItem.data as Truck).truckType}</p>
                  <p><strong>Capacity:</strong> {(selectedItem.data as Truck).capacity} tons</p>
                  <p><strong>Status:</strong> {(selectedItem.data as Truck).status}</p>
                  <p><strong>Carrier:</strong> {(selectedItem.data as Truck).carrier.name}</p>
                </div>
              )}

              {/* Load details */}
              {selectedItem.id.startsWith('load-') && selectedItem.data && (
                <div className="grid grid-cols-2 gap-2">
                  <p><strong>Ref:</strong> {(selectedItem.data as Load).referenceNumber}</p>
                  <p><strong>Cargo:</strong> {(selectedItem.data as Load).cargoType}</p>
                  <p><strong>Weight:</strong> {(selectedItem.data as Load).weight} tons</p>
                  <p><strong>Shipper:</strong> {(selectedItem.data as Load).shipper.name}</p>

                  {/* Show nearby available trucks in matching mode */}
                  {viewMode === 'matching' && (
                    <div className="col-span-2 mt-2 pt-2 border-t border-gray-200 dark:border-slate-700">
                      <p className="font-semibold mb-1">Nearby Available Trucks:</p>
                      {trucks
                        .filter((t) => t.status === 'AVAILABLE' && t.currentLocation)
                        .slice(0, 5)
                        .map((truck) => {
                          const load = selectedItem.data as Load;
                          const distance = truck.currentLocation && load.pickupLocation
                            ? calculateDistance(
                                truck.currentLocation.lat,
                                truck.currentLocation.lng,
                                load.pickupLocation.lat,
                                load.pickupLocation.lng
                              )
                            : null;
                          return (
                            <div key={truck.id} className="flex justify-between text-xs py-1">
                              <span>{truck.plateNumber}</span>
                              <span className="text-blue-600">{distance} mi DH-O</span>
                            </div>
                          );
                        })}
                    </div>
                  )}
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
              <span className="text-gray-600 dark:text-gray-400">Available Truck</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600 dark:text-gray-400">In Transit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-orange-500 rounded"></div>
              <span className="text-gray-600 dark:text-gray-400">Posted Load</span>
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

/**
 * Dispatcher Map Page
 *
 * Global view of all vehicles, trips, and load matching
 * MAP + GPS Implementation - Epic 2: Dispatcher Map Access
 *
 * Features:
 * - View all trucks and their availability
 * - Real-time GPS updates via WebSocket
 * - Track all active trips
 * - Load-truck matching visualization
 * - Calculate DH-O distances using road API
 * - Filter by region and truck type
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import GoogleMap, { MapMarker, MapRoute } from '@/components/GoogleMap';
import { useGpsRealtime, GpsPosition } from '@/hooks/useGpsRealtime';
import { getCSRFToken } from '@/lib/csrfFetch';

interface Truck {
  id: string;
  plateNumber: string;
  truckType: string;
  capacity: number;
  status: string;
  gpsStatus?: 'ACTIVE' | 'OFFLINE' | 'NO_DEVICE';
  currentLocation?: {
    lat: number;
    lng: number;
    updatedAt?: string;
  };
  carrier: {
    name: string;
  };
  region?: string;
}

interface Load {
  id: string;
  referenceNumber: string;
  status: string;
  cargoType: string;
  weight: number;
  truckType?: string;
  pickupCity?: string;
  deliveryCity?: string;
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

interface RoadDistance {
  distanceKm: number;
  durationMinutes: number;
  source: string;
}

// Extended marker interface with data payload
interface SelectedMarker extends MapMarker {
  data?: Truck | Load | Trip;
}

type ViewMode = 'all' | 'trucks' | 'loads' | 'trips' | 'matching';

// Ethiopian regions for filtering
const ETHIOPIAN_REGIONS = [
  'Addis Ababa',
  'Afar',
  'Amhara',
  'Benishangul-Gumuz',
  'Dire Dawa',
  'Gambela',
  'Harari',
  'Oromia',
  'Sidama',
  'Somali',
  'SNNPR',
  'Tigray',
];

export default function DispatcherMapPage() {
  const [trucks, setTrucks] = useState<Truck[]>([]);
  const [loads, setLoads] = useState<Load[]>([]);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [selectedItem, setSelectedItem] = useState<SelectedMarker | null>(null);
  const [filters, setFilters] = useState({
    truckType: '',
    region: '',
  });
  const [nearbyDistances, setNearbyDistances] = useState<Record<string, RoadDistance>>({});
  const [calculatingDistances, setCalculatingDistances] = useState(false);

  // Real-time GPS updates
  const { isConnected, positions } = useGpsRealtime({
    autoConnect: true,
    subscribeAll: true,
    onPositionUpdate: useCallback((position: GpsPosition) => {
      // Update trucks with new position
      setTrucks(prev => prev.map(t => {
        if (t.id === position.truckId) {
          return {
            ...t,
            currentLocation: {
              lat: position.lat,
              lng: position.lng,
              updatedAt: position.timestamp,
            },
            gpsStatus: 'ACTIVE' as const,
          };
        }
        return t;
      }));

      // Update trips with new position
      setTrips(prev => prev.map(trip => {
        if (trip.truck.id === position.truckId) {
          return {
            ...trip,
            currentLocation: {
              lat: position.lat,
              lng: position.lng,
            },
          };
        }
        return trip;
      }));
    }, []),
  });

  useEffect(() => {
    fetchMapData();
  }, []);

  // M4 FIX: Use Promise.allSettled for combined error handling
  const fetchMapData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const results = await Promise.allSettled([
        fetch('/api/map/vehicles?includeAll=true'),
        fetch('/api/map/loads?status=POSTED'),
        fetch('/api/map/trips?status=IN_TRANSIT'),
      ]);

      const errors: string[] = [];

      // Process trucks
      if (results[0].status === 'fulfilled' && results[0].value.ok) {
        const data = await results[0].value.json();
        setTrucks(data.vehicles || data.trucks || []);
      } else {
        errors.push('trucks');
      }

      // Process loads
      if (results[1].status === 'fulfilled' && results[1].value.ok) {
        const data = await results[1].value.json();
        setLoads(data.loads || []);
      } else {
        errors.push('loads');
      }

      // Process trips
      if (results[2].status === 'fulfilled' && results[2].value.ok) {
        const data = await results[2].value.json();
        setTrips(data.trips || []);
      } else {
        errors.push('trips');
      }

      // M4 FIX: Show partial error if some data failed to load
      if (errors.length > 0 && errors.length < 3) {
        setError(`Failed to load some data (${errors.join(', ')}). Showing partial results.`);
      } else if (errors.length === 3) {
        setError('Failed to load map data');
      }
    } catch (err) {
      setError('Failed to load map data');
    } finally {
      setLoading(false);
    }
  }, []);

  // Filter trucks based on selected filters
  const filteredTrucks = trucks.filter(truck => {
    if (filters.truckType && truck.truckType !== filters.truckType) {
      return false;
    }
    if (filters.region && truck.region !== filters.region) {
      return false;
    }
    return true;
  });

  // Get unique truck types for filter
  const truckTypes = [...new Set(trucks.map(t => t.truckType).filter(Boolean))];

  // Calculate road distances for nearby trucks when a load is selected
  const calculateNearbyDistances = async (load: Load) => {
    if (!load.pickupLocation) return;

    setCalculatingDistances(true);
    const distances: Record<string, RoadDistance> = {};

    const availableTrucks = filteredTrucks
      .filter(t => t.status === 'AVAILABLE' && t.currentLocation)
      .slice(0, 10);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch('/api/routes/distance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken && { 'X-CSRF-Token': csrfToken }) },
        body: JSON.stringify({
          pairs: availableTrucks.map(truck => ({
            origin: { lat: truck.currentLocation!.lat, lng: truck.currentLocation!.lng },
            destination: { lat: load.pickupLocation.lat, lng: load.pickupLocation.lng },
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        interface DistanceResult {
          distanceKm: number;
          durationMinutes: number;
          source: string;
        }
        data.results?.forEach((result: DistanceResult, index: number) => {
          distances[availableTrucks[index].id] = {
            distanceKm: result.distanceKm,
            durationMinutes: result.durationMinutes,
            source: result.source,
          };
        });
      }
    } catch (err) {
      console.error('Failed to calculate distances:', err);
    }

    setNearbyDistances(distances);
    setCalculatingDistances(false);
  };

  // Build markers based on view mode
  const buildMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];

    // Truck markers
    if (viewMode === 'all' || viewMode === 'trucks' || viewMode === 'matching') {
      filteredTrucks.forEach((truck) => {
        if (truck.currentLocation) {
          markers.push({
            id: `truck-${truck.id}`,
            position: truck.currentLocation,
            title: `${truck.plateNumber} (${truck.carrier.name})`,
            type: 'truck',
            status: truck.gpsStatus === 'ACTIVE' ? 'active' :
                   truck.status === 'IN_TRANSIT' ? 'in_transit' :
                   truck.status === 'AVAILABLE' ? 'available' : 'offline',
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
            title: `Load ${load.referenceNumber || load.id.slice(-6)}`,
            type: 'pickup',
          });
        }
      });
    }

    // Active trip markers
    if (viewMode === 'all' || viewMode === 'trips') {
      trips.forEach((trip) => {
        if (trip.currentLocation) {
          markers.push({
            id: `trip-${trip.id}`,
            position: trip.currentLocation,
            title: `Trip: ${trip.truck.plateNumber}`,
            type: 'truck',
            status: 'in_transit',
          });
        }

        if (trip.pickupLocation) {
          markers.push({
            id: `trip-pickup-${trip.id}`,
            position: trip.pickupLocation,
            title: 'Pickup',
            type: 'pickup',
          });
        }

        if (trip.deliveryLocation) {
          markers.push({
            id: `trip-delivery-${trip.id}`,
            position: trip.deliveryLocation,
            title: 'Delivery',
            type: 'delivery',
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
        tripId: trip.id,
      }));
  };

  const handleMarkerClick = (marker: MapMarker) => {
    const truckId = marker.id.replace('truck-', '');
    const loadId = marker.id.replace('load-', '');
    const tripId = marker.id.replace(/^(trip-|trip-pickup-|trip-delivery-)/, '');

    const truck = trucks.find(t => t.id === truckId);
    const load = loads.find(l => l.id === loadId);
    const trip = trips.find(t => t.id === tripId);

    if (load) {
      setSelectedItem({ ...marker, data: load });
      if (viewMode === 'matching') {
        calculateNearbyDistances(load);
      }
    } else if (truck) {
      setSelectedItem({ ...marker, data: truck });
    } else if (trip) {
      setSelectedItem({ ...marker, data: trip });
    } else {
      setSelectedItem({ ...marker, data: undefined });
    }
  };

  const clearFilters = () => {
    setFilters({ truckType: '', region: '' });
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-500">
              {isConnected ? 'Live' : 'Offline'}
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
      <div className="flex gap-2 flex-wrap">
        {(['all', 'trucks', 'loads', 'trips', 'matching'] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => {
              setViewMode(mode);
              setSelectedItem(null);
              setNearbyDistances({});
            }}
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

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Truck Type
            </label>
            <select
              value={filters.truckType}
              onChange={(e) => setFilters({ ...filters, truckType: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600"
            >
              <option value="">All Types</option>
              {truckTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Region
            </label>
            <select
              value={filters.region}
              onChange={(e) => setFilters({ ...filters, region: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm dark:bg-slate-700 dark:border-slate-600"
            >
              <option value="">All Regions</option>
              {ETHIOPIAN_REGIONS.map(region => (
                <option key={region} value={region}>{region}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={clearFilters}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-slate-700 dark:text-gray-300"
            >
              Clear
            </button>
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400 flex items-end">
            Showing {filteredTrucks.length} of {trucks.length} trucks
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {filteredTrucks.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Trucks</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-green-600">
            {filteredTrucks.filter((t) => t.status === 'AVAILABLE').length}
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
            {filteredTrucks.filter((t) => t.gpsStatus === 'ACTIVE' || t.currentLocation).length}
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
          showTraffic={viewMode === 'trips'}
          onMarkerClick={handleMarkerClick}
          refreshInterval={0}
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
              onClick={() => {
                setSelectedItem(null);
                setNearbyDistances({});
              }}
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
                <p><strong>Capacity:</strong> {(selectedItem.data as Truck).capacity} kg</p>
                <p><strong>Status:</strong> {(selectedItem.data as Truck).status}</p>
                <p><strong>Carrier:</strong> {(selectedItem.data as Truck).carrier.name}</p>
                <p><strong>GPS:</strong> {(selectedItem.data as Truck).gpsStatus || 'Unknown'}</p>
                {(selectedItem.data as Truck).currentLocation?.updatedAt && (
                  <p><strong>Last Update:</strong> {new Date((selectedItem.data as Truck).currentLocation!.updatedAt!).toLocaleTimeString()}</p>
                )}
              </div>
            )}

            {/* Load details */}
            {selectedItem.id.startsWith('load-') && selectedItem.data && (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <p><strong>Ref:</strong> {(selectedItem.data as Load).referenceNumber || (selectedItem.data as Load).id.slice(-8)}</p>
                  <p><strong>Cargo:</strong> {(selectedItem.data as Load).cargoType || 'General'}</p>
                  <p><strong>Weight:</strong> {(selectedItem.data as Load).weight} kg</p>
                  <p><strong>Truck Type:</strong> {(selectedItem.data as Load).truckType || 'Any'}</p>
                  <p><strong>Shipper:</strong> {(selectedItem.data as Load).shipper.name}</p>
                  <p><strong>Route:</strong> {(selectedItem.data as Load).pickupCity} → {(selectedItem.data as Load).deliveryCity}</p>
                </div>

                {/* Show nearby available trucks in matching mode */}
                {viewMode === 'matching' && (
                  <div className="pt-3 border-t border-gray-200 dark:border-slate-700">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold">Nearby Available Trucks (DH-O):</p>
                      {calculatingDistances && (
                        <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>
                    {filteredTrucks
                      .filter((t) => t.status === 'AVAILABLE' && t.currentLocation)
                      .sort((a, b) => {
                        const distA = nearbyDistances[a.id]?.distanceKm ?? 999;
                        const distB = nearbyDistances[b.id]?.distanceKm ?? 999;
                        return distA - distB;
                      })
                      .slice(0, 8)
                      .map((truck) => {
                        const distance = nearbyDistances[truck.id];
                        return (
                          <div key={truck.id} className="flex justify-between items-center text-xs py-2 border-b border-gray-100 dark:border-slate-700 last:border-0">
                            <div>
                              <span className="font-medium">{truck.plateNumber}</span>
                              <span className="text-gray-400 ml-2">{truck.truckType}</span>
                            </div>
                            <div className="text-right">
                              {distance ? (
                                <>
                                  <span className="text-blue-600 font-medium">{distance.distanceKm.toFixed(1)} km</span>
                                  <span className="text-gray-400 ml-2">{distance.durationMinutes} min</span>
                                  {distance.source === 'haversine' && (
                                    <span className="text-xs text-orange-500 ml-1">*</span>
                                  )}
                                </>
                              ) : (
                                <span className="text-gray-400">Calculating...</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    <p className="text-xs text-gray-400 mt-2">
                      * Estimated (straight-line). Enable Google API for road distances.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Trip details */}
            {selectedItem.id.startsWith('trip') && selectedItem.data && (
              <div className="grid grid-cols-2 gap-2">
                <p><strong>Load ID:</strong> {(selectedItem.data as Trip).loadId.slice(-8)}</p>
                <p><strong>Status:</strong> {(selectedItem.data as Trip).status}</p>
                <p><strong>Truck:</strong> {(selectedItem.data as Trip).truck.plateNumber}</p>
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
            <span className="text-gray-600 dark:text-gray-400">Available / GPS Active</span>
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
            <div className="w-4 h-4 bg-emerald-500 rounded"></div>
            <span className="text-gray-600 dark:text-gray-400">Pickup / Load</span>
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

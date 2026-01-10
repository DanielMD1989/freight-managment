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

'use client';

import { useState, useEffect, useCallback } from 'react';
import GoogleMap, { MapMarker, MapRoute } from '@/components/GoogleMap';
import { useGpsRealtime, GpsPosition } from '@/hooks/useGpsRealtime';

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
  const [activeTrips, setActiveTrips] = useState<ShipmentTrip[]>([]);
  const [selectedTrip, setSelectedTrip] = useState<ShipmentTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tripProgress, setTripProgress] = useState<TripProgress | null>(null);
  const [progressLoading, setProgressLoading] = useState(false);

  // Real-time GPS updates
  const { isConnected, positions, subscribeToTrip, unsubscribeFromTrip } = useGpsRealtime({
    autoConnect: true,
    onPositionUpdate: useCallback((position: GpsPosition) => {
      // Update the selected trip's current location if it matches
      if (selectedTrip && position.truckId === selectedTrip.truck.id) {
        setSelectedTrip(prev => {
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
        setActiveTrips(prev => prev.map(trip => {
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
        }));
      }
    }, [selectedTrip]),
  });

  useEffect(() => {
    fetchMyTrips();
  }, []);

  // Subscribe to selected trip's GPS updates
  useEffect(() => {
    if (selectedTrip && selectedTrip.status === 'IN_TRANSIT') {
      subscribeToTrip(selectedTrip.loadId);
      return () => {
        unsubscribeFromTrip(selectedTrip.loadId);
      };
    }
  }, [selectedTrip, subscribeToTrip, unsubscribeFromTrip]);

  // Fetch trip progress when selected trip changes
  useEffect(() => {
    if (selectedTrip && selectedTrip.status === 'IN_TRANSIT') {
      fetchTripProgress(selectedTrip.loadId);
      // Refresh progress every 30 seconds
      const interval = setInterval(() => {
        fetchTripProgress(selectedTrip.loadId);
      }, 30000);
      return () => clearInterval(interval);
    } else {
      setTripProgress(null);
    }
  }, [selectedTrip]);

  const fetchMyTrips = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/map/trips?role=shipper');

      if (!response.ok) {
        throw new Error('Failed to fetch trips');
      }

      const data = await response.json();
      const trips = data.trips || [];
      setActiveTrips(trips);

      // Auto-select first trip if available
      if (trips.length > 0 && !selectedTrip) {
        setSelectedTrip(trips[0]);
      }
    } catch (err) {
      setError('Failed to load shipment data');
      console.error('Shipment data fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTripProgress = async (loadId: string) => {
    try {
      setProgressLoading(true);
      const response = await fetch(`/api/loads/${loadId}/progress`);
      if (response.ok) {
        const data = await response.json();
        setTripProgress(data.progress);
      }
    } catch (err) {
      console.error('Failed to fetch trip progress:', err);
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
        type: 'pickup',
      });
    }

    // Delivery marker
    if (selectedTrip.deliveryLocation) {
      markers.push({
        id: `delivery-${selectedTrip.id}`,
        position: selectedTrip.deliveryLocation,
        title: `Delivery: ${selectedTrip.deliveryLocation.address}`,
        type: 'delivery',
      });
    }

    // Current truck location (only if IN_TRANSIT)
    if (selectedTrip.status === 'IN_TRANSIT' && selectedTrip.currentLocation) {
      markers.push({
        id: `truck-${selectedTrip.id}`,
        position: selectedTrip.currentLocation,
        title: `${selectedTrip.truck.plateNumber} - In Transit`,
        type: 'truck',
        status: 'in_transit',
      });
    }

    return markers;
  };

  // Build route for selected trip
  const buildRoutes = (): MapRoute[] => {
    if (!selectedTrip || !selectedTrip.pickupLocation || !selectedTrip.deliveryLocation) {
      return [];
    }

    return [{
      id: `route-${selectedTrip.id}`,
      origin: selectedTrip.pickupLocation,
      destination: selectedTrip.deliveryLocation,
      waypoints: selectedTrip.currentLocation ? [selectedTrip.currentLocation] : [],
      color: '#2563eb',
      tripId: selectedTrip.id,
    }];
  };

  const formatETA = (eta: string | null) => {
    if (!eta) return 'Calculating...';
    const date = new Date(eta);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDistance = (km: number | null) => {
    if (km === null) return '--';
    return `${km.toFixed(1)} km`;
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

  // No active trips
  if (activeTrips.length === 0) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📦</div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            No Active Shipments
          </h2>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            You don&apos;t have any active shipments to track. Map tracking becomes available
            when your load is approved and the carrier starts the trip.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Track Shipment</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Real-time tracking of your active shipments
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* WebSocket Status */}
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-500 dark:text-gray-400">
              {isConnected ? 'Live' : 'Offline'}
            </span>
          </div>
          <button
            onClick={fetchMyTrips}
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

      {/* Trip Selector (if multiple trips) */}
      {activeTrips.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {activeTrips.map((trip) => (
            <button
              key={trip.id}
              onClick={() => setSelectedTrip(trip)}
              className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
                selectedTrip?.id === trip.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
              }`}
            >
              Load #{trip.loadId.slice(-6)}
            </button>
          ))}
        </div>
      )}

      {/* Trip Progress Card */}
      {selectedTrip && selectedTrip.status === 'IN_TRANSIT' && tripProgress && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-900 dark:text-white">Trip Progress</h3>
            {progressLoading && (
              <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            )}
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="flex justify-between text-sm mb-1">
              <span className="text-gray-600 dark:text-gray-400">
                {tripProgress.travelledKm !== null
                  ? `${tripProgress.travelledKm.toFixed(1)} km travelled`
                  : 'In progress'}
              </span>
              <span className="font-medium text-gray-900 dark:text-white">
                {tripProgress.percent}%
              </span>
            </div>
            <div className="h-3 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                style={{ width: `${tripProgress.percent}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Pickup</span>
              <span>
                {tripProgress.remainingKm !== null
                  ? `${tripProgress.remainingKm.toFixed(1)} km remaining`
                  : ''}
              </span>
              <span>Delivery</span>
            </div>
          </div>

          {/* Progress Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{tripProgress.percent}%</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Complete</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {formatDistance(tripProgress.remainingKm)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Remaining</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {formatETA(tripProgress.estimatedArrival)}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">ETA</div>
            </div>
          </div>

          {/* Near Destination Alert */}
          {tripProgress.isNearDestination && (
            <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-sm font-medium text-green-700 dark:text-green-300">
                  Approaching destination!
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Shipment Info Card */}
      {selectedTrip && (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Status</div>
              <div className={`font-semibold ${
                selectedTrip.status === 'IN_TRANSIT' ? 'text-blue-600' :
                selectedTrip.status === 'DELIVERED' ? 'text-green-600' : 'text-gray-600'
              }`}>
                {selectedTrip.status.replace('_', ' ')}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Carrier</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {selectedTrip.carrier.name}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">Truck</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {selectedTrip.truck.plateNumber}
              </div>
            </div>
            <div>
              <div className="text-sm text-gray-500 dark:text-gray-400">ETA</div>
              <div className="font-semibold text-gray-900 dark:text-white">
                {tripProgress?.estimatedArrival
                  ? formatETA(tripProgress.estimatedArrival)
                  : selectedTrip.estimatedArrival || 'Calculating...'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Map */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pickup */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              <span className="font-semibold text-gray-900 dark:text-white">Pickup</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {selectedTrip.pickupLocation?.address || 'Address not available'}
            </p>
          </div>

          {/* Delivery */}
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="font-semibold text-gray-900 dark:text-white">Delivery</span>
            </div>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              {selectedTrip.deliveryLocation?.address || 'Address not available'}
            </p>
          </div>
        </div>
      )}

      {/* GPS Status */}
      {selectedTrip && selectedTrip.status === 'IN_TRANSIT' && (
        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-blue-500 animate-pulse' : 'bg-gray-400'}`}></div>
              <span className="text-sm text-blue-700 dark:text-blue-300">
                {isConnected ? 'Live tracking active' : 'Connecting to live tracking...'}
                {selectedTrip.currentLocation?.updatedAt && (
                  <span className="text-blue-500 dark:text-blue-400 ml-2">
                    - Last update: {new Date(selectedTrip.currentLocation.updatedAt).toLocaleTimeString()}
                  </span>
                )}
              </span>
            </div>
            {tripProgress?.lastUpdate && (
              <span className="text-xs text-blue-500 dark:text-blue-400">
                Progress updated: {new Date(tripProgress.lastUpdate).toLocaleTimeString()}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Access Info */}
      <div className="text-xs text-gray-400 dark:text-gray-500 text-center">
        Map tracking is only available for approved loads with active trips.
        GPS data is provided by the carrier.
      </div>
    </div>
  );
}

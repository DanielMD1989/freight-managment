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
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto animate-pulse">
          <div className="h-8 bg-slate-200 rounded-lg w-1/4 mb-2"></div>
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-6"></div>
          <div className="h-[600px] bg-white rounded-2xl border border-slate-200/60"></div>
        </div>
      </div>
    );
  }

  // No active trips
  if (activeTrips.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-slate-800">Track Shipments</h1>
            <p className="text-slate-500 mt-1">Real-time GPS tracking of your active shipments</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-slate-800 mb-2">
              No Active Shipments
            </h2>
            <p className="text-slate-500 max-w-md mx-auto mb-6">
              You don&apos;t have any active shipments to track. Map tracking becomes available
              when your load is approved and the carrier starts the trip.
            </p>
            <a
              href="/shipper?tab=POST_LOADS"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white text-sm font-medium rounded-xl shadow-md shadow-teal-500/25 hover:shadow-lg hover:shadow-teal-500/30 transition-all"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Post a Load
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Track Shipments</h1>
            <p className="text-slate-500 mt-1">
              Real-time GPS tracking of your active shipments
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* WebSocket Status */}
            <div className="flex items-center gap-2 text-sm bg-white px-3 py-1.5 rounded-full border border-slate-200/60">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
              <span className="text-slate-600">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>
            <button
              onClick={fetchMyTrips}
              className="px-4 py-2 text-sm font-medium text-teal-600 bg-white border border-slate-200/60 rounded-xl hover:bg-teal-50 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700">
            {error}
          </div>
        )}

        {/* Trip Selector (if multiple trips) */}
        {activeTrips.length > 1 && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-1.5 inline-flex gap-1 overflow-x-auto">
            {activeTrips.map((trip) => (
              <button
                key={trip.id}
                onClick={() => setSelectedTrip(trip)}
                className={`px-4 py-2 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${
                  selectedTrip?.id === trip.id
                    ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Load #{trip.loadId.slice(-6)}
              </button>
            ))}
          </div>
        )}

        {/* Trip Progress Card */}
        {selectedTrip && selectedTrip.status === 'IN_TRANSIT' && tripProgress && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="px-6 py-4 bg-gradient-to-r from-slate-50 to-teal-50/30 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-slate-800">Trip Progress</h3>
                <p className="text-sm text-slate-500">Real-time journey tracking</p>
              </div>
              {progressLoading && (
                <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              )}
            </div>
            <div className="p-6">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-slate-500">
                    {tripProgress.travelledKm !== null
                      ? `${tripProgress.travelledKm.toFixed(1)} km travelled`
                      : 'In progress'}
                  </span>
                  <span className="font-semibold text-slate-800">
                    {tripProgress.percent}%
                  </span>
                </div>
                <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-teal-600 to-teal-400 rounded-full transition-all duration-500"
                    style={{ width: `${tripProgress.percent}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-slate-400 mt-2">
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
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <div className="text-2xl font-bold text-teal-600">{tripProgress.percent}%</div>
                  <div className="text-xs text-slate-500 mt-1">Complete</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <div className="text-2xl font-bold text-slate-800">
                    {formatDistance(tripProgress.remainingKm)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Remaining</div>
                </div>
                <div className="text-center p-4 bg-slate-50 rounded-xl">
                  <div className="text-2xl font-bold text-emerald-600">
                    {formatETA(tripProgress.estimatedArrival)}
                  </div>
                  <div className="text-xs text-slate-500 mt-1">ETA</div>
                </div>
              </div>

              {/* Near Destination Alert */}
              {tripProgress.isNearDestination && (
                <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                    <span className="text-sm font-medium text-emerald-700">
                      Approaching destination!
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Shipment Info Card */}
        {selectedTrip && (
          <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <div className="text-sm text-slate-500 mb-1">Status</div>
                <div className={`font-semibold ${
                  selectedTrip.status === 'IN_TRANSIT' ? 'text-teal-600' :
                  selectedTrip.status === 'DELIVERED' ? 'text-emerald-600' : 'text-slate-600'
                }`}>
                  {selectedTrip.status.replace('_', ' ')}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Carrier</div>
                <div className="font-semibold text-slate-800">
                  {selectedTrip.carrier.name}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">Truck</div>
                <div className="font-semibold text-slate-800">
                  {selectedTrip.truck.plateNumber}
                </div>
              </div>
              <div>
                <div className="text-sm text-slate-500 mb-1">ETA</div>
                <div className="font-semibold text-slate-800">
                  {tripProgress?.estimatedArrival
                    ? formatETA(tripProgress.estimatedArrival)
                    : selectedTrip.estimatedArrival || 'Calculating...'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Map */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
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
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                <span className="font-semibold text-slate-800">Pickup</span>
              </div>
              <p className="text-slate-500 text-sm">
                {selectedTrip.pickupLocation?.address || 'Address not available'}
              </p>
            </div>

            {/* Delivery */}
            <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-3 h-3 bg-rose-500 rounded-full"></div>
                <span className="font-semibold text-slate-800">Delivery</span>
              </div>
              <p className="text-slate-500 text-sm">
                {selectedTrip.deliveryLocation?.address || 'Address not available'}
              </p>
            </div>
          </div>
        )}

        {/* GPS Status */}
        {selectedTrip && selectedTrip.status === 'IN_TRANSIT' && (
          <div className="bg-teal-50 p-4 rounded-xl border border-teal-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-teal-500 animate-pulse' : 'bg-slate-400'}`}></div>
                <span className="text-sm text-teal-700">
                  {isConnected ? 'Live tracking active' : 'Connecting to live tracking...'}
                  {selectedTrip.currentLocation?.updatedAt && (
                    <span className="text-teal-600 ml-2">
                      - Last update: {new Date(selectedTrip.currentLocation.updatedAt).toLocaleTimeString()}
                    </span>
                  )}
                </span>
              </div>
              {tripProgress?.lastUpdate && (
                <span className="text-xs text-teal-500">
                  Progress updated: {new Date(tripProgress.lastUpdate).toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Access Info */}
        <div className="text-xs text-slate-400 text-center py-2">
          Map tracking is only available for approved loads with active trips.
          GPS data is provided by the carrier.
        </div>
      </div>
    </div>
  );
}

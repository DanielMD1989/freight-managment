/**
 * Shipper Map Page
 *
 * Track shipment in real-time
 * MAP + GPS Implementation - Epic 4: Shipper Map Access
 *
 * Features:
 * - View active shipment location (only when IN_TRANSIT)
 * - See pickup and delivery markers
 * - Route visualization
 * - Access control: Only after carrier approves load
 */

'use client';

import { useState, useEffect } from 'react';
import GoogleMap, { MapMarker, MapRoute } from '@/components/GoogleMap';

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

  useEffect(() => {
    fetchMyTrips();
  }, []);

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
        data: selectedTrip,
      });
    }

    // Delivery marker
    if (selectedTrip.deliveryLocation) {
      markers.push({
        id: `delivery-${selectedTrip.id}`,
        position: selectedTrip.deliveryLocation,
        title: `Delivery: ${selectedTrip.deliveryLocation.address}`,
        type: 'delivery',
        data: selectedTrip,
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
        data: selectedTrip,
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
      data: selectedTrip,
    }];
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
        <button
          onClick={fetchMyTrips}
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
                {selectedTrip.estimatedArrival || 'Calculating...'}
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
          refreshInterval={15000}
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
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
            <span className="text-sm text-blue-700 dark:text-blue-300">
              Live tracking active
              {selectedTrip.currentLocation?.updatedAt && (
                <span className="text-blue-500 dark:text-blue-400 ml-2">
                  - Last update: {new Date(selectedTrip.currentLocation.updatedAt).toLocaleTimeString()}
                </span>
              )}
            </span>
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

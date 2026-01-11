/**
 * Carrier Map Page
 *
 * Professional fleet overview and real-time trip tracking
 * Design System: Clean & Minimal with Teal accent
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

function StatCard({
  value,
  label,
  color,
  icon,
}: {
  value: number;
  label: string;
  color: 'teal' | 'emerald' | 'amber' | 'rose' | 'slate';
  icon: React.ReactNode;
}) {
  const colorStyles = {
    teal: 'bg-gradient-to-br from-teal-50 to-cyan-50 border-teal-100 text-teal-700',
    emerald: 'bg-gradient-to-br from-emerald-50 to-green-50 border-emerald-100 text-emerald-700',
    amber: 'bg-gradient-to-br from-amber-50 to-yellow-50 border-amber-100 text-amber-700',
    rose: 'bg-gradient-to-br from-rose-50 to-pink-50 border-rose-100 text-rose-700',
    slate: 'bg-gradient-to-br from-slate-50 to-gray-50 border-slate-100 text-slate-600',
  };

  return (
    <div className={`p-4 rounded-xl border ${colorStyles[color]} shadow-sm`}>
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-white/80 flex items-center justify-center shadow-sm">
          {icon}
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs font-medium opacity-70">{label}</div>
        </div>
      </div>
    </div>
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
            <div className="text-sm font-semibold text-slate-800">{vehicle.truckType}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">Capacity</div>
            <div className="text-sm font-semibold text-slate-800">{vehicle.capacity?.toLocaleString()} kg</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">Status</div>
            <div className="text-sm font-semibold text-slate-800">{vehicle.status}</div>
          </div>
          <div className="p-3 rounded-lg bg-slate-50">
            <div className="text-xs font-medium text-slate-500 mb-1">GPS Status</div>
            <div className={`text-sm font-semibold ${
              vehicle.gpsStatus === 'ACTIVE' ? 'text-emerald-600' :
              vehicle.gpsStatus === 'OFFLINE' ? 'text-amber-600' : 'text-slate-400'
            }`}>
              {vehicle.gpsStatus}
            </div>
          </div>
        </div>
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

  const buildMarkers = (): MapMarker[] => {
    const markers: MapMarker[] = [];

    if (viewMode === 'fleet' || viewMode === 'all') {
      vehicles.forEach((vehicle) => {
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
            title: vehicle.plateNumber,
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
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 animate-pulse">
        <div className="max-w-7xl mx-auto">
          <div className="h-8 w-48 bg-slate-200 rounded-lg mb-2" />
          <div className="h-4 w-64 bg-slate-200 rounded mb-8" />
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-20 bg-white rounded-xl border border-slate-200/60" />
            ))}
          </div>
          <div className="h-[600px] bg-white rounded-2xl border border-slate-200/60" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Fleet Map</h1>
            <p className="text-slate-500 mt-1">Track your trucks and shipments in real-time</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white border border-slate-200 shadow-sm">
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
              <span className="text-xs font-medium text-slate-600">{isConnected ? 'Live' : 'Offline'}</span>
            </div>
            <button
              onClick={fetchMapData}
              className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-xl text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-3">
            <svg className="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {error}
          </div>
        )}

        {/* View Mode Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {(['all', 'fleet', 'trips', 'history'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-4 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap transition-all ${
                viewMode === mode
                  ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
                  : 'bg-white text-slate-600 hover:bg-slate-50 border border-slate-200'
              }`}
            >
              {mode === 'all' ? 'All' : mode === 'fleet' ? 'Fleet' : mode === 'trips' ? 'Active Trips' : 'History'}
            </button>
          ))}
        </div>

        {/* Date Range Filter (History view) */}
        {viewMode === 'history' && (
          <div className="mb-6 p-4 bg-white rounded-xl border border-slate-200/60 shadow-sm">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">From:</label>
                <input
                  type="date"
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-slate-600">To:</label>
                <input
                  type="date"
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                  className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 outline-none transition-all"
                />
              </div>
              <button
                onClick={fetchMapData}
                className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-teal-600 to-teal-500 rounded-lg hover:from-teal-700 hover:to-teal-600 transition-all shadow-sm"
              >
                Apply Filter
              </button>
            </div>
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
          <StatCard
            value={stats.total}
            label="Total Trucks"
            color="slate"
            icon={<svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" /></svg>}
          />
          <StatCard
            value={stats.active}
            label="GPS Active"
            color="emerald"
            icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.636 18.364a9 9 0 010-12.728m12.728 0a9 9 0 010 12.728m-9.9-2.829a5 5 0 010-7.07m7.072 0a5 5 0 010 7.07M13 12a1 1 0 11-2 0 1 1 0 012 0z" /></svg>}
          />
          <StatCard
            value={stats.offline}
            label="GPS Offline"
            color="amber"
            icon={<svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" /></svg>}
          />
          <StatCard
            value={stats.noDevice}
            label="No GPS"
            color="slate"
            icon={<svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" /></svg>}
          />
          <StatCard
            value={activeTrips.length}
            label="Active Trips"
            color="teal"
            icon={<svg className="w-5 h-5 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>}
          />
          <StatCard
            value={stats.available}
            label="Available"
            color="emerald"
            icon={<svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
          />
        </div>

        {/* Map Container */}
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
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
          <div className="mt-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-800">{selectedItem.title}</h3>
              <button
                onClick={() => setSelectedItem(null)}
                className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex items-center justify-center transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <SelectedItemDetails
                selectedItem={selectedItem}
                viewMode={viewMode}
                formatDate={formatDate}
                onViewPlayback={setSelectedHistoricalTripId}
              />
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 bg-white rounded-2xl border border-slate-200/60 shadow-sm p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Map Legend</h3>
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded-full shadow-sm" />
              <span className="text-sm text-slate-600">GPS Active</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-teal-500 rounded-full shadow-sm" />
              <span className="text-sm text-slate-600">In Transit</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-amber-500 rounded-full shadow-sm" />
              <span className="text-sm text-slate-600">GPS Offline</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-slate-300 rounded-full shadow-sm" />
              <span className="text-sm text-slate-600">No GPS Device</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-emerald-500 rounded shadow-sm" />
              <span className="text-sm text-slate-600">Pickup Point</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-rose-500 rounded shadow-sm" />
              <span className="text-sm text-slate-600">Delivery Point</span>
            </div>
          </div>
        </div>
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

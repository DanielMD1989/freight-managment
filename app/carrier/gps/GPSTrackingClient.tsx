'use client';

/**
 * GPS Tracking Client Component
 *
 * Interactive GPS tracking with auto-refresh for real-time updates.
 * Sprint 12 - Story 12.5: GPS Tracking
 */

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

interface TruckWithGPS {
  id: string;
  licensePlate: string;
  truckType: string;
  isAvailable: boolean;
  currentCity: string | null;
  gpsDevice: {
    id: string;
    imei: string;
    status: string;
    lastSeenAt: string;
  } | null;
}

interface GPSTrackingClientProps {
  initialTrucks: TruckWithGPS[];
}

const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

function formatDateTime(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getLastSeenStatus(lastSeenAt: string): {
  color: string;
  text: string;
  bgColor: string;
} {
  const now = new Date();
  const lastSeen = new Date(lastSeenAt);
  const minutesAgo = (now.getTime() - lastSeen.getTime()) / (1000 * 60);

  if (minutesAgo < 10) {
    return { color: 'text-green-600', bgColor: 'bg-green-100', text: 'Active' };
  } else if (minutesAgo < 60) {
    return { color: 'text-yellow-600', bgColor: 'bg-yellow-100', text: `${Math.round(minutesAgo)}m ago` };
  } else if (minutesAgo < 1440) {
    return {
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      text: `${Math.round(minutesAgo / 60)}h ago`,
    };
  } else {
    return {
      color: 'text-red-600',
      bgColor: 'bg-red-100',
      text: `${Math.round(minutesAgo / 1440)}d ago`,
    };
  }
}

export default function GPSTrackingClient({ initialTrucks }: GPSTrackingClientProps) {
  const [trucks, setTrucks] = useState<TruckWithGPS[]>(initialTrucks);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const trucksWithGPS = trucks.filter((truck) => truck.gpsDevice !== null);
  const trucksWithoutGPS = trucks.filter((truck) => truck.gpsDevice === null);

  const refreshData = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const response = await fetch('/api/carrier/gps');
      if (response.ok) {
        const data = await response.json();
        setTrucks(data.trucks || []);
        setLastRefresh(new Date());
      }
    } catch (error) {
      console.error('Failed to refresh GPS data:', error);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  // Auto-refresh effect
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(refreshData, AUTO_REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [autoRefresh, refreshData]);

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">GPS Tracking</h1>
          <p className="text-gray-600 mt-2">
            Monitor your fleet in real-time with GPS tracking
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-500">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </label>
          <button
            onClick={refreshData}
            disabled={isRefreshing}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {isRefreshing ? (
              <>
                <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Refreshing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh Now
              </>
            )}
          </button>
        </div>
      </div>

      {/* Auto-refresh indicator */}
      {autoRefresh && (
        <div className="mb-4 flex items-center gap-2 text-sm text-gray-500">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          Auto-refreshing every 30 seconds
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">Total Trucks</div>
          <div className="text-3xl font-bold text-gray-900">{trucks.length}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">GPS Enabled</div>
          <div className="text-3xl font-bold text-green-600">
            {trucksWithGPS.length}
          </div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-sm text-gray-600 mb-2">No GPS</div>
          <div className="text-3xl font-bold text-gray-600">
            {trucksWithoutGPS.length}
          </div>
        </div>
      </div>

      {/* Trucks with GPS */}
      {trucksWithGPS.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Tracked Trucks ({trucksWithGPS.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {trucksWithGPS.map((truck) => {
              const lastSeenStatus = truck.gpsDevice
                ? getLastSeenStatus(truck.gpsDevice.lastSeenAt)
                : null;

              return (
                <div key={truck.id} className="p-6 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-1">
                        {truck.licensePlate}
                      </h3>
                      <div className="text-sm text-gray-600">
                        {truck.truckType.replace(/_/g, ' ')}
                      </div>
                    </div>
                    {lastSeenStatus && (
                      <div className={`px-3 py-1 rounded-full text-sm font-medium ${lastSeenStatus.bgColor} ${lastSeenStatus.color}`}>
                        {lastSeenStatus.text}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">GPS Device</div>
                      <div className="text-sm font-medium text-gray-900">
                        {truck.gpsDevice?.imei}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Status</div>
                      <div className="text-sm font-medium text-gray-900">
                        {truck.gpsDevice?.status}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Last Location</div>
                      <div className="text-sm font-medium text-gray-900">
                        {truck.currentCity || 'Unknown'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Availability</div>
                      <div className={`text-sm font-medium ${truck.isAvailable ? 'text-green-600' : 'text-orange-600'}`}>
                        {truck.isAvailable ? 'Available' : 'In Use'}
                      </div>
                    </div>
                  </div>

                  {truck.gpsDevice && (
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-500">
                        Last update: {formatDateTime(truck.gpsDevice.lastSeenAt)}
                      </div>
                      <Link
                        href={`/carrier/map?truckId=${truck.id}`}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View on Map
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Trucks without GPS */}
      {trucksWithoutGPS.length > 0 && (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">
              Trucks Without GPS ({trucksWithoutGPS.length})
            </h2>
          </div>

          <div className="divide-y divide-gray-200">
            {trucksWithoutGPS.map((truck) => (
              <div key={truck.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                      {truck.licensePlate}
                    </h3>
                    <div className="text-sm text-gray-600">
                      {truck.truckType.replace(/_/g, ' ')}
                    </div>
                  </div>
                  <div className="text-sm text-gray-500">No GPS device assigned</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* No Trucks */}
      {trucks.length === 0 && (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">🗺️</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Trucks Yet
          </h3>
          <p className="text-gray-600 mb-6">
            Add trucks to your fleet to start tracking them with GPS.
          </p>
          <Link
            href="/carrier/trucks/add"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Add Your First Truck
          </Link>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="font-semibold text-blue-900 mb-2">
          About GPS Tracking
        </h3>
        <ul className="space-y-2 text-sm text-blue-800">
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              GPS devices must be installed and activated on your trucks
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Location updates are received every 5-10 minutes when the truck
              is moving
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              This page auto-refreshes every 30 seconds for real-time status
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span>•</span>
            <span>
              Contact support to register new GPS devices or troubleshoot
              connectivity
            </span>
          </li>
        </ul>
      </div>
    </div>
  );
}

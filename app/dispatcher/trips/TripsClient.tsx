/**
 * Dispatcher Trips Client Component
 *
 * Full-page view of all active trips for dispatchers
 * Features: Status filters, GPS status, map links
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// L4 FIX: Use constant for page size
const TRIPS_PAGE_SIZE = 20;

interface Trip {
  id: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  trackingEnabled: boolean;
  trackingUrl: string | null;
  currentLat: number | null;
  currentLng: number | null;
  lastLocationUpdate: string | null;
  createdAt: string;
  estimatedDistanceKm: number | null;
  load?: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    cargoDescription: string;
    weight: number;
    truckType: string;
    pickupDate: string;
    deliveryDate: string;
  };
  truck?: {
    id: string;
    licensePlate: string;
    truckType: string;
    contactName: string;
    contactPhone: string;
  };
  carrier?: {
    id: string;
    name: string;
    isVerified: boolean;
  };
  shipper?: {
    id: string;
    name: string;
  };
}

// All TripStatus values from Prisma schema + 'ALL' for filter
type StatusFilter = 'ALL' | 'ASSIGNED' | 'PICKUP_PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED' | 'CANCELLED';

export default function TripsClient() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination - L4 FIX: Use constant
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = TRIPS_PAGE_SIZE;

  // L5 FIX: Wrap in useCallback with proper dependencies
  const fetchTrips = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }

      // M3 FIX: Add server-side search parameter
      if (searchQuery.trim()) {
        params.append('search', searchQuery.trim());
      }

      const response = await fetch(`/api/trips?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch trips');
      }

      const data = await response.json();
      setTrips(data.trips || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.totalPages || 1);
    // H4 FIX: Use unknown type with type guard
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch trips';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [page, limit, statusFilter, searchQuery]);

  // M3 FIX: Add searchQuery to dependencies for server-side search
  // L5 FIX: Include fetchTrips in dependency array
  useEffect(() => {
    // Debounce search to avoid excessive API calls
    const timeoutId = setTimeout(() => {
      fetchTrips();
    }, searchQuery ? 300 : 0);
    return () => clearTimeout(timeoutId);
  }, [fetchTrips, searchQuery]);

  // M3 FIX: Server-side search means we use trips directly
  const filteredTrips = trips;

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ASSIGNED: 'bg-amber-100 text-amber-700',
      PICKUP_PENDING: 'bg-blue-100 text-blue-700',
      IN_TRANSIT: 'bg-teal-100 text-teal-700',
      DELIVERY_PENDING: 'bg-purple-100 text-purple-700',
      DELIVERED: 'bg-emerald-100 text-emerald-700',
      COMPLETED: 'bg-slate-100 text-slate-700',
      CANCELLED: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-600';
  };

  const getGpsStatus = (trip: Trip) => {
    if (!trip.trackingEnabled) {
      return <span className="text-xs text-slate-400">Disabled</span>;
    }

    if (trip.lastLocationUpdate) {
      const lastUpdate = new Date(trip.lastLocationUpdate);
      const minutesAgo = Math.floor((Date.now() - lastUpdate.getTime()) / 60000);

      if (minutesAgo < 5) {
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
        );
      } else if (minutesAgo < 60) {
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-amber-600">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            {minutesAgo}m ago
          </span>
        );
      } else {
        return (
          <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            Stale
          </span>
        );
      }
    }

    return <span className="text-xs text-slate-400">No data</span>;
  };

  // All TripStatus values so dispatchers can see complete trip history
  const statusTabs: { value: StatusFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'PICKUP_PENDING', label: 'Pickup' },
    { value: 'IN_TRANSIT', label: 'In Transit' },
    { value: 'DELIVERED', label: 'Delivered' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'CANCELLED', label: 'Cancelled' },
  ];

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Status Tabs */}
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {statusTabs.map((tab) => (
              <button
                key={tab.value}
                onClick={() => {
                  setStatusFilter(tab.value);
                  setPage(1);
                }}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  statusFilter === tab.value
                    ? 'bg-white text-slate-800 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search trips..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
              />
            </div>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchTrips}
            disabled={loading}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 transition-colors flex items-center gap-2"
          >
            <svg className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Results Summary */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Showing {filteredTrips.length} of {total} trips
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            <p className="mt-3 text-sm text-slate-500">Loading trips...</p>
          </div>
        ) : filteredTrips.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No Active Trips</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
              {statusFilter !== 'ALL'
                ? `No ${statusFilter.replace('_', ' ').toLowerCase()} trips at this time.`
                : 'There are no trips currently in progress. Trips will appear here once loads are picked up.'}
            </p>
            <div className="mt-4 flex items-center justify-center gap-3">
              <button
                onClick={fetchTrips}
                className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Refresh
              </button>
              <Link
                href="/dispatcher/map"
                className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                View Map
              </Link>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Trip ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Truck</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Carrier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Shipper</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">GPS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTrips.map((trip) => (
                  <tr key={trip.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-slate-700">
                        {trip.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {trip.pickupCity || trip.load?.pickupCity} → {trip.deliveryCity || trip.load?.deliveryCity}
                        </p>
                        <p className="text-xs text-slate-500">
                          {trip.estimatedDistanceKm ? `${trip.estimatedDistanceKm} km` : 'Distance N/A'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {trip.truck?.licensePlate || 'N/A'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {trip.truck?.truckType?.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">
                        {trip.carrier?.name || 'Unknown'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">
                        {trip.shipper?.name || 'Unknown'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadge(trip.status)}`}>
                        {trip.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getGpsStatus(trip)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {trip.load?.id && (
                          <Link
                            href={`/dispatcher/loads/${trip.load.id}`}
                            className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                          >
                            Details
                          </Link>
                        )}
                        {(trip.status === 'IN_TRANSIT' || trip.status === 'PICKUP_PENDING') && trip.trackingEnabled && (
                          <Link
                            href={`/dispatcher/map?tripId=${trip.id}`}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                          >
                            View Map
                          </Link>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

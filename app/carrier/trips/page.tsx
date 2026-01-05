/**
 * Carrier Trip History Page
 *
 * MAP + GPS Implementation - Phase 4
 *
 * Features:
 * - List of completed and active trips
 * - Trip details with route playback
 * - Filter by status, date range
 */

'use client';

import { useState, useEffect } from 'react';
import TripHistoryPlayback from '@/components/TripHistoryPlayback';

interface Trip {
  id: string;
  loadId: string;
  referenceNumber: string;
  status: string;
  truck: {
    id: string;
    licensePlate: string;
  };
  pickupCity: string;
  deliveryCity: string;
  pickupDate?: string;
  deliveryDate?: string;
  startedAt?: string;
  completedAt?: string;
  shipper?: {
    name: string;
  };
  distance?: number;
}

type StatusFilter = 'ALL' | 'IN_TRANSIT' | 'DELIVERED' | 'COMPLETED';

export default function CarrierTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrips();
  }, [statusFilter]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') {
        params.set('status', statusFilter);
      }
      params.set('myTrips', 'true');

      const response = await fetch(`/api/loads?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch trips');
      }

      const data = await response.json();
      setTrips(data.loads || []);
    } catch (err) {
      console.error('Error fetching trips:', err);
      setError('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string }> = {
      PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200' },
      IN_TRANSIT: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200' },
      DELIVERED: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200' },
      COMPLETED: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-200' },
    };

    const config = statusConfig[status] || statusConfig.PENDING;

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {status.replace('_', ' ')}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Trip History</h1>
          <p className="text-gray-500 dark:text-gray-400">
            View and replay your completed trips
          </p>
        </div>
        <button
          onClick={fetchTrips}
          className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        {(['ALL', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              statusFilter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300'
            }`}
          >
            {status === 'ALL' ? 'All Trips' : status.replace('_', ' ')}
          </button>
        ))}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Trip Playback Modal */}
      {selectedTripId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-4xl">
            <TripHistoryPlayback
              tripId={selectedTripId}
              height="600px"
              onClose={() => setSelectedTripId(null)}
            />
          </div>
        </div>
      )}

      {/* Trips Table */}
      {loading ? (
        <div className="animate-pulse space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-16 bg-gray-200 dark:bg-slate-700 rounded-lg"></div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 dark:bg-slate-800 rounded-lg">
          <p className="text-gray-500 dark:text-gray-400">No trips found</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Reference
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Truck
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {trips.map((trip) => (
                <tr key={trip.id} className="hover:bg-gray-50 dark:hover:bg-slate-700">
                  <td className="px-4 py-4">
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {trip.referenceNumber}
                    </div>
                    {trip.shipper && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {trip.shipper.name}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {trip.truck?.licensePlate || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {trip.pickupCity} → {trip.deliveryCity}
                    </div>
                    {trip.distance && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {trip.distance} km
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs text-gray-900 dark:text-white">
                      Pickup: {formatDate(trip.pickupDate || trip.startedAt)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Delivery: {formatDate(trip.deliveryDate || trip.completedAt)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(trip.status)}
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      {(trip.status === 'DELIVERED' || trip.status === 'COMPLETED') && (
                        <button
                          onClick={() => setSelectedTripId(trip.loadId)}
                          className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
                        >
                          Replay Route
                        </button>
                      )}
                      {trip.status === 'IN_TRANSIT' && (
                        <button
                          onClick={() => window.location.href = `/carrier/map?tripId=${trip.loadId}`}
                          className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100"
                        >
                          Track Live
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {trips.length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Trips</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-blue-600">
            {trips.filter((t) => t.status === 'IN_TRANSIT').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">In Transit</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-green-600">
            {trips.filter((t) => t.status === 'DELIVERED' || t.status === 'COMPLETED').length}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {trips.reduce((sum, t) => sum + (t.distance || 0), 0).toFixed(0)} km
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Distance</div>
        </div>
      </div>
    </div>
  );
}

/**
 * Carrier Trips Page
 *
 * Sprint 18 - Story 18.2: Carrier manages trips by status
 *
 * Features:
 * - Tabs: Approved Loads | Active Trips | Completed Trips
 * - Trip actions: Start Trip, Confirm Pickup, End Trip
 * - Route playback for completed trips
 * - Live tracking for in-transit trips
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import TripHistoryPlayback from '@/components/TripHistoryPlayback';
import { csrfFetch } from '@/lib/csrfFetch';

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
  shipperContactName?: string;
  shipperContactPhone?: string;
  distance?: number;
  weight?: number;
  truckType?: string;
  rate?: number;
}

type TabType = 'approved' | 'active' | 'completed';

const TAB_CONFIG = {
  approved: {
    label: 'Approved Loads',
    statuses: ['ASSIGNED'],
    emptyMessage: 'No approved loads waiting to start. When shippers approve your load requests, they will appear here.',
  },
  active: {
    label: 'Active Trips',
    statuses: ['PICKUP_PENDING', 'IN_TRANSIT'],
    emptyMessage: 'No active trips. Start a trip from Approved Loads to see it here.',
  },
  completed: {
    label: 'Completed Trips',
    statuses: ['DELIVERED', 'COMPLETED'],
    emptyMessage: 'No completed trips yet. Complete your first delivery to see trip history.',
  },
};

export default function CarrierTripsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabType) || 'approved';

  const [activeTab, setActiveTab] = useState<TabType>(initialTab);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  useEffect(() => {
    fetchTrips();
  }, [activeTab]);

  useEffect(() => {
    const tab = searchParams.get('tab') as TabType;
    if (tab && TAB_CONFIG[tab]) {
      setActiveTab(tab);
    }
  }, [searchParams]);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      setError(null);

      const statuses = TAB_CONFIG[activeTab].statuses;
      const params = new URLSearchParams();
      params.set('myTrips', 'true');

      // For multiple statuses, we need to fetch all and filter client-side
      // or make multiple requests - for simplicity, fetch all assigned trips
      if (activeTab === 'active') {
        // Fetch both PICKUP_PENDING and IN_TRANSIT
        params.set('status', 'PICKUP_PENDING,IN_TRANSIT');
      } else {
        params.set('status', statuses.join(','));
      }

      const response = await fetch(`/api/loads?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch trips');
      }

      const data = await response.json();
      // Filter by exact statuses in case API doesn't support comma-separated
      const filteredTrips = (data.loads || []).filter((t: Trip) =>
        statuses.includes(t.status)
      );
      setTrips(filteredTrips);
    } catch (err) {
      console.error('Error fetching trips:', err);
      setError('Failed to load trips');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (loadId: string, newStatus: string) => {
    setActionLoading(loadId);
    setError(null);

    try {
      const response = await csrfFetch(`/api/loads/${loadId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update status');
      }

      // Refresh trips after status change
      await fetchTrips();

      // If trip moved to a different tab, switch to that tab
      if (newStatus === 'PICKUP_PENDING' || newStatus === 'IN_TRANSIT') {
        setActiveTab('active');
        router.push('/carrier/trips?tab=active');
      } else if (newStatus === 'DELIVERED') {
        setActiveTab('completed');
        router.push('/carrier/trips?tab=completed');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setActionLoading(null);
    }
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    router.push(`/carrier/trips?tab=${tab}`);
  };

  const handleViewDetails = (loadId: string) => {
    router.push(`/carrier/trips/${loadId}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString();
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; label: string }> = {
      ASSIGNED: { bg: 'bg-teal-100 dark:bg-teal-900', text: 'text-teal-800 dark:text-teal-200', label: 'Ready to Start' },
      PICKUP_PENDING: { bg: 'bg-yellow-100 dark:bg-yellow-900', text: 'text-yellow-800 dark:text-yellow-200', label: 'Pickup Pending' },
      IN_TRANSIT: { bg: 'bg-blue-100 dark:bg-blue-900', text: 'text-blue-800 dark:text-blue-200', label: 'In Transit' },
      DELIVERED: { bg: 'bg-green-100 dark:bg-green-900', text: 'text-green-800 dark:text-green-200', label: 'Delivered' },
      COMPLETED: { bg: 'bg-gray-100 dark:bg-gray-800', text: 'text-gray-800 dark:text-gray-200', label: 'Completed' },
    };

    const config = statusConfig[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };

    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${config.bg} ${config.text}`}>
        {config.label}
      </span>
    );
  };

  const getActionButton = (trip: Trip) => {
    const isLoading = actionLoading === trip.id;

    switch (trip.status) {
      case 'ASSIGNED':
        return (
          <button
            onClick={() => handleStatusChange(trip.id, 'PICKUP_PENDING')}
            disabled={isLoading}
            className="px-3 py-1 text-xs font-medium text-white bg-[#1e9c99] rounded hover:bg-[#064d51] disabled:opacity-50"
          >
            {isLoading ? 'Starting...' : 'Start Trip'}
          </button>
        );
      case 'PICKUP_PENDING':
        return (
          <button
            onClick={() => handleStatusChange(trip.id, 'IN_TRANSIT')}
            disabled={isLoading}
            className="px-3 py-1 text-xs font-medium text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? 'Confirming...' : 'Confirm Pickup'}
          </button>
        );
      case 'IN_TRANSIT':
        return (
          <div className="flex gap-2">
            <button
              onClick={() => window.location.href = `/carrier/map?tripId=${trip.loadId || trip.id}`}
              className="px-3 py-1 text-xs font-medium text-green-600 bg-green-50 rounded hover:bg-green-100"
            >
              Track Live
            </button>
            <button
              onClick={() => handleStatusChange(trip.id, 'DELIVERED')}
              disabled={isLoading}
              className="px-3 py-1 text-xs font-medium text-white bg-orange-600 rounded hover:bg-orange-700 disabled:opacity-50"
            >
              {isLoading ? 'Ending...' : 'End Trip'}
            </button>
          </div>
        );
      case 'DELIVERED':
        return (
          <button
            onClick={() => handleViewDetails(trip.id)}
            className="px-3 py-1 text-xs font-medium text-purple-600 bg-purple-50 rounded hover:bg-purple-100"
          >
            Upload POD
          </button>
        );
      case 'COMPLETED':
        return (
          <button
            onClick={() => setSelectedTripId(trip.loadId || trip.id)}
            className="px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded hover:bg-blue-100"
          >
            Replay Route
          </button>
        );
      default:
        return null;
    }
  };

  // Calculate counts for each tab
  const [allTrips, setAllTrips] = useState<Trip[]>([]);

  useEffect(() => {
    const fetchAllCounts = async () => {
      try {
        const response = await fetch('/api/loads?myTrips=true');
        if (response.ok) {
          const data = await response.json();
          setAllTrips(data.loads || []);
        }
      } catch (err) {
        console.error('Error fetching counts:', err);
      }
    };
    fetchAllCounts();
  }, []);

  const tabCounts = {
    approved: allTrips.filter(t => TAB_CONFIG.approved.statuses.includes(t.status)).length,
    active: allTrips.filter(t => TAB_CONFIG.active.statuses.includes(t.status)).length,
    completed: allTrips.filter(t => TAB_CONFIG.completed.statuses.includes(t.status)).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Trips</h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your load assignments and active deliveries
          </p>
        </div>
        <button
          onClick={fetchTrips}
          className="px-4 py-2 text-sm font-medium text-[#1e9c99] bg-[#1e9c99]/10 rounded-lg hover:bg-[#1e9c99]/20"
        >
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-slate-700">
        <nav className="flex gap-4">
          {(Object.keys(TAB_CONFIG) as TabType[]).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab
                  ? 'border-[#1e9c99] text-[#1e9c99]'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {TAB_CONFIG[tab].label}
              {tabCounts[tab] > 0 && (
                <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                  activeTab === tab
                    ? 'bg-[#1e9c99] text-white'
                    : 'bg-gray-200 dark:bg-slate-600 text-gray-600 dark:text-gray-300'
                }`}>
                  {tabCounts[tab]}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
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
          <div className="text-4xl mb-4">
            {activeTab === 'approved' ? '✅' : activeTab === 'active' ? '🚚' : '📜'}
          </div>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
            {TAB_CONFIG[activeTab].emptyMessage}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Load
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Route
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Truck
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
                <tr
                  key={trip.id}
                  className="hover:bg-gray-50 dark:hover:bg-slate-700 cursor-pointer"
                  onClick={() => handleViewDetails(trip.id)}
                >
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
                      {trip.pickupCity} → {trip.deliveryCity}
                    </div>
                    {trip.distance && (
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {trip.distance} km
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-sm text-gray-900 dark:text-white">
                      {trip.truck?.licensePlate || '-'}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="text-xs text-gray-900 dark:text-white">
                      Pickup: {formatDate(trip.pickupDate)}
                    </div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Delivery: {formatDate(trip.deliveryDate)}
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    {getStatusBadge(trip.status)}
                  </td>
                  <td className="px-4 py-4" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-2">
                      {getActionButton(trip)}
                      <button
                        onClick={() => handleViewDetails(trip.id)}
                        className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded hover:bg-gray-200 dark:bg-slate-600 dark:text-gray-300"
                      >
                        Details
                      </button>
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
          <div className="text-2xl font-bold text-[#1e9c99]">
            {tabCounts.approved}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Ready to Start</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-blue-600">
            {tabCounts.active}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Active Trips</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-green-600">
            {tabCounts.completed}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Completed</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-lg border border-gray-200 dark:border-slate-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {allTrips.reduce((sum, t) => sum + (t.distance || 0), 0).toFixed(0)} km
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total Distance</div>
        </div>
      </div>
    </div>
  );
}

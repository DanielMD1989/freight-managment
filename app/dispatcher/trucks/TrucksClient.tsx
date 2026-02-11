/**
 * Dispatcher Trucks Client Component
 *
 * Full-page view of all truck postings for dispatchers
 * Features: Search, filters, pagination, "Find Loads" action
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import FindMatchesModal from '@/components/dispatcher/FindMatchesModal';

interface TruckPosting {
  id: string;
  status: string;
  availableFrom: string;
  availableTo: string;
  originCity?: { id: string; name: string };
  destinationCity?: { id: string; name: string };
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
    gpsStatus?: string;
    carrier?: {
      id: string;
      name: string;
    };
  };
  carrier?: {
    id: string;
    name: string;
  };
}

type StatusFilter = 'ALL' | 'ACTIVE' | 'EXPIRED' | 'MATCHED';

export default function TrucksClient() {
  const [postings, setPostings] = useState<TruckPosting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ACTIVE');
  const [searchQuery, setSearchQuery] = useState('');
  const [truckTypeFilter, setTruckTypeFilter] = useState('');

  // Pagination
  const [offset, setOffset] = useState(0);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Find Loads Modal
  const [showFindLoads, setShowFindLoads] = useState(false);
  const [selectedPosting, setSelectedPosting] = useState<TruckPosting | null>(null);

  const fetchPostings = async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (statusFilter !== 'ALL') {
        params.append('status', statusFilter);
      }
      if (searchQuery) {
        params.append('origin', searchQuery);
      }
      if (truckTypeFilter) {
        params.append('truckType', truckTypeFilter);
      }

      const response = await fetch(`/api/truck-postings?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch truck postings');
      }

      const data = await response.json();
      setPostings(data.postings || []);
      setTotal(data.total || 0);
    // H3 FIX: Use unknown type with type guard
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to fetch truck postings';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPostings();
  }, [offset, statusFilter, truckTypeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setOffset(0);
      fetchPostings();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleFindLoads = (posting: TruckPosting) => {
    setSelectedPosting(posting);
    setShowFindLoads(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: 'bg-emerald-100 text-emerald-700',
      EXPIRED: 'bg-slate-100 text-slate-600',
      CANCELLED: 'bg-red-100 text-red-700',
      MATCHED: 'bg-blue-100 text-blue-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-600';
  };

  const getGpsStatus = (status?: string) => {
    if (status === 'ACTIVE') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs text-emerald-600">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      );
    }
    return <span className="text-xs text-slate-400">No GPS</span>;
  };

  const truckTypes = [
    'DRY_BOX', 'REFRIGERATED', 'FLATBED', 'TANKER', 'CONTAINER',
    'LIVESTOCK', 'CAR_CARRIER', 'LOWBOY', 'DUMP_TRUCK', 'OPEN_TRUCK',
  ];

  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.ceil(total / limit);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-4">
        <div className="flex flex-wrap gap-4 items-end">
          {/* Search */}
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Search by City
            </label>
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search origin city..."
                className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-sm"
              />
            </div>
          </div>

          {/* Status Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as StatusFilter);
                setOffset(0);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="MATCHED">Matched</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          {/* Truck Type Filter */}
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1.5">
              Truck Type
            </label>
            <select
              value={truckTypeFilter}
              onChange={(e) => {
                setTruckTypeFilter(e.target.value);
                setOffset(0);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="">All Types</option>
              {truckTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, ' ')}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={fetchPostings}
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
          Showing {postings.length} of {total} truck postings
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            <p className="mt-3 text-sm text-slate-500">Loading trucks...</p>
          </div>
        ) : postings.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-gradient-to-br from-teal-100 to-teal-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No Available Trucks</h3>
            <p className="text-slate-500 text-sm mt-1 max-w-md mx-auto">
              {truckTypeFilter || searchQuery
                ? 'No trucks match your current filters. Try broadening your search criteria.'
                : 'No carriers have posted available trucks at this time.'}
            </p>
            <button
              onClick={fetchPostings}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Refresh
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Truck</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Type / Capacity</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Available</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Carrier</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">GPS</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {postings.map((posting) => (
                  <tr key={posting.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-slate-800">
                        {posting.truck?.licensePlate || 'N/A'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-700">
                          {posting.truck?.truckType?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-xs text-slate-500">
                          {posting.truck?.capacity?.toLocaleString()} kg
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm text-slate-700">
                        {posting.originCity?.name || 'Any'} → {posting.destinationCity?.name || 'Any'}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm text-slate-700">
                        <p>{new Date(posting.availableFrom).toLocaleDateString()}</p>
                        <p className="text-xs text-slate-500">
                          to {new Date(posting.availableTo).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {posting.carrier?.name || posting.truck?.carrier?.name || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {getGpsStatus(posting.truck?.gpsStatus)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadge(posting.status)}`}>
                        {posting.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/dispatcher/trucks/${posting.truck?.id || posting.id}`}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          View
                        </Link>
                        {posting.status === 'ACTIVE' && (
                          <button
                            onClick={() => handleFindLoads(posting)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                          >
                            Find Loads
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
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setOffset(Math.max(0, offset - limit))}
              disabled={offset === 0}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setOffset(offset + limit)}
              disabled={page >= totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Find Loads Modal */}
      {selectedPosting && (
        <FindMatchesModal
          isOpen={showFindLoads}
          onClose={() => {
            setShowFindLoads(false);
            setSelectedPosting(null);
          }}
          type="loads"
          truckPostingId={selectedPosting.id}
          truckId={selectedPosting.truck?.id}
          truckDetails={{
            licensePlate: selectedPosting.truck?.licensePlate || 'N/A',
            truckType: selectedPosting.truck?.truckType || 'N/A',
            originCity: selectedPosting.originCity?.name || 'Any',
            destinationCity: selectedPosting.destinationCity?.name || 'Any',
          }}
          onProposalCreated={fetchPostings}
        />
      )}
    </div>
  );
}

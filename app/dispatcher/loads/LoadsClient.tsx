/**
 * Dispatcher Loads Client Component
 *
 * Full-page view of all posted loads for dispatchers
 * Features: Search, filters, pagination, "Find Trucks" action
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import FindMatchesModal from '@/components/dispatcher/FindMatchesModal';

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  weight: number;
  truckType: string;
  cargoDescription: string;
  pickupDate: string;
  deliveryDate: string;
  status: string;
  rate: number;
  currency: string;
  shipper?: {
    id: string;
    name: string;
  };
}

type StatusFilter = 'ALL' | 'POSTED' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED';

export default function LoadsClient() {
  const [loads, setLoads] = useState<Load[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('POSTED');
  const [searchQuery, setSearchQuery] = useState('');
  const [truckTypeFilter, setTruckTypeFilter] = useState('');

  // Pagination
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  // Find Trucks Modal
  const [showFindTrucks, setShowFindTrucks] = useState(false);
  const [selectedLoad, setSelectedLoad] = useState<Load | null>(null);

  const fetchLoads = async () => {
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
      if (searchQuery) {
        params.append('pickupCity', searchQuery);
      }
      if (truckTypeFilter) {
        params.append('truckType', truckTypeFilter);
      }

      const response = await fetch(`/api/loads?${params.toString()}`);

      if (!response.ok) {
        throw new Error('Failed to fetch loads');
      }

      const data = await response.json();
      setLoads(data.loads || []);
      setTotal(data.pagination?.total || data.loads?.length || 0);
      setTotalPages(data.pagination?.totalPages || Math.ceil((data.pagination?.total || 0) / limit));
    } catch (err: any) {
      setError(err.message || 'Failed to fetch loads');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoads();
  }, [page, statusFilter, truckTypeFilter]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchLoads();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleFindTrucks = (load: Load) => {
    setSelectedLoad(load);
    setShowFindTrucks(true);
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      DRAFT: 'bg-slate-100 text-slate-600',
      POSTED: 'bg-blue-100 text-blue-700',
      ASSIGNED: 'bg-amber-100 text-amber-700',
      IN_TRANSIT: 'bg-teal-100 text-teal-700',
      DELIVERED: 'bg-emerald-100 text-emerald-700',
      CANCELLED: 'bg-red-100 text-red-700',
    };
    return styles[status] || 'bg-slate-100 text-slate-600';
  };

  const truckTypes = [
    'DRY_BOX', 'REFRIGERATED', 'FLATBED', 'TANKER', 'CONTAINER',
    'LIVESTOCK', 'CAR_CARRIER', 'LOWBOY', 'DUMP_TRUCK', 'OPEN_TRUCK',
  ];

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
                placeholder="Search origin/destination..."
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
                setPage(1);
              }}
              className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-teal-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="POSTED">Posted</option>
              <option value="ASSIGNED">Assigned</option>
              <option value="IN_TRANSIT">In Transit</option>
              <option value="DELIVERED">Delivered</option>
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
                setPage(1);
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
            onClick={fetchLoads}
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
          Showing {loads.length} of {total} loads
        </p>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
            <p className="mt-3 text-sm text-slate-500">Loading loads...</p>
          </div>
        ) : loads.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800">No Loads Found</h3>
            <p className="text-slate-500 text-sm mt-1">Try adjusting your filters</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Load ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Route</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Cargo</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Truck Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Pickup Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loads.map((load) => (
                  <tr key={load.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="text-sm font-mono text-slate-700">
                        {load.id.slice(0, 8)}...
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-slate-800">
                          {load.pickupCity} → {load.deliveryCity}
                        </p>
                        <p className="text-xs text-slate-500">
                          {load.shipper?.name || 'Unknown shipper'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm text-slate-700">
                          {load.weight?.toLocaleString()} kg
                        </p>
                        <p className="text-xs text-slate-500 truncate max-w-[150px]">
                          {load.cargoDescription || 'General cargo'}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {load.truckType?.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-sm text-slate-700">
                        {new Date(load.pickupDate).toLocaleDateString()}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadge(load.status)}`}>
                        {load.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/carrier/loads/${load.id}`}
                          className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 rounded-lg hover:bg-slate-200 transition-colors"
                        >
                          View
                        </Link>
                        {load.status === 'POSTED' && (
                          <button
                            onClick={() => handleFindTrucks(load)}
                            className="px-3 py-1.5 text-xs font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 transition-colors"
                          >
                            Find Trucks
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
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm disabled:opacity-50 hover:bg-slate-50 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Find Trucks Modal */}
      {selectedLoad && (
        <FindMatchesModal
          isOpen={showFindTrucks}
          onClose={() => {
            setShowFindTrucks(false);
            setSelectedLoad(null);
          }}
          type="trucks"
          loadId={selectedLoad.id}
          loadDetails={{
            pickupCity: selectedLoad.pickupCity,
            deliveryCity: selectedLoad.deliveryCity,
            truckType: selectedLoad.truckType,
            weight: selectedLoad.weight,
          }}
          onProposalCreated={fetchLoads}
        />
      )}
    </div>
  );
}

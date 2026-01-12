'use client';

/**
 * POST LOADS Tab Component (Marketplace View)
 *
 * Shows POSTED loads with truck matching features
 * For full load management, use My Loads page
 * Sprint 14 - DAT-Style UI Transformation
 */

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DatAgeIndicator } from '@/components/dat-ui';
import { useToast } from '@/components/Toast/ToastContext';

interface PostLoadsTabProps {
  user: any;
  onSwitchToSearchTrucks?: (filters: any) => void;
}

const truckTypes = [
  { value: 'REFRIGERATED', label: 'Reefer' },
  { value: 'DRY_VAN', label: 'Van' },
  { value: 'FLATBED', label: 'Flatbed' },
  { value: 'CONTAINER', label: 'Container' },
  { value: 'TANKER', label: 'Tanker' },
  { value: 'BOX_TRUCK', label: 'Box Truck' },
  { value: 'LOWBOY', label: 'Lowboy' },
  { value: 'DUMP_TRUCK', label: 'Dump Truck' },
];

const getTruckTypeLabel = (enumValue: string | null | undefined): string => {
  if (!enumValue) return 'N/A';
  const found = truckTypes.find(t => t.value === enumValue);
  return found ? found.label : enumValue.replace('_', ' ');
};

export default function PostLoadsTab({ user, onSwitchToSearchTrucks }: PostLoadsTabProps) {
  const toast = useToast();
  const router = useRouter();
  const [loads, setLoads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLoadId, setExpandedLoadId] = useState<string | null>(null);

  /**
   * Fetch POSTED loads only (marketplace view)
   */
  const fetchLoads = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('status', 'POSTED');
      params.append('myLoads', 'true');
      params.append('sortBy', 'postedAt');
      params.append('sortOrder', 'desc');

      const response = await fetch(`/api/loads?${params.toString()}`);
      const data = await response.json();
      const loadsData = data.loads || [];

      // Fetch match counts for each load
      const loadsWithMatchCounts = await Promise.all(
        loadsData.map(async (load: any) => {
          try {
            const matchResponse = await fetch(`/api/loads/${load.id}/matching-trucks?limit=1`);
            const matchData = await matchResponse.json();
            return { ...load, matchCount: matchData.total || 0 };
          } catch (error) {
            return { ...load, matchCount: 0 };
          }
        })
      );

      setLoads(loadsWithMatchCounts);
    } catch (error) {
      console.error('Failed to fetch loads:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLoads();
  }, []);

  /**
   * Handle SEARCH TRUCKS action
   */
  const handleSearchTrucks = (load: any) => {
    const filters = {
      origin: load.pickupCity || '',
      destination: load.deliveryCity || '',
      truckType: load.truckType || '',
      pickupDate: load.pickupDate || '',
      length: load.lengthM?.toString() || '',
      weight: load.weight?.toString() || '',
    };

    if (onSwitchToSearchTrucks) {
      onSwitchToSearchTrucks(filters);
    }
  };

  /**
   * Handle unpost action
   */
  const handleUnpost = async (load: any) => {
    if (!confirm('Remove this load from the marketplace?')) return;

    try {
      const response = await fetch(`/api/loads/${load.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'UNPOSTED' }),
      });

      if (!response.ok) throw new Error('Failed to unpost load');

      toast.success('Load removed from marketplace');
      fetchLoads();
    } catch (error) {
      toast.error('Failed to unpost load');
    }
  };

  return (
    <div className="space-y-6 pt-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">Posted Loads</h2>
          <p className="text-sm text-slate-500">Find trucks for your posted loads</p>
        </div>
        <button
          onClick={() => router.push('/shipper/loads/create')}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:shadow-lg hover:shadow-teal-500/30 transition-all font-semibold text-sm shadow-md shadow-teal-500/25"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          POST NEW LOAD
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-center gap-3">
        <svg className="w-5 h-5 text-teal-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-teal-800">
          This shows only your <strong>Posted</strong> loads. For full load management (drafts, editing, all statuses), go to{' '}
          <Link href="/shipper/loads" className="underline font-medium hover:text-teal-900">My Loads</Link>.
        </p>
      </div>

      {/* Loads Table */}
      <div className="bg-white border border-slate-200/60 rounded-2xl overflow-hidden shadow-sm">
        {/* Table Header */}
        <div className="bg-gradient-to-r from-teal-600 to-teal-500 grid grid-cols-7 gap-2 px-4 py-3 text-xs font-semibold text-white">
          <div>Age</div>
          <div>Pickup</div>
          <div>Origin</div>
          <div>Destination</div>
          <div>Truck</div>
          <div>Weight</div>
          <div className="text-center">Matches</div>
        </div>

        {/* Loading */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-slate-500">Loading posted loads...</p>
          </div>
        ) : loads.length === 0 ? (
          /* Empty State */
          <div className="p-12 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
            </div>
            <h3 className="text-slate-700 font-medium mb-1">No posted loads</h3>
            <p className="text-slate-500 text-sm mb-4">Post a load to start finding trucks</p>
            <button
              onClick={() => router.push('/shipper/loads/create')}
              className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
            >
              Post New Load
            </button>
          </div>
        ) : (
          /* Load Rows */
          loads.map((load) => (
            <div key={load.id}>
              <div
                className={`grid grid-cols-7 gap-2 px-4 py-3 border-b text-sm cursor-pointer transition-colors ${
                  expandedLoadId === load.id
                    ? 'bg-teal-50 border-l-4 border-l-teal-500'
                    : 'border-slate-100 hover:bg-slate-50'
                }`}
                onClick={() => setExpandedLoadId(expandedLoadId === load.id ? null : load.id)}
              >
                <div><DatAgeIndicator date={load.postedAt || load.createdAt} /></div>
                <div className="text-slate-700">
                  {load.pickupDate ? new Date(load.pickupDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                </div>
                <div className="font-medium text-slate-800 truncate">{load.pickupCity || 'N/A'}</div>
                <div className="font-medium text-slate-800 truncate">{load.deliveryCity || 'N/A'}</div>
                <div className="text-slate-600">{getTruckTypeLabel(load.truckType)}</div>
                <div className="text-slate-600">{load.weight ? `${load.weight.toLocaleString()} kg` : 'N/A'}</div>
                <div className="text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                    load.matchCount > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {load.matchCount || 0} trucks
                  </span>
                </div>
              </div>

              {/* Expanded Actions */}
              {expandedLoadId === load.id && (
                <div className="bg-teal-50 px-6 py-4 border-b border-teal-200 border-l-4 border-l-teal-500">
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-slate-600">
                      <strong>Rate:</strong> {load.rate ? `ETB ${load.rate.toLocaleString()}` : 'Not set'} •{' '}
                      <strong>Cargo:</strong> {load.cargoDescription || 'Not specified'}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSearchTrucks(load);
                        }}
                        className="px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        Find Trucks ({load.matchCount || 0})
                      </button>
                      <Link
                        href={`/shipper/loads/${load.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="px-4 py-2 bg-slate-100 text-slate-700 text-sm font-medium rounded-lg hover:bg-slate-200 transition-colors"
                      >
                        View Details
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleUnpost(load);
                        }}
                        className="px-4 py-2 bg-rose-100 text-rose-700 text-sm font-medium rounded-lg hover:bg-rose-200 transition-colors"
                      >
                        Unpost
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Footer note */}
      {loads.length > 0 && (
        <p className="text-center text-sm text-slate-500">
          Showing {loads.length} posted load{loads.length !== 1 ? 's' : ''} •{' '}
          <Link href="/shipper/loads" className="text-teal-600 hover:underline">View all loads</Link>
        </p>
      )}
    </div>
  );
}

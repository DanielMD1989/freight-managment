'use client';

/**
 * POST LOADS Tab Component (Marketplace View)
 *
 * Shows POSTED loads with truck matching features
 * For full load management, use My Loads page
 * Sprint 14 - DAT-Style UI Transformation
 * Updated: Sprint 19 - Responsive DataTable integration
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AgeIndicator } from '@/components/loadboard-ui';
import DataTable from '@/components/loadboard-ui/DataTable';
import { TableColumn, RowAction } from '@/types/loadboard-ui';
import { useToast } from '@/components/Toast/ToastContext';
import { getCSRFToken } from '@/lib/csrfFetch';

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
   * Note: We don't pass truckType because:
   * 1. The matching engine uses scoring, not exact type match
   * 2. Different truck types can often carry the same cargo
   * 3. User can filter by type on the search page if needed
   */
  const handleSearchTrucks = (load: any) => {
    const filters = {
      origin: load.pickupCity || '',
      destination: load.deliveryCity || '',
      // Don't pass truckType - let user see all available trucks on route
    };

    console.log('[PostLoads] Find Trucks filters:', filters);
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
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${load.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({ status: 'UNPOSTED' }),
      });

      if (!response.ok) throw new Error('Failed to unpost load');

      toast.success('Load removed from marketplace');
      fetchLoads();
    } catch (error) {
      toast.error('Failed to unpost load');
    }
  };

  /**
   * Table columns definition
   */
  const columns: TableColumn[] = useMemo(() => [
    {
      key: 'postedAt',
      label: 'Age',
      width: '80px',
      render: (value: string, row: any) => <AgeIndicator date={row.postedAt || row.createdAt} />,
    },
    {
      key: 'pickupDate',
      label: 'Pickup',
      sortable: true,
      render: (value: string) =>
        value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A',
    },
    {
      key: 'pickupCity',
      label: 'Origin',
      sortable: true,
      render: (value: string) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">{value || 'N/A'}</span>
      ),
    },
    {
      key: 'deliveryCity',
      label: 'Destination',
      sortable: true,
      render: (value: string) => (
        <span className="font-medium text-slate-800 dark:text-slate-100">{value || 'N/A'}</span>
      ),
    },
    {
      key: 'truckType',
      label: 'Truck',
      render: (value: string) => getTruckTypeLabel(value),
    },
    {
      key: 'weight',
      label: 'Weight',
      sortable: true,
      render: (value: number) => (value ? `${value.toLocaleString()} kg` : 'N/A'),
    },
    {
      key: 'matchCount',
      label: 'Matches',
      align: 'center' as const,
      render: (value: number) => (
        <span
          className={`px-2 py-1 rounded-full text-xs font-bold ${
            value > 0 ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
          }`}
        >
          {value || 0} trucks
        </span>
      ),
    },
  ], []);

  /**
   * Table actions definition
   */
  const actions: RowAction[] = useMemo(() => [
    {
      key: 'findTrucks',
      label: 'Find Trucks',
      variant: 'primary',
      icon: (
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      ),
      onClick: (row: any) => handleSearchTrucks(row),
    },
    {
      key: 'viewDetails',
      label: 'View',
      variant: 'secondary',
      onClick: (row: any) => router.push(`/shipper/loads/${row.id}`),
    },
    {
      key: 'unpost',
      label: 'Unpost',
      variant: 'destructive',
      onClick: (row: any) => handleUnpost(row),
    },
  ], [router]);

  /**
   * Render expanded row content
   */
  const renderExpandedRow = (load: any) => (
    <div className="flex items-center justify-between text-sm">
      <div className="text-slate-600 dark:text-slate-300">
        <strong>Rate:</strong> {load.rate ? `ETB ${load.rate.toLocaleString()}` : 'Not set'} •{' '}
        <strong>Cargo:</strong> {load.cargoDescription || 'Not specified'}
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pt-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Posted Loads</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Find trucks for your posted loads</p>
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
      <div className="bg-teal-50 dark:bg-teal-900/30 border border-teal-200 dark:border-teal-800 rounded-xl p-4 flex items-center gap-3">
        <svg className="w-5 h-5 text-teal-600 dark:text-teal-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-teal-800 dark:text-teal-200">
          This shows only your <strong>Posted</strong> loads. For full load management (drafts, editing, all statuses), go to{' '}
          <Link href="/shipper/loads" className="underline font-medium hover:text-teal-900 dark:hover:text-teal-100">My Loads</Link>.
        </p>
      </div>

      {/* Loads Table - Responsive with Card View */}
      <DataTable
        columns={columns}
        data={loads}
        loading={loading}
        expandable={true}
        renderExpandedRow={renderExpandedRow}
        actions={actions}
        rowKey="id"
        responsiveCardView={true}
        cardTitleColumn="pickupCity"
        cardSubtitleColumn="deliveryCity"
        emptyMessage="Post a load to start finding trucks"
      />

      {/* Footer note */}
      {loads.length > 0 && (
        <p className="text-center text-sm text-slate-500 dark:text-slate-400">
          Showing {loads.length} posted load{loads.length !== 1 ? 's' : ''} •{' '}
          <Link href="/shipper/loads" className="text-teal-600 dark:text-teal-400 hover:underline">View all loads</Link>
        </p>
      )}
    </div>
  );
}

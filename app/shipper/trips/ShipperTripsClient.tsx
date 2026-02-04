/**
 * Shipper Trips Client Component
 *
 * Client-side component for shipper trip tracking with status filters
 */

'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Trip {
  id: string;
  loadId: string;
  referenceNumber: string;
  status: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: number;
  rate: number | null;
  assignedAt: string | null;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
  } | null;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
  } | null;
  podSubmitted: boolean;
  podVerified: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

interface Props {
  initialTrips: Trip[];
  pagination: Pagination;
  initialStatus?: string;
}

interface StatusOption {
  value: string;
  label: string;
  statuses?: string[];
}

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'all', label: 'All', statuses: ['DELIVERED', 'COMPLETED'] },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'COMPLETED', label: 'Completed' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatCurrency(amount: number | null): string {
  if (!amount) return '-';
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getStatusColor(status: string, trip?: Trip): string {
  if (status === 'DELIVERED' && trip) {
    if (trip.podVerified) return 'bg-green-50 text-green-700 border border-green-200';
    if (trip.podSubmitted) return 'bg-purple-50 text-purple-700 border border-purple-200';
  }
  const colors: Record<string, string> = {
    ASSIGNED: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    PICKUP_PENDING: 'bg-purple-50 text-purple-700 border border-purple-200',
    IN_TRANSIT: 'bg-amber-50 text-amber-700 border border-amber-200',
    DELIVERED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    COMPLETED: 'bg-slate-50 text-slate-600 border border-slate-200',
  };
  return colors[status] || 'bg-slate-50 text-slate-600 border border-slate-200';
}

function getStatusLabel(status: string, trip?: Trip): string {
  if (status === 'DELIVERED' && trip) {
    if (trip.podVerified) return 'POD Verified';
    if (trip.podSubmitted) return 'Verify POD';
  }
  const labels: Record<string, string> = {
    ASSIGNED: 'Assigned',
    PICKUP_PENDING: 'Pickup Pending',
    IN_TRANSIT: 'In Transit',
    DELIVERED: 'Delivered',
    COMPLETED: 'Completed',
  };
  return labels[status] || status;
}

export default function ShipperTripsClient({
  initialTrips,
  pagination,
  initialStatus,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [statusFilter, setStatusFilter] = useState(initialStatus || 'all');

  /**
   * Handle status filter change
   */
  const handleStatusChange = (status: string) => {
    setStatusFilter(status);
    const params = new URLSearchParams(searchParams.toString());

    if (status !== 'all') {
      // Map filter values to actual statuses
      const option = STATUS_OPTIONS.find(o => o.value === status);
      if (option && option.statuses) {
        params.set('status', option.statuses.join(','));
      } else {
        params.set('status', status);
      }
    } else {
      params.delete('status');
    }

    params.delete('page');
    router.push(`/shipper/trips?${params.toString()}`);
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/shipper/trips?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {STATUS_OPTIONS.map((option) => (
          <button
            key={option.value}
            onClick={() => handleStatusChange(option.value)}
            className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
            style={{
              background: statusFilter === option.value ? 'var(--secondary-600)' : 'var(--bg-tinted)',
              color: statusFilter === option.value ? 'white' : 'var(--foreground-muted)',
            }}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Trips List */}
      {initialTrips.length === 0 ? (
        <div
          className="rounded-xl shadow-sm p-8 text-center"
          style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
        >
          <div
            className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
            style={{ background: 'var(--bg-tinted)' }}
          >
            <svg className="w-8 h-8" style={{ color: 'var(--foreground-muted)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <p style={{ color: 'var(--foreground-muted)' }}>
            No completed trips yet. Trips will appear here after delivery.
          </p>
          <Link
            href="/shipper/loads"
            className="inline-block mt-4 px-4 py-2 text-white rounded-lg transition-colors"
            style={{ background: 'var(--secondary-600)' }}
          >
            View Active Loads
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {initialTrips.map((trip) => (
            <div
              key={trip.id}
              className="rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow"
              style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(trip.status, trip)}`}>
                    {getStatusLabel(trip.status, trip)}
                  </span>
                  <span className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
                    {trip.referenceNumber}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Route button for completed trips */}
                  <Link
                    href={`/shipper/map?loadId=${trip.loadId}&history=true`}
                    className="px-4 py-2 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors flex items-center gap-2 font-medium"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                    </svg>
                    View Route
                  </Link>
                  {trip.status === 'DELIVERED' && trip.podSubmitted && !trip.podVerified && (
                    <Link
                      href={`/shipper/trips/${trip.loadId}`}
                      className="px-4 py-2 text-sm bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
                    >
                      Verify POD
                    </Link>
                  )}
                  <Link
                    href={`/shipper/trips/${trip.loadId}`}
                    className="px-4 py-2 text-sm rounded-lg transition-colors"
                    style={{ background: 'var(--bg-tinted)', color: 'var(--foreground)' }}
                  >
                    View Details
                  </Link>
                </div>
              </div>

              {/* Route Info */}
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="font-medium text-slate-700 dark:text-slate-200">{trip.pickupCity}</span>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200/60 ml-5">
                    Pickup: {formatDate(trip.pickupDate)}
                  </p>
                </div>
                <div className="flex-shrink-0">
                  <svg className="w-6 h-6 text-slate-700 dark:text-slate-200/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{trip.deliveryCity}</span>
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                  </div>
                  <p className="text-xs text-slate-700 dark:text-slate-200/60 mr-5">
                    Delivery: {formatDate(trip.deliveryDate)}
                  </p>
                </div>
              </div>

              {/* Trip Details Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                {/* Load Info */}
                <div>
                  <p className="text-xs text-slate-700 dark:text-slate-200/50 uppercase tracking-wide mb-1">Load</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {trip.weight.toLocaleString()} kg
                  </p>
                  <p className="text-xs text-slate-700 dark:text-slate-200/60">{trip.truckType}</p>
                </div>

                {/* Rate */}
                <div>
                  <p className="text-xs text-slate-700 dark:text-slate-200/50 uppercase tracking-wide mb-1">Rate</p>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    {formatCurrency(trip.rate)}
                  </p>
                </div>

                {/* Carrier Info */}
                <div>
                  <p className="text-xs text-slate-700 dark:text-slate-200/50 uppercase tracking-wide mb-1">Carrier</p>
                  {trip.carrier ? (
                    <>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {trip.carrier.name}
                        {trip.carrier.isVerified && (
                          <span className="ml-1 text-green-600">✓</span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-700 dark:text-slate-200/40">-</p>
                  )}
                </div>

                {/* Truck Info */}
                <div>
                  <p className="text-xs text-slate-700 dark:text-slate-200/50 uppercase tracking-wide mb-1">Truck</p>
                  {trip.truck ? (
                    <>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                        {trip.truck.licensePlate}
                      </p>
                      <p className="text-xs text-slate-700 dark:text-slate-200/60">{trip.truck.truckType}</p>
                    </>
                  ) : (
                    <p className="text-sm text-slate-700 dark:text-slate-200/40">-</p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 pt-4">
          <p className="text-sm text-slate-700 dark:text-slate-200/60">
            Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} trips
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page === 1}
              className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm text-slate-700 dark:text-slate-200/60">
              Page {pagination.page} of {pagination.pages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page === pagination.pages}
              className="px-3 py-1 text-sm border border-slate-200 dark:border-slate-600 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

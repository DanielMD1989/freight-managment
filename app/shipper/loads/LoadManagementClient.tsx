'use client';

/**
 * Load Management Client Component
 *
 * Interactive load management with filtering and actions
 * Sprint 11 - Story 11.3: Load Management
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface Load {
  id: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: number;
  rate: number;
  status: string;
  cargoDescription: string;
  fullPartial: string;
  createdAt: string;
  updatedAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Loads' },
  { value: 'draft', label: 'Drafts' },
  { value: 'posted', label: 'Posted' },
  { value: 'matched', label: 'Matched' },
  { value: 'in_transit', label: 'In Transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    POSTED: 'bg-blue-100 text-blue-800',
    MATCHED: 'bg-purple-100 text-purple-800',
    IN_TRANSIT: 'bg-yellow-100 text-yellow-800',
    DELIVERED: 'bg-green-100 text-green-800',
    COMPLETED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export default function LoadManagementClient({
  initialLoads,
  pagination,
  initialStatus,
}: {
  initialLoads: Load[];
  pagination: Pagination;
  initialStatus?: string;
}) {
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
      params.set('status', status);
    } else {
      params.delete('status');
    }

    params.delete('page');
    router.push(`/shipper/loads?${params.toString()}`);
  };

  /**
   * Handle pagination
   */
  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', newPage.toString());
    router.push(`/shipper/loads?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Status Filter */}
          <div>
            <label
              htmlFor="status"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Filter by Status
            </label>
            <select
              id="status"
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Summary Stats */}
          <div className="flex items-center justify-end gap-4">
            <div className="text-right">
              <div className="text-sm text-gray-600">Total Loads</div>
              <div className="text-2xl font-bold text-gray-900">
                {pagination.total}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loads Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {initialLoads.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {initialLoads.map((load) => (
                    <tr key={load.id} className="hover:bg-gray-50">
                      {/* Route */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-sm">
                          <div className="font-medium text-gray-900">
                            {load.pickupCity}
                          </div>
                          <div className="text-gray-500">↓</div>
                          <div className="font-medium text-gray-900">
                            {load.deliveryCity}
                          </div>
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-sm">
                          <div className="text-gray-900">
                            {formatDate(load.pickupDate)}
                          </div>
                          <div className="text-gray-500">to</div>
                          <div className="text-gray-900">
                            {formatDate(load.deliveryDate)}
                          </div>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col text-sm">
                          <div className="text-gray-900">
                            {load.truckType.replace(/_/g, ' ')}
                          </div>
                          <div className="text-gray-500">
                            {load.weight.toLocaleString()} kg
                          </div>
                          <div className="text-xs text-gray-400">
                            {load.fullPartial === 'FULL' ? 'Full Load' : 'Partial'}
                          </div>
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-lg font-semibold text-gray-900">
                          {formatCurrency(load.rate)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(
                            load.status
                          )}`}
                        >
                          {load.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <Link
                          href={`/shipper/loads/${load.id}`}
                          className="text-blue-600 hover:text-blue-900 mr-3"
                        >
                          View
                        </Link>
                        {load.status === 'DRAFT' && (
                          <Link
                            href={`/shipper/loads/${load.id}/edit`}
                            className="text-gray-600 hover:text-gray-900"
                          >
                            Edit
                          </Link>
                        )}
                        {load.status === 'POSTED' && (
                          <Link
                            href={`/shipper/matches?loadId=${load.id}`}
                            className="text-green-600 hover:text-green-900"
                          >
                            Matches
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                <div className="text-sm text-gray-700">
                  Showing{' '}
                  <span className="font-medium">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium">{pagination.total}</span>{' '}
                  loads
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-700">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="px-6 py-12 text-center">
            <div className="text-6xl mb-4">📦</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No loads found
            </h3>
            <p className="text-gray-600 mb-6">
              {statusFilter !== 'all'
                ? `You don't have any ${statusFilter} loads yet.`
                : "You haven't posted any loads yet."}
            </p>
            <Link
              href="/shipper/loads/create"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Post Your First Load
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

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
import { toast } from 'react-hot-toast';

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
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [copyingLoadId, setCopyingLoadId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  /**
   * Handle load copy
   * Story 15.4: Task 15.4.1-15.4.3 - Copy load with confirmation
   */
  const handleCopyLoad = async (loadId: string) => {
    setCopyingLoadId(loadId);
    try {
      const response = await fetch(`/api/loads/${loadId}/duplicate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to copy load');
        return;
      }

      const newLoad = await response.json();
      toast.success('Load copied successfully');

      // Refresh to show the new load
      router.refresh();
    } catch (error) {
      console.error('Error copying load:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setCopyingLoadId(null);
    }
  };

  /**
   * Handle load deletion
   * Story 15.4: Task 15.4.5-15.4.7 - Delete with confirmation and error handling
   */
  const handleDeleteLoad = async (loadId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/loads/${loadId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json();

        if (response.status === 409) {
          toast.error(
            error.message || 'Cannot delete load that has been assigned'
          );
        } else if (response.status === 404) {
          toast.error('Load not found');
        } else {
          toast.error(error.message || 'Failed to delete load');
        }
        return;
      }

      toast.success('Load deleted successfully');
      setDeleteConfirmId(null);
      router.refresh();
    } catch (error) {
      console.error('Error deleting load:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setIsDeleting(false);
    }
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
                        <div className="flex gap-2">
                          <Link
                            href={`/shipper/loads/${load.id}`}
                            className="text-blue-600 hover:text-blue-900"
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
                          <button
                            onClick={() => handleCopyLoad(load.id)}
                            disabled={copyingLoadId === load.id}
                            className="text-purple-600 hover:text-purple-900 disabled:opacity-50"
                          >
                            {copyingLoadId === load.id ? 'Copying...' : 'Copy'}
                          </button>
                          {(load.status === 'DRAFT' || load.status === 'POSTED') && (
                            <button
                              onClick={() => setDeleteConfirmId(load.id)}
                              className="text-red-600 hover:text-red-900"
                            >
                              Delete
                            </button>
                          )}
                        </div>
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirm Delete
            </h3>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete this load? This action cannot be undone.
              {' '}If this load has been assigned to a carrier, you won't be able to delete it.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirmId(null)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteLoad(deleteConfirmId)}
                disabled={isDeleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? 'Deleting...' : 'Delete Load'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

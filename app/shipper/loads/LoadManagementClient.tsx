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
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { getCSRFToken } from '@/lib/csrfFetch';

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
  postedAt: string | null;
  assignedTruck?: {
    id: string;
    licensePlate: string;
    truckType: string;
  } | null;
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
  { value: 'unposted', label: 'Unposted' },
  { value: 'posted', label: 'Posted' },
  { value: 'active', label: 'Active Trips' },  // ASSIGNED, PICKUP_PENDING, IN_TRANSIT
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

/**
 * Calculate age since a date (e.g., "2h", "3d", "1w")
 */
function calculateAge(dateString: string | null): string {
  if (!dateString) return '-';

  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return `${diffWeeks}w`;
}

/**
 * Get age color based on freshness
 */
function getAgeColor(dateString: string | null): string {
  if (!dateString) return 'text-slate-400';

  const date = new Date(dateString);
  const now = new Date();
  const diffHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

  if (diffHours < 2) return 'text-emerald-600 bg-emerald-50';
  if (diffHours < 24) return 'text-teal-600 bg-teal-50';
  if (diffHours < 72) return 'text-amber-600 bg-amber-50';
  return 'text-slate-500 bg-slate-50';
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
    DRAFT: 'bg-slate-50 text-slate-600 border border-slate-200',
    POSTED: 'bg-teal-50 text-teal-700 border border-teal-200',
    // "Matched" statuses (loads assigned to carriers)
    OFFERED: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    ASSIGNED: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    PICKUP_PENDING: 'bg-purple-50 text-purple-700 border border-purple-200',
    // Active trip statuses
    IN_TRANSIT: 'bg-amber-50 text-amber-700 border border-amber-200',
    DELIVERED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    COMPLETED: 'bg-slate-50 text-slate-600 border border-slate-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border border-rose-200',
    EXCEPTION: 'bg-orange-50 text-orange-700 border border-orange-200',
    EXPIRED: 'bg-gray-50 text-gray-700 border border-gray-200',
    SEARCHING: 'bg-cyan-50 text-cyan-700 border border-cyan-200',
  };
  return colors[status] || 'bg-slate-50 text-slate-600 border border-slate-200';
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
  const [postingLoadId, setPostingLoadId] = useState<string | null>(null);
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
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${loadId}/duplicate`, {
        method: 'POST',
        headers: {
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
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
   * Handle posting a DRAFT or UNPOSTED load
   */
  const handlePostLoad = async (loadId: string) => {
    setPostingLoadId(loadId);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${loadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', ...(csrfToken && { 'X-CSRF-Token': csrfToken }) },
        credentials: 'include',
        body: JSON.stringify({ status: 'POSTED' }),
      });

      if (!response.ok) {
        const error = await response.json();
        toast.error(error.message || 'Failed to post load');
        return;
      }

      toast.success('Load posted successfully!');
      router.refresh();
    } catch (error) {
      console.error('Error posting load:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setPostingLoadId(null);
    }
  };

  /**
   * Handle load deletion
   * Story 15.4: Task 15.4.5-15.4.7 - Delete with confirmation and error handling
   */
  const handleDeleteLoad = async (loadId: string) => {
    setIsDeleting(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/loads/${loadId}`, {
        method: 'DELETE',
        headers: {
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
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
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => handleStatusChange(option.value)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  statusFilter === option.value
                    ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {/* Summary Stats */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Total:</span>
            <span className="text-xl font-bold text-slate-800">
              {pagination.total}
            </span>
            <span className="text-sm text-slate-500">loads</span>
          </div>
        </div>
      </div>

      {/* Loads Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {initialLoads.length > 0 ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-gradient-to-r from-teal-600 to-teal-500">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Age
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Dates
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Details
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Truck
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {initialLoads.map((load) => (
                    <tr key={load.id} className="hover:bg-slate-50 transition-colors">
                      {/* Age */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getAgeColor(load.postedAt || load.createdAt)}`}>
                          {calculateAge(load.postedAt || load.createdAt)}
                        </span>
                      </td>

                      {/* Route */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-800">{load.pickupCity}</span>
                          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          <span className="font-medium text-slate-800">{load.deliveryCity}</span>
                        </div>
                      </td>

                      {/* Dates */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col text-sm">
                          <div className="text-slate-700">
                            {formatDate(load.pickupDate)}
                          </div>
                          <div className="text-slate-400 text-xs">to</div>
                          <div className="text-slate-700">
                            {formatDate(load.deliveryDate)}
                          </div>
                        </div>
                      </td>

                      {/* Details */}
                      <td className="px-4 py-4">
                        <div className="flex flex-col text-sm">
                          <div className="text-slate-700 font-medium">
                            {load.truckType.replace(/_/g, ' ')}
                          </div>
                          <div className="text-slate-500 text-xs">
                            {load.weight.toLocaleString()} kg
                          </div>
                          <div className="text-xs text-slate-400">
                            {load.fullPartial === 'FULL' ? 'Full Load' : 'Partial'}
                          </div>
                        </div>
                      </td>

                      {/* Rate */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <div className="text-lg font-bold text-slate-800">
                          {formatCurrency(load.rate)}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span
                          className={`px-3 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusColor(
                            load.status
                          )}`}
                        >
                          {load.status.replace(/_/g, ' ')}
                        </span>
                      </td>

                      {/* Truck */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {load.assignedTruck ? (
                          <div className="text-sm">
                            <div className="font-medium text-slate-800">
                              {load.assignedTruck.licensePlate}
                            </div>
                            <div className="text-xs text-slate-500">
                              {load.assignedTruck.truckType.replace(/_/g, ' ')}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">-</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-2 flex-wrap">
                          <Link
                            href={`/shipper/loads/${load.id}`}
                            className="text-teal-600 hover:text-teal-700 font-medium"
                          >
                            View
                          </Link>
                          {/* Track button for active trips */}
                          {(load.status === 'ASSIGNED' || load.status === 'PICKUP_PENDING' || load.status === 'IN_TRANSIT') && (
                            <Link
                              href={load.status === 'IN_TRANSIT' ? `/shipper/map?loadId=${load.id}` : `/shipper/trips/${load.id}`}
                              className="text-amber-600 hover:text-amber-700 font-semibold"
                            >
                              {load.status === 'IN_TRANSIT' ? 'Track' : 'Status'}
                            </Link>
                          )}
                          {(load.status === 'DRAFT' || load.status === 'UNPOSTED') && (
                            <>
                              <Link
                                href={`/shipper/loads/${load.id}/edit`}
                                className="text-slate-600 hover:text-slate-700"
                              >
                                Edit
                              </Link>
                              <button
                                onClick={() => handlePostLoad(load.id)}
                                disabled={postingLoadId === load.id}
                                className="text-emerald-600 hover:text-emerald-700 disabled:opacity-50 font-semibold"
                              >
                                {postingLoadId === load.id ? 'Posting...' : 'Post'}
                              </button>
                            </>
                          )}
                          {load.status === 'POSTED' && (
                            <Link
                              href={`/shipper/loadboard?tab=SEARCH_TRUCKS&origin=${encodeURIComponent(load.pickupCity || '')}&destination=${encodeURIComponent(load.deliveryCity || '')}`}
                              className="text-indigo-600 hover:text-indigo-700"
                            >
                              Find Trucks
                            </Link>
                          )}
                          <button
                            onClick={() => handleCopyLoad(load.id)}
                            disabled={copyingLoadId === load.id}
                            className="text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
                          >
                            {copyingLoadId === load.id ? '...' : 'Copy'}
                          </button>
                          {(load.status === 'DRAFT' || load.status === 'POSTED' || load.status === 'UNPOSTED') && (
                            <button
                              onClick={() => setDeleteConfirmId(load.id)}
                              className="text-rose-600 hover:text-rose-700"
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
              <div className="bg-gradient-to-r from-slate-50 to-teal-50/30 px-6 py-4 flex items-center justify-between border-t border-slate-100">
                <div className="text-sm text-slate-500">
                  Showing{' '}
                  <span className="font-medium text-slate-700">
                    {(pagination.page - 1) * pagination.limit + 1}
                  </span>{' '}
                  to{' '}
                  <span className="font-medium text-slate-700">
                    {Math.min(pagination.page * pagination.limit, pagination.total)}
                  </span>{' '}
                  of <span className="font-medium text-slate-700">{pagination.total}</span>{' '}
                  loads
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handlePageChange(pagination.page - 1)}
                    disabled={pagination.page === 1}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Previous
                  </button>
                  <span className="px-4 py-2 text-sm text-slate-500">
                    Page {pagination.page} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => handlePageChange(pagination.page + 1)}
                    disabled={pagination.page === pagination.pages}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        ) : (
          /* Empty State */
          <div className="px-6 py-16 text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-teal-500 to-teal-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/25 p-3">
              <Image
                src="/cargo-icon.png"
                alt="No loads"
                width={56}
                height={56}
                style={{ objectFit: 'contain' }}
              />
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              No loads found
            </h3>
            <p className="text-slate-500 mb-6">
              {statusFilter !== 'all'
                ? `You don't have any ${statusFilter} loads yet.`
                : "You haven't posted any loads yet."}
            </p>
            <Link
              href="/shipper/loads/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl font-medium shadow-md shadow-teal-500/25 hover:shadow-lg hover:shadow-teal-500/30 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Post Your First Load
            </Link>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden border border-slate-200/60">
            <div className="px-6 py-4 bg-gradient-to-r from-rose-50 to-rose-100/50 border-b border-rose-100">
              <h3 className="text-lg font-semibold text-rose-800">
                Confirm Delete
              </h3>
            </div>
            <div className="p-6">
              <p className="text-slate-600 mb-6">
                Are you sure you want to delete this load? This action cannot be undone.
                {' '}If this load has been assigned to a carrier, you won&apos;t be able to delete it.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-50 font-medium disabled:opacity-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteLoad(deleteConfirmId)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2.5 bg-rose-500 text-white rounded-xl hover:bg-rose-600 font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Load'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

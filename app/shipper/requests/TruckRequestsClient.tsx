/**
 * Truck Requests Client Component
 *
 * Phase 2 - Story 16.15: Shipper-Led Truck Matching
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCSRFToken } from '@/lib/csrfFetch';

interface TruckRequest {
  id: string;
  status: string;
  notes: string | null;
  offeredRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  load: {
    id: string;
    referenceNumber: string;
    status: string;
    weight: number;
    truckType: string;
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
  };
  truck: {
    id: string;
    plateNumber: string;
    truckType: string;
    capacity: number;
    carrier: {
      id: string;
      name: string;
      isVerified: boolean;
    };
  };
  requestedBy: {
    id: string;
    name: string;
  } | null;
}

interface Props {
  requests: TruckRequest[];
}

type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED' | 'CANCELLED';

export default function TruckRequestsClient({ requests: initialRequests }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState<TruckRequest[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const filteredRequests =
    statusFilter === 'all'
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  const handleCancel = async (requestId: string) => {
    if (!confirm('Are you sure you want to cancel this request?')) return;

    setLoading(requestId);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/truck-requests/${requestId}`, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to cancel request');
      }

      setRequests(requests.filter((r) => r.id !== requestId));
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      EXPIRED: 'bg-teal-700/10 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      CANCELLED: 'bg-teal-700/10 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    };
    return styles[status] || 'bg-teal-700/10 text-gray-800';
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return 'Expired';

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const statusCounts = {
    all: requests.length,
    PENDING: requests.filter((r) => r.status === 'PENDING').length,
    APPROVED: requests.filter((r) => r.status === 'APPROVED').length,
    REJECTED: requests.filter((r) => r.status === 'REJECTED').length,
    EXPIRED: requests.filter((r) => r.status === 'EXPIRED').length,
    CANCELLED: requests.filter((r) => r.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-sm text-red-600 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'CANCELLED'] as StatusFilter[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                statusFilter === status
                  ? 'bg-teal-600 text-white'
                  : 'bg-teal-700/10 dark:bg-slate-700 text-slate-700 dark:text-slate-200/80 dark:text-gray-300 hover:bg-teal-700/20 dark:hover:bg-slate-600'
              }`}
            >
              {status === 'all' ? 'All' : status} ({statusCounts[status]})
            </button>
          )
        )}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 dark:border-slate-700 p-8 text-center">
          <p className="text-slate-700 dark:text-slate-200/60 dark:text-gray-400">
            {statusFilter === 'all'
              ? "You haven't made any truck requests yet."
              : `No ${statusFilter.toLowerCase()} requests.`}
          </p>
          {statusFilter === 'all' && (
            <a
              href="/shipper/loadboard?tab=SEARCH_TRUCKS"
              className="inline-block mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
            >
              Search Trucks
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 dark:border-slate-700 p-6"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                        request.status
                      )}`}
                    >
                      {request.status}
                    </span>
                    {request.status === 'PENDING' && (
                      <span className="text-sm text-orange-600 dark:text-orange-400">
                        Expires in {getTimeRemaining(request.expiresAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-200/60 dark:text-gray-400 mt-1">
                    Requested on {formatDate(request.createdAt)}
                  </p>
                </div>
                {request.status === 'PENDING' && (
                  <button
                    onClick={() => handleCancel(request.id)}
                    disabled={loading === request.id}
                    className="px-3 py-1 text-sm text-red-600 hover:text-red-800 border border-red-200 rounded-lg hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/30 disabled:opacity-50"
                  >
                    {loading === request.id ? 'Cancelling...' : 'Cancel'}
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Load Info */}
                <div className="bg-teal-50 dark:bg-slate-800 dark:bg-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200/80 dark:text-gray-300 mb-2">
                    Load
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-700 dark:text-slate-200 dark:text-white font-medium">
                      {request.load.referenceNumber || request.load.id.slice(-8)}
                    </p>
                    <p className="text-slate-700 dark:text-slate-200/70 dark:text-gray-400">
                      {request.load.pickupCity} → {request.load.deliveryCity}
                    </p>
                    <p className="text-slate-700 dark:text-slate-200/70 dark:text-gray-400">
                      {request.load.weight.toLocaleString()} kg • {request.load.truckType}
                    </p>
                    <p className="text-slate-700 dark:text-slate-200/70 dark:text-gray-400">
                      Pickup: {new Date(request.load.pickupDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Truck Info */}
                <div className="bg-teal-600/10 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-200 dark:text-blue-200 mb-2">
                    Truck
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-700 dark:text-slate-200 dark:text-white font-medium">
                      {request.truck.plateNumber}
                    </p>
                    <p className="text-slate-700 dark:text-slate-200/70 dark:text-gray-400">
                      {request.truck.truckType} • {request.truck.capacity.toLocaleString()} kg
                    </p>
                    <p className="text-slate-700 dark:text-slate-200/70 dark:text-gray-400">
                      Carrier: {request.truck.carrier.name}
                      {request.truck.carrier.isVerified && (
                        <span className="ml-1 text-green-600">✓</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 dark:border-slate-700">
                <div className="flex flex-wrap gap-4 text-sm">
                  {request.offeredRate && (
                    <div>
                      <span className="text-slate-700 dark:text-slate-200/60 dark:text-gray-400">Offered Rate:</span>{' '}
                      <span className="text-slate-700 dark:text-slate-200 dark:text-white font-medium">
                        {request.offeredRate.toLocaleString()} ETB
                      </span>
                    </div>
                  )}
                  {request.notes && (
                    <div className="flex-1">
                      <span className="text-slate-700 dark:text-slate-200/60 dark:text-gray-400">Notes:</span>{' '}
                      <span className="text-slate-700 dark:text-slate-200 dark:text-white">{request.notes}</span>
                    </div>
                  )}
                </div>
                {request.respondedAt && (
                  <p className="text-sm text-slate-700 dark:text-slate-200/60 dark:text-gray-400 mt-2">
                    Responded on {formatDate(request.respondedAt)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

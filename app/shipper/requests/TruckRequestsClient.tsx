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
      phone?: string;
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

  // Status colors from StatusBadge.tsx (source of truth)
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
      APPROVED: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
      REJECTED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
      EXPIRED: 'bg-gray-500/10 text-gray-600 dark:text-gray-400',
      CANCELLED: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    };
    return styles[status] || 'bg-slate-500/10 text-slate-600';
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
                  : 'bg-teal-700/10 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-teal-700/20 dark:hover:bg-slate-600'
              }`}
            >
              {status === 'all' ? 'All' : status} ({statusCounts[status]})
            </button>
          )
        )}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="w-16 h-16 bg-teal-100 dark:bg-teal-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-teal-600 dark:text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 dark:text-white mb-2">
            {statusFilter === 'all' ? 'No Truck Requests Yet' : `No ${statusFilter} Requests`}
          </h3>
          <p className="text-slate-500 dark:text-slate-400 mb-6 max-w-sm mx-auto">
            {statusFilter === 'all'
              ? "When you request trucks from the loadboard, they'll appear here for tracking."
              : `You don't have any ${statusFilter.toLowerCase()} requests at the moment.`}
          </p>
          {statusFilter === 'all' && (
            <a
              href="/shipper/loadboard?tab=SEARCH_TRUCKS"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg hover:bg-teal-700 font-medium transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search Trucks
            </a>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className="bg-white dark:bg-slate-800 rounded-lg shadow border border-slate-200 dark:border-slate-700 p-6"
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
                  <p className="text-sm text-slate-700 dark:text-slate-400 mt-1">
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
                <div className="bg-teal-50 dark:bg-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Load
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-700 dark:text-white font-medium">
                      {request.load.referenceNumber || request.load.id.slice(-8)}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      {request.load.pickupCity} → {request.load.deliveryCity}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      {request.load.weight.toLocaleString()} kg • {request.load.truckType}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
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
                    <p className="text-slate-700 dark:text-white font-medium">
                      {request.truck.plateNumber}
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      {request.truck.truckType} • {request.truck.capacity.toLocaleString()} kg
                    </p>
                    <p className="text-slate-700 dark:text-slate-400">
                      Carrier: {request.truck.carrier.name}
                      {request.truck.carrier.isVerified && (
                        <span className="ml-1 text-green-600">✓</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>

              {/* Additional Details */}
              <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                <div className="flex flex-wrap gap-4 text-sm">
                  {request.offeredRate && (
                    <div>
                      <span className="text-slate-700 dark:text-slate-400">Offered Rate:</span>{' '}
                      <span className="text-slate-700 dark:text-white font-medium">
                        {request.offeredRate.toLocaleString()} ETB
                      </span>
                    </div>
                  )}
                  {request.notes && (
                    <div className="flex-1">
                      <span className="text-slate-700 dark:text-slate-400">Notes:</span>{' '}
                      <span className="text-slate-700 dark:text-white">{request.notes}</span>
                    </div>
                  )}
                </div>
                {request.respondedAt && (
                  <p className="text-sm text-slate-700 dark:text-slate-400 mt-2">
                    Responded on {formatDate(request.respondedAt)}
                  </p>
                )}
              </div>

              {/* Contact to Negotiate - Shown when APPROVED */}
              {request.status === 'APPROVED' && (
                <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-800 flex items-center justify-center flex-shrink-0">
                      <svg className="w-5 h-5 text-emerald-600 dark:text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-emerald-800 dark:text-emerald-200">Contact to Negotiate Price</h4>
                      <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-1">
                        Request approved! Contact the carrier directly to negotiate the freight price.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {request.truck.carrier.phone && (
                          <>
                            <a
                              href={`tel:${request.truck.carrier.phone}`}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              Call
                            </a>
                            <a
                              href={`sms:${request.truck.carrier.phone}`}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 text-sm font-medium transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              Message
                            </a>
                          </>
                        )}
                      </div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                        {request.truck.carrier.name} • {request.truck.carrier.phone || 'Contact via platform'}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

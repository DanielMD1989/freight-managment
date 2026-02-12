/**
 * Shipper Requests Client Component (Carrier View)
 *
 * Shows incoming truck booking requests from shippers
 * Carrier can accept or reject these requests
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
    cargoType: string;
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
    deliveryDate: string;
    shipper: {
      id: string;
      name: string;
      isVerified: boolean;
      phone?: string;
    } | null;
  };
  truck: {
    id: string;
    plateNumber: string;
    truckType: string;
    capacity: number;
  };
  requestedBy: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
}

interface Props {
  requests: TruckRequest[];
}

type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

export default function ShipperRequestsClient({ requests: initialRequests }: Props) {
  const router = useRouter();
  const [requests, setRequests] = useState<TruckRequest[]>(initialRequests);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [showResponseForm, setShowResponseForm] = useState<string | null>(null);

  const filteredRequests =
    statusFilter === 'all'
      ? requests
      : requests.filter((r) => r.status === statusFilter);

  const handleRespond = async (requestId: string, approve: boolean) => {
    setLoading(requestId);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/truck-requests/${requestId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(csrfToken && { 'X-CSRF-Token': csrfToken }) },
        body: JSON.stringify({
          action: approve ? 'APPROVE' : 'REJECT',
          responseNotes: responseNotes[requestId] || undefined,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to respond to request');
      }

      // Update local state
      setRequests(
        requests.map((r) =>
          r.id === requestId
            ? { ...r, status: approve ? 'APPROVED' : 'REJECTED', respondedAt: new Date().toISOString() }
            : r
        )
      );
      setShowResponseForm(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
      APPROVED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      REJECTED: 'bg-rose-50 text-rose-700 border border-rose-200',
      EXPIRED: 'bg-slate-50 text-slate-600 border border-slate-200',
      CANCELLED: 'bg-slate-50 text-slate-600 border border-slate-200',
    };
    return styles[status] || 'bg-slate-50 text-slate-600 border border-slate-200';
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

  const pendingCount = requests.filter((r) => r.status === 'PENDING').length;

  const statusCounts = {
    all: requests.length,
    PENDING: pendingCount,
    APPROVED: requests.filter((r) => r.status === 'APPROVED').length,
    REJECTED: requests.filter((r) => r.status === 'REJECTED').length,
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

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-yellow-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-yellow-800 dark:text-yellow-200 font-medium">
              You have {pendingCount} pending request{pendingCount > 1 ? 's' : ''} awaiting your
              response
            </span>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['PENDING', 'APPROVED', 'REJECTED', 'all'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              statusFilter === status
                ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {status === 'all' ? 'All' : status} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Requests</h3>
          <p className="text-slate-500">
            {statusFilter === 'all'
              ? "You haven't received any truck requests yet."
              : `No ${statusFilter.toLowerCase()} requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequests.map((request) => (
            <div
              key={request.id}
              className={`bg-white rounded-2xl shadow-sm border p-6 ${
                request.status === 'PENDING'
                  ? 'border-amber-300 ring-1 ring-amber-100'
                  : 'border-slate-200/60'
              }`}
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
                      <span className="text-sm text-orange-600 dark:text-orange-400 font-medium">
                        Expires in {getTimeRemaining(request.expiresAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#064d51]/60 dark:text-gray-400 mt-1">
                    Received {formatDate(request.createdAt)}
                  </p>
                </div>

                {/* Response Actions */}
                {request.status === 'PENDING' && (
                  <div className="flex gap-2">
                    {showResponseForm === request.id ? (
                      <button
                        onClick={() => setShowResponseForm(null)}
                        className="px-3 py-1 text-sm text-[#064d51]/70 border border-[#064d51]/15 rounded-lg hover:bg-[#f0fdfa]"
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRespond(request.id, false)}
                          disabled={loading === request.id}
                          className="px-4 py-2 text-sm text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50 disabled:opacity-50 font-medium transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleRespond(request.id, true)}
                          disabled={loading === request.id}
                          className="px-4 py-2 text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 font-medium shadow-md shadow-emerald-500/25 transition-all"
                        >
                          {loading === request.id ? 'Processing...' : 'Accept'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Response Form */}
              {showResponseForm === request.id && (
                <div className="mb-4 p-4 bg-[#f0fdfa] dark:bg-slate-700 rounded-lg">
                  <label className="block text-sm font-medium text-[#064d51]/80 dark:text-gray-300 mb-2">
                    Response Notes (Optional)
                  </label>
                  <textarea
                    value={responseNotes[request.id] || ''}
                    onChange={(e) =>
                      setResponseNotes({ ...responseNotes, [request.id]: e.target.value })
                    }
                    rows={2}
                    maxLength={500}
                    placeholder="Add any notes for the shipper..."
                    className="w-full px-3 py-2 border border-[#064d51]/20 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-[#1e9c99] dark:bg-slate-600 dark:text-white"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleRespond(request.id, false)}
                      disabled={loading === request.id}
                      className="px-4 py-2 text-sm text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleRespond(request.id, true)}
                      disabled={loading === request.id}
                      className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                    >
                      {loading === request.id ? 'Processing...' : 'Accept'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Load Info */}
                <div className="bg-[#f0fdfa] dark:bg-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-[#064d51]/80 dark:text-gray-300 mb-2">
                    Load Details
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-[#064d51] dark:text-white font-medium">
                      {request.load.referenceNumber || request.load.id.slice(-8)}
                    </p>
                    <p className="text-[#064d51]/70 dark:text-gray-400">
                      {request.load.pickupCity} → {request.load.deliveryCity}
                    </p>
                    <p className="text-[#064d51]/70 dark:text-gray-400">
                      {request.load.weight.toLocaleString()} kg • {request.load.truckType}
                    </p>
                    <p className="text-[#064d51]/70 dark:text-gray-400">
                      Cargo: {request.load.cargoType || 'General'}
                    </p>
                    <p className="text-[#064d51]/70 dark:text-gray-400">
                      Pickup: {new Date(request.load.pickupDate).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Shipper Info */}
                <div className="bg-[#1e9c99]/10 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-[#064d51] dark:text-blue-200 mb-2">
                    Shipper
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-[#064d51] dark:text-white font-medium">
                      {request.load.shipper?.name || 'Unknown'}
                      {request.load.shipper?.isVerified && (
                        <span className="ml-1 text-green-600">✓ Verified</span>
                      )}
                    </p>
                    {request.requestedBy && (
                      <>
                        <p className="text-[#064d51]/70 dark:text-gray-400">
                          Contact: {request.requestedBy.name}
                        </p>
                        <p className="text-[#064d51]/70 dark:text-gray-400">
                          {request.requestedBy.email}
                        </p>
                      </>
                    )}
                  </div>
                </div>

                {/* Truck Info */}
                <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                    Your Truck
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-[#064d51] dark:text-white font-medium">
                      {request.truck.plateNumber}
                    </p>
                    <p className="text-[#064d51]/70 dark:text-gray-400">
                      {request.truck.truckType}
                    </p>
                    <p className="text-[#064d51]/70 dark:text-gray-400">
                      Capacity: {request.truck.capacity.toLocaleString()} kg
                    </p>
                  </div>
                </div>
              </div>

              {/* Rate and Notes */}
              {(request.offeredRate || request.notes) && (
                <div className="mt-4 pt-4 border-t border-[#064d51]/15 dark:border-slate-700">
                  <div className="flex flex-wrap gap-4 text-sm">
                    {request.offeredRate && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 rounded-lg">
                        <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                          Offered Rate: {request.offeredRate.toLocaleString()} ETB
                        </span>
                      </div>
                    )}
                    {request.notes && (
                      <div className="flex-1">
                        <span className="text-[#064d51]/60 dark:text-gray-400">Notes:</span>{' '}
                        <span className="text-[#064d51] dark:text-white">{request.notes}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

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
                        Request approved! Contact the shipper directly to negotiate the freight price.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(request.load.shipper?.phone || request.requestedBy?.phone) && (
                          <>
                            <a
                              href={`tel:${request.load.shipper?.phone || request.requestedBy?.phone}`}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              Call
                            </a>
                            <a
                              href={`sms:${request.load.shipper?.phone || request.requestedBy?.phone}`}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 text-sm font-medium transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                              </svg>
                              Message
                            </a>
                          </>
                        )}
                        {request.requestedBy?.email && (
                          <a
                            href={`mailto:${request.requestedBy.email}`}
                            className="inline-flex items-center gap-2 px-4 py-2 bg-white text-emerald-700 border border-emerald-300 rounded-lg hover:bg-emerald-50 text-sm font-medium transition-colors"
                          >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            Email
                          </a>
                        )}
                      </div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                        {request.load.shipper?.name || 'Shipper'} • {request.load.shipper?.phone || request.requestedBy?.phone || request.requestedBy?.email || 'Contact via platform'}
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

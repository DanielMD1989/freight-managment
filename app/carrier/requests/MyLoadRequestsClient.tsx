/**
 * My Load Requests Client Component (Carrier View)
 *
 * Shows carrier's outgoing load requests to shippers
 * with status filtering and navigation to approved trips
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoadRequest {
  id: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
  responseNotes: string | null;
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
    rate: number | null;
  };
  truck: {
    id: string;
    plateNumber: string;
    truckType: string;
    capacity: number;
  };
  shipper: {
    id: string;
    name: string;
    isVerified: boolean;
    phone?: string;
  } | null;
  requestedBy: {
    id: string;
    name: string;
    email: string;
    phone?: string;
  } | null;
}

interface Props {
  requests: LoadRequest[];
}

type StatusFilter = 'all' | 'PENDING' | 'APPROVED' | 'REJECTED';

export default function MyLoadRequestsClient({ requests }: Props) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredRequests =
    statusFilter === 'all'
      ? requests
      : requests.filter((r) => r.status === statusFilter);

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

  const handleViewTrip = (loadId: string) => {
    router.push(`/carrier/trips/${loadId}`);
  };

  const statusCounts = {
    all: requests.length,
    PENDING: requests.filter((r) => r.status === 'PENDING').length,
    APPROVED: requests.filter((r) => r.status === 'APPROVED').length,
    REJECTED: requests.filter((r) => r.status === 'REJECTED').length,
  };

  const pendingCount = statusCounts.PENDING;
  const approvedCount = statusCounts.APPROVED;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{pendingCount}</div>
              <div className="text-sm text-slate-500">Pending Requests</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{approvedCount}</div>
              <div className="text-sm text-slate-500">Approved</div>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/60 shadow-sm p-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
            <div>
              <div className="text-2xl font-bold text-slate-800">{requests.length}</div>
              <div className="text-sm text-slate-500">Total Requests</div>
            </div>
          </div>
        </div>
      </div>

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
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Requests</h3>
          <p className="text-slate-500">
            {statusFilter === 'all'
              ? "You haven't sent any load requests yet. Browse available loads and click 'Request' to get started."
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
                  : request.status === 'APPROVED'
                  ? 'border-emerald-300 ring-1 ring-emerald-100'
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
                    {request.status === 'APPROVED' && (
                      <span className="text-sm text-green-600 dark:text-green-400 font-medium">
                        Ready to start trip
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#064d51]/60 dark:text-gray-400 mt-1">
                    Sent {formatDate(request.createdAt)}
                    {request.respondedAt && (
                      <span> | Responded {formatDate(request.respondedAt)}</span>
                    )}
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  {request.status === 'APPROVED' && (
                    <button
                      onClick={() => handleViewTrip(request.load.id)}
                      className="px-4 py-2 text-sm bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl hover:from-teal-700 hover:to-teal-600 font-medium shadow-md shadow-teal-500/25 transition-all"
                    >
                      View Trip
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Load Info */}
                <div className="bg-[#f0fdfa] dark:bg-slate-700 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-[#064d51]/80 dark:text-gray-300 mb-2">
                    Requested Load
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-[#064d51] dark:text-white font-medium">
                      {request.load.referenceNumber}
                    </p>
                    <p className="text-[#064d51]/70 dark:text-gray-400">
                      {request.load.pickupCity} → {request.load.deliveryCity}
                    </p>
                    <p className="text-[#064d51]/70 dark:text-gray-400">
                      {request.load.weight.toLocaleString()} kg • {request.load.truckType}
                    </p>
                    <p className="text-[#064d51]/70 dark:text-gray-400">
                      Pickup: {new Date(request.load.pickupDate).toLocaleDateString()}
                    </p>
                    {request.load.rate && (
                      <p className="text-green-600 dark:text-green-400 font-medium">
                        Rate: {request.load.rate.toLocaleString()} ETB
                      </p>
                    )}
                  </div>
                </div>

                {/* Shipper Info */}
                <div className="bg-[#1e9c99]/10 dark:bg-blue-900/20 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-[#064d51] dark:text-blue-200 mb-2">
                    Shipper
                  </h3>
                  <div className="space-y-1 text-sm">
                    {request.shipper ? (
                      <>
                        <p className="text-[#064d51] dark:text-white font-medium">
                          {request.shipper.name}
                          {request.shipper.isVerified && (
                            <span className="ml-1 text-green-600">✓ Verified</span>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="text-[#064d51]/60 dark:text-gray-400">
                        Shipper info hidden
                      </p>
                    )}
                  </div>
                </div>

                {/* Your Truck Info */}
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

              {/* Rate, Notes, and Response */}
              {(request.proposedRate || request.notes || request.responseNotes) && (
                <div className="mt-4 pt-4 border-t border-[#064d51]/15 dark:border-slate-700">
                  <div className="flex flex-wrap gap-4 text-sm">
                    {request.proposedRate && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/20 px-3 py-2 rounded-lg">
                        <span className="text-yellow-800 dark:text-yellow-200 font-medium">
                          Your Proposed Rate: {request.proposedRate.toLocaleString()} ETB
                        </span>
                      </div>
                    )}
                    {request.notes && (
                      <div className="flex-1">
                        <span className="text-[#064d51]/60 dark:text-gray-400">Your Notes:</span>{' '}
                        <span className="text-[#064d51] dark:text-white">{request.notes}</span>
                      </div>
                    )}
                  </div>
                  {request.responseNotes && (
                    <div className="mt-2 p-3 bg-gray-50 dark:bg-slate-700 rounded-lg">
                      <span className="text-[#064d51]/60 dark:text-gray-400">Shipper Response:</span>{' '}
                      <span className="text-[#064d51] dark:text-white">{request.responseNotes}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Rejection Reason */}
              {request.status === 'REJECTED' && request.responseNotes && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <span className="text-red-800 dark:text-red-200 font-medium">Rejection Reason: </span>
                  <span className="text-red-700 dark:text-red-300">{request.responseNotes}</span>
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
                        {request.shipper?.phone && (
                          <>
                            <a
                              href={`tel:${request.shipper.phone}`}
                              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                              </svg>
                              Call
                            </a>
                            <a
                              href={`sms:${request.shipper.phone}`}
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
                        {request.shipper?.name || 'Shipper'} • {request.shipper?.phone || request.requestedBy?.email || 'Contact via platform'}
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

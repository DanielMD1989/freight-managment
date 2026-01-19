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
  } | null;
  requestedBy: {
    id: string;
    name: string;
    email: string;
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
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
      EXPIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
      CANCELLED: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
    };
    return styles[status] || 'bg-gray-100 text-gray-800';
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
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-yellow-800 dark:text-yellow-200">
            {pendingCount}
          </div>
          <div className="text-sm text-yellow-600 dark:text-yellow-400">Pending Requests</div>
        </div>
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-2xl font-bold text-green-800 dark:text-green-200">
            {approvedCount}
          </div>
          <div className="text-sm text-green-600 dark:text-green-400">Approved</div>
        </div>
        <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
          <div className="text-2xl font-bold text-gray-800 dark:text-gray-200">
            {requests.length}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-400">Total Requests</div>
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['PENDING', 'APPROVED', 'REJECTED', 'all'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
              statusFilter === status
                ? 'bg-[#1e9c99] text-white'
                : 'bg-[#064d51]/10 dark:bg-slate-700 text-[#064d51]/80 dark:text-gray-300 hover:bg-[#064d51]/20 dark:hover:bg-slate-600'
            }`}
          >
            {status === 'all' ? 'All' : status} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {/* Requests List */}
      {filteredRequests.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow border border-[#064d51]/15 dark:border-slate-700 p-8 text-center">
          <p className="text-[#064d51]/60 dark:text-gray-400">
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
              className={`bg-white dark:bg-slate-800 rounded-lg shadow border ${
                request.status === 'PENDING'
                  ? 'border-yellow-300 dark:border-yellow-700'
                  : request.status === 'APPROVED'
                  ? 'border-green-300 dark:border-green-700'
                  : 'border-[#064d51]/15 dark:border-slate-700'
              } p-6`}
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
                      className="px-4 py-2 text-sm bg-[#1e9c99] text-white rounded-lg hover:bg-[#064d51]"
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

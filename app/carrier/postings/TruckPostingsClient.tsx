'use client';

/**
 * Truck Postings Client Component
 *
 * Interactive truck postings list with filtering
 * Sprint 12 - Story 12.3: Truck Posting
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

interface TruckPosting {
  id: string;
  status: string;
  availableFrom: string;
  availableTo: string | null;
  fullPartial: string;
  contactName: string;
  contactPhone: string;
  notes: string | null;
  postedAt: string;
  truck: {
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  originCity: {
    name: string;
    region: string;
  };
  destinationCity: {
    name: string;
    region: string;
  } | null;
  carrier: {
    name: string;
    isVerified: boolean;
  };
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Status' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-green-100 text-green-800',
    MATCHED: 'bg-blue-100 text-blue-800',
    EXPIRED: 'bg-gray-100 text-gray-800',
    CANCELLED: 'bg-red-100 text-red-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export default function TruckPostingsClient({
  initialPostings,
  total,
}: {
  initialPostings: TruckPosting[];
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [postings] = useState<TruckPosting[]>(initialPostings);
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('status') || 'all'
  );

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
    router.push(`/carrier/postings?${params.toString()}`);
  };

  return (
    <div className="space-y-6">
      {/* Filters and Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={statusFilter}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Create Posting Button */}
          <Link
            href="/carrier/postings/create"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-center"
          >
            + Create Posting
          </Link>
        </div>
      </div>

      {/* Postings List */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            All Postings ({total})
          </h2>
        </div>

        {postings.length > 0 ? (
          <div className="divide-y divide-gray-200">
            {postings.map((posting) => (
              <div key={posting.id} className="p-6 hover:bg-gray-50">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {posting.truck.licensePlate}
                      </h3>
                      <span
                        className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(
                          posting.status
                        )}`}
                      >
                        {posting.status}
                      </span>
                      {posting.fullPartial === 'PARTIAL' && (
                        <span className="px-2 py-1 text-xs font-semibold bg-purple-100 text-purple-800 rounded-full">
                          PARTIAL LOAD
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">
                      {posting.truck.truckType.replace(/_/g, ' ')} •{' '}
                      {posting.truck.capacity.toLocaleString()} kg
                    </div>
                  </div>
                </div>

                {/* Route */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900">
                      {posting.originCity.name}
                    </span>
                    <span className="text-gray-400">→</span>
                    <span className="font-medium text-gray-900">
                      {posting.destinationCity?.name || 'Any Destination'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    {posting.originCity.region}
                    {posting.destinationCity &&
                      ` → ${posting.destinationCity.region}`}
                  </div>
                </div>

                {/* Availability */}
                <div className="mb-4">
                  <div className="text-sm text-gray-700">
                    <strong>Available:</strong>{' '}
                    {formatDate(posting.availableFrom)}
                    {posting.availableTo &&
                      ` - ${formatDate(posting.availableTo)}`}
                  </div>
                </div>

                {/* Contact */}
                <div className="mb-4">
                  <div className="text-sm text-gray-700">
                    <strong>Contact:</strong> {posting.contactName} •{' '}
                    {posting.contactPhone}
                  </div>
                </div>

                {/* Notes */}
                {posting.notes && (
                  <div className="mb-4 p-3 bg-gray-50 rounded">
                    <div className="text-xs text-gray-500 mb-1">Notes:</div>
                    <div className="text-sm text-gray-700">{posting.notes}</div>
                  </div>
                )}

                {/* Meta */}
                <div className="text-xs text-gray-500 mb-4">
                  Posted: {formatDate(posting.postedAt)}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Link
                    href={`/carrier/postings/${posting.id}`}
                    className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 font-medium"
                  >
                    View Details
                  </Link>
                  {posting.status === 'ACTIVE' && (
                    <>
                      <Link
                        href={`/carrier/postings/${posting.id}/matches`}
                        className="px-4 py-2 text-sm text-green-600 border border-green-600 rounded-lg hover:bg-green-50 font-medium"
                      >
                        View Matches
                      </Link>
                      <button className="px-4 py-2 text-sm text-red-600 border border-red-300 rounded-lg hover:bg-red-50 font-medium">
                        Cancel
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="px-6 py-12 text-center">
            <div className="text-6xl mb-4">📍</div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Truck Postings Yet
            </h3>
            <p className="text-gray-600 mb-6">
              Create your first posting to make your trucks available for loads.
            </p>
            <Link
              href="/carrier/postings/create"
              className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
            >
              Create Your First Posting
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

'use client';

/**
 * Truck Postings Client Component
 *
 * Interactive truck postings list with filtering
 * Sprint 12 - Story 12.3: Truck Posting
 * Sprint 20 - UI/UX Redesign to match shipper styling
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
  { value: 'all', label: 'All Postings' },
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

function formatShortDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
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

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    ACTIVE: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    MATCHED: 'bg-indigo-50 text-indigo-700 border border-indigo-200',
    EXPIRED: 'bg-slate-50 text-slate-600 border border-slate-200',
    CANCELLED: 'bg-rose-50 text-rose-700 border border-rose-200',
  };
  return colors[status] || 'bg-slate-50 text-slate-600 border border-slate-200';
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

          {/* Summary Stats & Create Button */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500">Total:</span>
              <span className="text-xl font-bold text-slate-800">{total}</span>
              <span className="text-sm text-slate-500">postings</span>
            </div>
            <Link
              href="/carrier/postings/create"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl font-medium hover:from-teal-700 hover:to-teal-600 transition-all shadow-md shadow-teal-500/25"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Posting
            </Link>
          </div>
        </div>
      </div>

      {/* Postings Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        {postings.length > 0 ? (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-gradient-to-r from-teal-600 to-teal-500">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Age
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Truck
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Route
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Available
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Type
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {postings.map((posting) => (
                    <tr key={posting.id} className="hover:bg-slate-50 transition-colors">
                      {/* Age */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-2 py-1 text-xs font-semibold rounded ${getAgeColor(posting.postedAt)}`}>
                          {calculateAge(posting.postedAt)}
                        </span>
                      </td>

                      {/* Truck */}
                      <td className="px-4 py-4">
                        <div className="font-semibold text-slate-800">
                          {posting.truck.licensePlate}
                        </div>
                        <div className="text-xs text-slate-500">
                          {posting.truck.truckType.replace(/_/g, ' ')} • {posting.truck.capacity.toLocaleString()} kg
                        </div>
                      </td>

                      {/* Route */}
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2 text-sm">
                          <span className="font-medium text-slate-800">{posting.originCity.name}</span>
                          <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                          </svg>
                          <span className="font-medium text-slate-800">
                            {posting.destinationCity?.name || 'Any'}
                          </span>
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">
                          {posting.originCity.region}
                          {posting.destinationCity && ` → ${posting.destinationCity.region}`}
                        </div>
                      </td>

                      {/* Available */}
                      <td className="px-4 py-4">
                        <div className="text-sm text-slate-700">
                          {formatShortDate(posting.availableFrom)}
                        </div>
                        {posting.availableTo && (
                          <div className="text-xs text-slate-400">
                            to {formatShortDate(posting.availableTo)}
                          </div>
                        )}
                      </td>

                      {/* Type */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        {posting.fullPartial === 'PARTIAL' ? (
                          <span className="px-2.5 py-1 text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 rounded-lg">
                            Partial
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-200 rounded-lg">
                            Full
                          </span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="px-4 py-4 whitespace-nowrap">
                        <span className={`px-3 py-1 inline-flex text-xs leading-5 font-medium rounded-full ${getStatusColor(posting.status)}`}>
                          {posting.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex gap-3">
                          <Link
                            href={`/carrier/postings/${posting.id}`}
                            className="text-teal-600 hover:text-teal-700 font-medium transition-colors"
                          >
                            View
                          </Link>
                          {posting.status === 'ACTIVE' && (
                            <>
                              <Link
                                href={`/carrier/postings/${posting.id}/matches`}
                                className="text-emerald-600 hover:text-emerald-700 font-medium transition-colors"
                              >
                                Matches
                              </Link>
                              <button className="text-rose-600 hover:text-rose-700 font-medium transition-colors">
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-slate-100">
              {postings.map((posting) => (
                <div key={posting.id} className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-slate-800">
                          {posting.truck.licensePlate}
                        </span>
                        <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getAgeColor(posting.postedAt)}`}>
                          {calculateAge(posting.postedAt)}
                        </span>
                      </div>
                      <div className="text-sm text-slate-600">
                        {posting.truck.truckType.replace(/_/g, ' ')} • {posting.truck.capacity.toLocaleString()} kg
                      </div>
                    </div>
                    <span className={`px-2.5 py-1 text-xs font-semibold rounded-full ${getStatusColor(posting.status)}`}>
                      {posting.status}
                    </span>
                  </div>

                  {/* Route */}
                  <div className="mb-3 flex items-center gap-2 text-sm">
                    <span className="font-medium text-slate-700">{posting.originCity.name}</span>
                    <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                    </svg>
                    <span className="font-medium text-slate-700">
                      {posting.destinationCity?.name || 'Any Destination'}
                    </span>
                  </div>

                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <div className="text-slate-500">Available From</div>
                      <div className="font-medium text-slate-700">{formatShortDate(posting.availableFrom)}</div>
                    </div>
                    <div>
                      <div className="text-slate-500">Load Type</div>
                      <div className="font-medium text-slate-700">
                        {posting.fullPartial === 'PARTIAL' ? 'Partial Load' : 'Full Load'}
                      </div>
                    </div>
                  </div>

                  {/* Contact */}
                  <div className="text-sm text-slate-600 mb-3">
                    <span className="text-slate-500">Contact:</span> {posting.contactName} • {posting.contactPhone}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2">
                    <Link
                      href={`/carrier/postings/${posting.id}`}
                      className="flex-1 px-4 py-2 text-sm text-teal-600 border border-teal-200 rounded-xl hover:bg-teal-50 text-center font-medium transition-colors"
                    >
                      View
                    </Link>
                    {posting.status === 'ACTIVE' && (
                      <>
                        <Link
                          href={`/carrier/postings/${posting.id}/matches`}
                          className="flex-1 px-4 py-2 text-sm text-emerald-600 border border-emerald-200 rounded-xl hover:bg-emerald-50 text-center font-medium transition-colors"
                        >
                          Matches
                        </Link>
                        <button className="flex-1 px-4 py-2 text-sm text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50 text-center font-medium transition-colors">
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="px-6 py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-slate-800 mb-2">
              No Truck Postings Yet
            </h3>
            <p className="text-slate-500 mb-6">
              Create your first posting to make your trucks available for loads.
            </p>
            <Link
              href="/carrier/postings/create"
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-teal-600 to-teal-500 text-white rounded-xl font-medium shadow-md shadow-teal-500/25 hover:shadow-lg hover:shadow-teal-500/30 transition-all"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Create Your First Posting
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

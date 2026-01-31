'use client';

/**
 * Truck Postings Client Component
 *
 * Interactive truck postings list with filtering and matching loads view
 * Sprint 12 - Story 12.3: Truck Posting
 * Sprint 20 - UI/UX Redesign to match shipper styling
 * Sprint 21 - Tab navigation with matching loads integration
 */

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

// ============================================================================
// TYPES (unchanged TruckPosting + new MatchingLoad)
// ============================================================================

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

interface MatchingLoad {
  load: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    weight: number;
    cargoDescription: string | null;
    truckType: string | null;
    pickupDate: string;
    createdAt: string;
    shipper: {
      name: string;
      isVerified: boolean;
    };
  };
  dhToOriginKm: number;
  dhAfterDeliveryKm: number;
  matchScore: number;
  serviceFeeEtb?: number;
}

// ============================================================================
// CONSTANTS (unchanged)
// ============================================================================

const STATUS_OPTIONS = [
  { value: 'all', label: 'All Postings' },
  { value: 'ACTIVE', label: 'Active' },
  { value: 'MATCHED', label: 'Matched' },
  { value: 'EXPIRED', label: 'Expired' },
  { value: 'CANCELLED', label: 'Cancelled' },
];

// ============================================================================
// HELPER FUNCTIONS (unchanged)
// ============================================================================

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

/**
 * Get DH (deadhead) color based on distance
 */
function getDhColor(km: number): string {
  if (km < 30) return 'text-emerald-600 bg-emerald-50';
  if (km < 80) return 'text-amber-600 bg-amber-50';
  return 'text-rose-600 bg-rose-50';
}

/**
 * Get match score color based on percentage
 */
function getMatchScoreColor(score: number): string {
  if (score >= 80) return 'bg-emerald-500';
  if (score >= 60) return 'bg-teal-500';
  if (score >= 40) return 'bg-amber-500';
  return 'bg-rose-500';
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function TruckPostingsClient({
  initialPostings,
  total,
}: {
  initialPostings: TruckPosting[];
  total: number;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Existing state (unchanged)
  const [postings] = useState<TruckPosting[]>(initialPostings);
  const [statusFilter, setStatusFilter] = useState(
    searchParams.get('status') || 'all'
  );

  // NEW: Tab navigation state (UI only)
  const [activeTab, setActiveTab] = useState<'postings' | 'matches'>('postings');
  const [selectedTruck, setSelectedTruck] = useState<TruckPosting | null>(null);
  const [matchingLoads, setMatchingLoads] = useState<MatchingLoad[]>([]);
  const [loadingMatches, setLoadingMatches] = useState(false);
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});

  /**
   * Handle status filter change (unchanged)
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

  /**
   * NEW: Fetch matching loads for a truck posting
   * Uses EXISTING API endpoint - no changes to API
   */
  const handleViewMatches = async (posting: TruckPosting) => {
    setSelectedTruck(posting);
    setActiveTab('matches');
    setLoadingMatches(true);

    try {
      const response = await fetch(`/api/truck-postings/${posting.id}/matching-loads?limit=50`);
      if (response.ok) {
        const data = await response.json();
        setMatchingLoads(data.matches || []);
        // Cache the count
        setMatchCounts(prev => ({ ...prev, [posting.id]: data.matches?.length || 0 }));
      } else {
        setMatchingLoads([]);
      }
    } catch (error) {
      console.error('Failed to fetch matching loads:', error);
      setMatchingLoads([]);
    } finally {
      setLoadingMatches(false);
    }
  };

  /**
   * NEW: Go back to postings tab
   */
  const handleBackToPostings = () => {
    setActiveTab('postings');
    setSelectedTruck(null);
    setMatchingLoads([]);
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
        <div className="border-b border-slate-200">
          <div className="flex">
            <button
              onClick={handleBackToPostings}
              className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'postings'
                  ? 'text-teal-600 border-teal-600 bg-teal-50/50'
                  : 'text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                My Postings
              </span>
            </button>
            <button
              className={`px-6 py-4 text-sm font-semibold transition-all border-b-2 ${
                activeTab === 'matches'
                  ? 'text-teal-600 border-teal-600 bg-teal-50/50'
                  : 'text-slate-400 border-transparent cursor-not-allowed'
              }`}
              disabled={activeTab !== 'matches'}
            >
              <span className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Matching Loads
                {selectedTruck && (
                  <span className="ml-1 px-2 py-0.5 text-xs bg-teal-100 text-teal-700 rounded-full">
                    {matchingLoads.length}
                  </span>
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'postings' ? (
          <PostingsTabContent
            postings={postings}
            total={total}
            statusFilter={statusFilter}
            matchCounts={matchCounts}
            onStatusChange={handleStatusChange}
            onViewMatches={handleViewMatches}
          />
        ) : (
          <MatchingLoadsTabContent
            selectedTruck={selectedTruck}
            matchingLoads={matchingLoads}
            loading={loadingMatches}
            onBack={handleBackToPostings}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================================
// POSTINGS TAB CONTENT (refactored from original, adds Matches column)
// ============================================================================

function PostingsTabContent({
  postings,
  total,
  statusFilter,
  matchCounts,
  onStatusChange,
  onViewMatches,
}: {
  postings: TruckPosting[];
  total: number;
  statusFilter: string;
  matchCounts: Record<string, number>;
  onStatusChange: (status: string) => void;
  onViewMatches: (posting: TruckPosting) => void;
}) {
  return (
    <>
      {/* Filters */}
      <div className="p-6 border-b border-slate-100">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          {/* Status Filter Tabs */}
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => onStatusChange(option.value)}
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
                    Matches
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

                    {/* Matches - NEW COLUMN */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {posting.status === 'ACTIVE' ? (
                        <button
                          onClick={() => onViewMatches(posting)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors"
                        >
                          {matchCounts[posting.id] !== undefined ? (
                            <>
                              {matchCounts[posting.id]}
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </>
                          ) : (
                            <>
                              View
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
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
                          <button className="text-rose-600 hover:text-rose-700 font-medium transition-colors">
                            Cancel
                          </button>
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
                      <button
                        onClick={() => onViewMatches(posting)}
                        className="flex-1 px-4 py-2 text-sm text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 text-center font-medium transition-colors"
                      >
                        Matches
                      </button>
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
    </>
  );
}

// ============================================================================
// MATCHING LOADS TAB CONTENT (NEW)
// ============================================================================

function MatchingLoadsTabContent({
  selectedTruck,
  matchingLoads,
  loading,
  onBack,
}: {
  selectedTruck: TruckPosting | null;
  matchingLoads: MatchingLoad[];
  loading: boolean;
  onBack: () => void;
}) {
  if (!selectedTruck) {
    return (
      <div className="p-6 text-center">
        <p className="text-slate-500">Select a truck posting to view matching loads.</p>
      </div>
    );
  }

  return (
    <>
      {/* Header with truck info */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>
            <div className="h-8 w-px bg-slate-200" />
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </div>
              <div>
                <div className="font-semibold text-slate-800">
                  {selectedTruck.truck.licensePlate} • {selectedTruck.truck.truckType.replace(/_/g, ' ')}
                </div>
                <div className="text-sm text-slate-500">
                  {selectedTruck.originCity.name} → {selectedTruck.destinationCity?.name || 'Any Destination'}
                </div>
              </div>
            </div>
          </div>
          <div className="text-sm text-slate-500">
            {matchingLoads.length} matching load{matchingLoads.length !== 1 ? 's' : ''} found
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading ? (
        <div className="p-12 text-center">
          <div className="inline-flex items-center gap-3 text-slate-600">
            <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Finding matching loads...
          </div>
        </div>
      ) : matchingLoads.length > 0 ? (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-gradient-to-r from-indigo-600 to-indigo-500">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Age
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Shipper
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Route
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Cargo
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Pickup
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    DH-O
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    DH-D
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Match
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Service Fee
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-100">
                {matchingLoads.map((match) => (
                  <tr key={match.load.id} className="hover:bg-slate-50 transition-colors">
                    {/* Age */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${getAgeColor(match.load.createdAt)}`}>
                        {calculateAge(match.load.createdAt)}
                      </span>
                    </td>

                    {/* Shipper */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-800">{match.load.shipper?.name || 'Unknown'}</span>
                        {match.load.shipper?.isVerified && (
                          <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </div>
                    </td>

                    {/* Route */}
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium text-slate-800">{match.load.pickupCity}</span>
                        <svg className="w-4 h-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                        <span className="font-medium text-slate-800">{match.load.deliveryCity}</span>
                      </div>
                      {match.load.cargoDescription && (
                        <div className="text-xs text-slate-400 mt-0.5 truncate max-w-[200px]">
                          {match.load.cargoDescription}
                        </div>
                      )}
                    </td>

                    {/* Cargo */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-slate-700">
                        {match.load.weight ? `${(match.load.weight / 1000).toFixed(1)}T` : '-'}
                      </div>
                      {match.load.truckType && (
                        <div className="text-xs text-slate-400">
                          {match.load.truckType.replace(/_/g, ' ')}
                        </div>
                      )}
                    </td>

                    {/* Pickup Date */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-700">
                        {match.load.pickupDate ? formatShortDate(match.load.pickupDate) : '-'}
                      </div>
                    </td>

                    {/* DH-O */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${getDhColor(match.dhToOriginKm)}`}>
                        {match.dhToOriginKm} km
                      </span>
                    </td>

                    {/* DH-D */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${getDhColor(match.dhAfterDeliveryKm)}`}>
                        {match.dhAfterDeliveryKm} km
                      </span>
                    </td>

                    {/* Match Score */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full ${getMatchScoreColor(match.matchScore)} transition-all`}
                            style={{ width: `${match.matchScore}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-slate-600">{match.matchScore}%</span>
                      </div>
                    </td>

                    {/* Service Fee */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      {match.serviceFeeEtb ? (
                        <div className="text-sm font-semibold text-emerald-600">
                          {match.serviceFeeEtb.toLocaleString()} ETB
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400">Contact to negotiate</div>
                      )}
                    </td>

                    {/* Action */}
                    <td className="px-4 py-4 whitespace-nowrap">
                      <Link
                        href={`/carrier/loads/${match.load.id}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-teal-50 text-teal-700 border border-teal-200 rounded-lg hover:bg-teal-100 transition-colors"
                      >
                        View Load
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-slate-100">
            {matchingLoads.map((match) => (
              <div key={match.load.id} className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-semibold text-slate-800">
                        {match.load.shipper?.name || 'Unknown Shipper'}
                      </span>
                      {match.load.shipper?.isVerified && (
                        <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                    <div className="text-sm text-slate-500">
                      {match.load.pickupCity} → {match.load.deliveryCity}
                    </div>
                  </div>
                  <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getAgeColor(match.load.createdAt)}`}>
                    {calculateAge(match.load.createdAt)}
                  </span>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                  <div>
                    <div className="text-slate-500 text-xs">DH-O</div>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getDhColor(match.dhToOriginKm)}`}>
                      {match.dhToOriginKm} km
                    </span>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">DH-D</div>
                    <span className={`px-2 py-0.5 text-xs font-semibold rounded ${getDhColor(match.dhAfterDeliveryKm)}`}>
                      {match.dhAfterDeliveryKm} km
                    </span>
                  </div>
                  <div>
                    <div className="text-slate-500 text-xs">Match</div>
                    <span className="font-semibold text-slate-700">{match.matchScore}%</span>
                  </div>
                </div>

                {/* Actions */}
                <Link
                  href={`/carrier/loads/${match.load.id}`}
                  className="block w-full px-4 py-2 text-sm text-teal-600 border border-teal-200 rounded-xl hover:bg-teal-50 text-center font-medium transition-colors"
                >
                  View Load Details
                </Link>
              </div>
            ))}
          </div>
        </>
      ) : (
        /* No Matches State */
        <div className="p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">
            No Matching Loads Found
          </h3>
          <p className="text-slate-500 mb-4">
            There are currently no loads that match your truck posting criteria.
          </p>
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to My Postings
          </button>
        </div>
      )}
    </>
  );
}

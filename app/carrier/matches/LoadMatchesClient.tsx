'use client';

/**
 * Load Matches Client Component
 *
 * Shows matching loads for carrier's truck postings
 * Sprint 12 - Story 12.4: Matching Loads View
 * Sprint 16 - Story 16.6: Anti-Bypass Detection Integration
 */

import { useState } from 'react';
import Link from 'next/link';
import PlatformBenefitsDisplay from '@/components/PlatformBenefitsDisplay';
import ReportBypassButton from '@/components/ReportBypassButton';
import { VerifiedBadgeWithLabel } from '@/components/VerifiedBadge';

interface TruckPosting {
  id: string;
  status: string;
  truck: {
    licensePlate: string;
    truckType: string;
  };
  originCity: {
    name: string;
  };
  destinationCity: {
    name: string;
  } | null;
}

interface LoadMatch {
  load: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
    deliveryDate: string;
    weight: number;
    rate: number;
    cargoDescription: string;
    status: string;
    shipper: {
      name: string;
      isVerified: boolean;
    };
    shipperContactName: string | null;
    shipperContactPhone: string | null;
  };
  matchScore: number;
  matchReasons: string[];
  distance: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 2,
  }).format(amount);
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-gray-600';
}

export default function LoadMatchesClient({
  truckPostings,
}: {
  truckPostings: TruckPosting[];
}) {
  const [selectedPosting, setSelectedPosting] = useState<string>('');
  const [matches, setMatches] = useState<LoadMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minScore, setMinScore] = useState(40);

  /**
   * Fetch matches for selected truck posting
   */
  const fetchMatches = async (postingId: string) => {
    setIsLoading(true);
    setMatches([]);
    setError(null);

    try {
      const response = await fetch(
        `/api/truck-postings/${postingId}/matching-loads?minScore=${minScore}&limit=50`
      );

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      } else {
        console.error('Failed to fetch matches');
        setError('Failed to load matching loads. Please try again.');
      }
    } catch (err) {
      console.error('Error fetching matches:', err);
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle truck posting selection
   */
  const handlePostingChange = (postingId: string) => {
    setSelectedPosting(postingId);
    if (postingId) {
      fetchMatches(postingId);
    } else {
      setMatches([]);
    }
  };

  /**
   * Handle min score change
   */
  const handleMinScoreChange = (score: number) => {
    setMinScore(score);
    if (selectedPosting) {
      fetchMatches(selectedPosting);
    }
  };

  return (
    <div className="space-y-6">
      {/* Platform Benefits Banner - Sprint 16: Story 16.6 */}
      <PlatformBenefitsDisplay variant="compact" />

      {truckPostings.length === 0 ? (
        /* No Postings */
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <div className="text-6xl mb-4">📦</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            No Active Truck Postings
          </h3>
          <p className="text-gray-600 mb-6">
            Create a truck posting to find matching loads.
          </p>
          <Link
            href="/carrier/loadboard"
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Create Posting
          </Link>
        </div>
      ) : (
        <>
          {/* Truck Posting Selector */}
          <div className="bg-white rounded-lg shadow p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Truck Posting Select */}
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Truck Posting
                </label>
                <select
                  value={selectedPosting}
                  onChange={(e) => handlePostingChange(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Choose a posting...</option>
                  {truckPostings.map((posting) => (
                    <option key={posting.id} value={posting.id}>
                      {posting.truck.licensePlate} •{' '}
                      {posting.truck.truckType.replace(/_/g, ' ')} •{' '}
                      {posting.originCity.name} →{' '}
                      {posting.destinationCity?.name || 'Any'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Min Score Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min Match Score: {minScore}%
                </label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="10"
                  value={minScore}
                  onChange={(e) => handleMinScoreChange(parseInt(e.target.value))}
                  className="w-full"
                />
              </div>
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="text-4xl mb-4">🔍</div>
              <p className="text-gray-600">Searching for matching loads...</p>
            </div>
          )}

          {/* Error State */}
          {error && !isLoading && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
              <div className="text-4xl mb-4">⚠️</div>
              <p className="text-red-800 font-medium mb-2">Unable to Load Matches</p>
              <p className="text-red-600 text-sm">{error}</p>
              <button
                onClick={() => selectedPosting && fetchMatches(selectedPosting)}
                className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm"
              >
                Try Again
              </button>
            </div>
          )}

          {/* Matches List */}
          {!isLoading && !error && selectedPosting && (
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">
                  Matching Loads ({matches.length})
                </h2>
              </div>

              {matches.length > 0 ? (
                <div className="divide-y divide-gray-200">
                  {matches.map((match, index) => (
                    <div
                      key={index}
                      className={`p-6 hover:bg-gray-50 ${
                        match.load.shipper.isVerified
                          ? 'bg-blue-50/30 border-l-4 border-l-blue-500'
                          : ''
                      }`}
                    >
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className="flex items-center gap-3 mb-2">
                            {/* Sprint 16: Story 16.5 - Priority indicator for verified */}
                            {match.load.shipper.isVerified && (
                              <svg
                                className="w-5 h-5 text-yellow-500 flex-shrink-0"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                              </svg>
                            )}
                            <h3 className="text-lg font-semibold text-gray-900">
                              {match.load.pickupCity} → {match.load.deliveryCity}
                            </h3>
                            <span
                              className={`text-2xl font-bold ${getScoreColor(
                                match.matchScore
                              )}`}
                            >
                              {Math.round(match.matchScore)}%
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <span className="font-medium">{match.load.shipper.name}</span>
                            {/* Sprint 16: Story 16.5 - Enhanced verified badge */}
                            <VerifiedBadgeWithLabel
                              isVerified={match.load.shipper.isVerified}
                              verifiedAt={null}
                              size="sm"
                            />
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-green-600">
                            {formatCurrency(match.load.rate)}
                          </div>
                          <div className="text-xs text-gray-500">
                            {match.distance.toFixed(0)} km
                          </div>
                        </div>
                      </div>

                      {/* Load Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <div className="text-xs text-gray-500">Pickup Date</div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(match.load.pickupDate)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Delivery Date</div>
                          <div className="text-sm font-medium text-gray-900">
                            {formatDate(match.load.deliveryDate)}
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Weight</div>
                          <div className="text-sm font-medium text-gray-900">
                            {match.load.weight.toLocaleString()} kg
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-gray-500">Status</div>
                          <div className="text-sm font-medium text-gray-900">
                            {match.load.status}
                          </div>
                        </div>
                      </div>

                      {/* Cargo Description */}
                      <div className="mb-4">
                        <div className="text-xs text-gray-500 mb-1">Cargo</div>
                        <div className="text-sm text-gray-900">
                          {match.load.cargoDescription}
                        </div>
                      </div>

                      {/* Match Reasons */}
                      {match.matchReasons && match.matchReasons.length > 0 && (
                        <div className="mb-4">
                          <div className="text-xs text-gray-500 mb-2">
                            Why this matches:
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {match.matchReasons.map((reason, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 text-xs bg-blue-50 text-blue-700 rounded"
                              >
                                {reason}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Contact Info */}
                      {match.load.shipperContactName &&
                        match.load.shipperContactPhone && (
                          <div className="mb-4 p-3 bg-gray-50 rounded">
                            <div className="text-xs text-gray-500 mb-1">
                              Contact
                            </div>
                            <div className="text-sm text-gray-900">
                              {match.load.shipperContactName} •{' '}
                              {match.load.shipperContactPhone}
                            </div>
                          </div>
                        )}

                      {/* Actions */}
                      <div className="flex gap-2 flex-wrap">
                        <Link
                          href={`/carrier/loads/${match.load.id}`}
                          className="px-4 py-2 text-sm text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 font-medium"
                        >
                          View Load Details
                        </Link>
                        {match.load.shipperContactPhone && (
                          <a
                            href={`tel:${match.load.shipperContactPhone}`}
                            className="px-4 py-2 text-sm text-green-600 border border-green-600 rounded-lg hover:bg-green-50 font-medium"
                          >
                            Call Shipper
                          </a>
                        )}
                        {/* Sprint 16: Story 16.6 - Report Bypass Button */}
                        {match.load.shipperContactName &&
                          match.load.shipperContactPhone && (
                            <ReportBypassButton
                              loadId={match.load.id}
                              onReported={() => fetchMatches(selectedPosting)}
                            />
                          )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="px-6 py-12 text-center">
                  <div className="text-4xl mb-4">📭</div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    No Matching Loads Found
                  </h3>
                  <p className="text-gray-600">
                    Try adjusting your minimum match score or create a new posting
                    with different criteria.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {!selectedPosting && !isLoading && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
              <h3 className="font-semibold text-blue-900 mb-2">
                How Load Matching Works
              </h3>
              <ul className="space-y-2 text-sm text-blue-800">
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    Select a truck posting above to see matching loads
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    Loads are scored based on route compatibility, timing, and
                    capacity
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    Adjust the minimum match score to filter results
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span>•</span>
                  <span>
                    Contact shippers directly to negotiate and book loads
                  </span>
                </li>
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}

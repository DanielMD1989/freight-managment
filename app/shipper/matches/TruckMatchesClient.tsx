'use client';

/**
 * Truck Matches Client Component
 *
 * View and interact with truck matches for loads
 * Sprint 11 - Story 11.4: Matching Trucks View
 * Updated: Task 6 - Manual Load ↔ Truck Matching
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { VerifiedBadgeWithLabel } from '@/components/VerifiedBadge';
import { toast } from 'react-hot-toast';

interface Load {
  id: string;
  pickupCity: string | null;
  deliveryCity: string | null;
  pickupDate: string;
  deliveryDate: string;
  truckType: string;
  weight: number;
  rate: number;
  status: string;
}

interface TruckMatch {
  truckPosting: {
    id: string;
    truck: {
      id: string;
      licensePlate: string;
      truckType: string;
      capacity: number;
      carrier: {
        id: string;
        name: string;
        isVerified: boolean;
      };
    };
    currentCity: string;
    destinationCity: string;
    availableFrom: string;
    availableUntil: string;
    preferredRate: number;
  };
  matchScore: number;
  matchReasons: string[];
  distanceMetrics: {
    tripKm: number;
    dhOriginKm: number;
    dhDestKm: number;
  };
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-ET', {
    style: 'currency',
    currency: 'ETB',
    minimumFractionDigits: 0,
  }).format(amount);
}

function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-blue-600';
  if (score >= 40) return 'text-yellow-600';
  return 'text-gray-600';
}

function getScoreBgColor(score: number): string {
  if (score >= 80) return 'bg-green-100';
  if (score >= 60) return 'bg-blue-100';
  if (score >= 40) return 'bg-yellow-100';
  return 'bg-gray-100';
}

export default function TruckMatchesClient({
  postedLoads,
  selectedLoadId,
}: {
  postedLoads: Load[];
  selectedLoadId?: string;
}) {
  const router = useRouter();

  const [currentLoadId, setCurrentLoadId] = useState(selectedLoadId || postedLoads[0]?.id);
  const [matches, setMatches] = useState<TruckMatch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [minScore, setMinScore] = useState(40);
  const [assigningTruckId, setAssigningTruckId] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState<{
    truckId: string;
    carrierName: string;
    licensePlate: string;
  } | null>(null);

  /**
   * Fetch truck matches for selected load
   */
  const fetchMatches = async (loadId: string) => {
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/loads/${loadId}/matching-trucks?minScore=${minScore}&limit=50`
      );

      if (response.ok) {
        const data = await response.json();
        setMatches(data.matches || []);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch matches');
        setMatches([]);
      }
    } catch (error) {
      console.error('Error fetching matches:', error);
      setError('Failed to fetch truck matches');
      setMatches([]);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handle load selection change
   */
  const handleLoadChange = (loadId: string) => {
    setCurrentLoadId(loadId);
    router.push(`/shipper/matches?loadId=${loadId}`);
  };

  /**
   * Handle truck assignment to load (Manual Matching)
   * Task 6: Load ↔ Truck Matching Control
   */
  const handleAssignTruck = async (truckId: string) => {
    if (!currentLoadId) return;

    setAssigningTruckId(truckId);
    setShowConfirmModal(null);

    try {
      const response = await fetch(`/api/loads/${currentLoadId}/assign`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ truckId }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || 'Truck matched successfully!');

        // Refresh matches list and redirect to load details
        router.push(`/shipper/loads?success=truck-matched`);
        router.refresh();
      } else {
        const errorData = await response.json();

        if (response.status === 409) {
          // Conflict - assignment issues
          toast.error(errorData.error || 'Assignment conflict detected');
          if (errorData.conflicts) {
            console.warn('Conflicts:', errorData.conflicts);
          }
        } else {
          toast.error(errorData.error || 'Failed to match truck');
        }
      }
    } catch (error) {
      console.error('Error assigning truck:', error);
      toast.error('An unexpected error occurred. Please try again.');
    } finally {
      setAssigningTruckId(null);
    }
  };

  /**
   * Fetch matches when load or minScore changes
   */
  useEffect(() => {
    if (currentLoadId) {
      fetchMatches(currentLoadId);
    }
  }, [currentLoadId, minScore]);

  const currentLoad = postedLoads.find((l) => l.id === currentLoadId);

  return (
    <div className="space-y-6">
      {/* Load Selection and Filters */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Load Selector */}
          <div>
            <label
              htmlFor="load"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Select Load
            </label>
            <select
              id="load"
              value={currentLoadId}
              onChange={(e) => handleLoadChange(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {postedLoads.map((load) => (
                <option key={load.id} value={load.id}>
                  {load.pickupCity} → {load.deliveryCity} ({formatDate(load.pickupDate)})
                </option>
              ))}
            </select>
          </div>

          {/* Min Score Filter */}
          <div>
            <label
              htmlFor="minScore"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Minimum Match Score: {minScore}%
            </label>
            <input
              type="range"
              id="minScore"
              min="0"
              max="100"
              step="10"
              value={minScore}
              onChange={(e) => setMinScore(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Any</span>
              <span>Good</span>
              <span>Excellent</span>
            </div>
          </div>
        </div>

        {/* Current Load Details */}
        {currentLoad && (
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-3">
              Load Details
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Route</div>
                <div className="font-medium text-gray-900">
                  {currentLoad.pickupCity} → {currentLoad.deliveryCity}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Truck Type</div>
                <div className="font-medium text-gray-900">
                  {currentLoad.truckType.replace(/_/g, ' ')}
                </div>
              </div>
              <div>
                <div className="text-gray-500">Weight</div>
                <div className="font-medium text-gray-900">
                  {currentLoad.weight.toLocaleString()} kg
                </div>
              </div>
              <div>
                <div className="text-gray-500">Your Rate</div>
                <div className="font-medium text-gray-900">
                  {formatCurrency(currentLoad.rate)}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Finding matching trucks...</p>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">{error}</p>
        </div>
      )}

      {/* Matches List */}
      {!isLoading && !error && (
        <>
          {matches.length > 0 ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">
                  {matches.length} Matching Truck{matches.length !== 1 ? 's' : ''} Found
                </h2>
                <button
                  onClick={() => fetchMatches(currentLoadId)}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                >
                  Refresh
                </button>
              </div>

              {matches.map((match) => (
                <div
                  key={match.truckPosting.id}
                  className={`rounded-lg shadow hover:shadow-md transition-shadow p-6 ${
                    match.truckPosting.truck.carrier.isVerified
                      ? 'bg-blue-50/30 border-2 border-blue-200'
                      : 'bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {/* Sprint 16: Story 16.5 - Priority indicator for verified carriers */}
                        {match.truckPosting.truck.carrier.isVerified && (
                          <svg
                            className="w-5 h-5 text-yellow-500 flex-shrink-0"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>
                        )}
                        <h3 className="text-lg font-semibold text-gray-900">
                          {match.truckPosting.truck.carrier.name}
                        </h3>
                        {/* Sprint 16: Story 16.5 - Enhanced verified badge */}
                        <VerifiedBadgeWithLabel
                          isVerified={match.truckPosting.truck.carrier.isVerified}
                          verifiedAt={null}
                          size="sm"
                        />
                      </div>
                      <p className="text-sm text-gray-600">
                        {match.truckPosting.truck.licensePlate} •{' '}
                        {match.truckPosting.truck.truckType.replace(/_/g, ' ')}
                      </p>
                    </div>
                    <div className="text-right">
                      <div
                        className={`text-3xl font-bold ${getScoreColor(
                          match.matchScore
                        )}`}
                      >
                        {match.matchScore}%
                      </div>
                      <div className="text-xs text-gray-500">Match Score</div>
                    </div>
                  </div>

                  {/* Match Details Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-gray-500">Current Location</div>
                      <div className="text-sm font-medium text-gray-900">
                        {match.truckPosting.currentCity}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Destination</div>
                      <div className="text-sm font-medium text-gray-900">
                        {match.truckPosting.destinationCity}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Capacity</div>
                      <div className="text-sm font-medium text-gray-900">
                        {match.truckPosting.truck.capacity.toLocaleString()} kg
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Preferred Rate</div>
                      <div className="text-sm font-medium text-gray-900">
                        {formatCurrency(match.truckPosting.preferredRate)}
                      </div>
                    </div>
                  </div>

                  {/* Distance Metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-4 p-3 bg-gray-50 rounded">
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Trip Distance</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {match.distanceMetrics.tripKm.toFixed(0)} km
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Deadhead to Pickup</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {match.distanceMetrics.dhOriginKm.toFixed(0)} km
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-xs text-gray-500">Deadhead from Delivery</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {match.distanceMetrics.dhDestKm.toFixed(0)} km
                      </div>
                    </div>
                  </div>

                  {/* Match Reasons */}
                  {match.matchReasons.length > 0 && (
                    <div className="mb-4">
                      <div className="text-xs font-medium text-gray-700 mb-2">
                        Why this match:
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {match.matchReasons.map((reason, idx) => (
                          <span
                            key={idx}
                            className={`px-2 py-1 ${getScoreBgColor(
                              match.matchScore
                            )} ${getScoreColor(
                              match.matchScore
                            )} rounded text-xs`}
                          >
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Availability */}
                  <div className="mb-4 text-sm text-gray-600">
                    Available: {formatDate(match.truckPosting.availableFrom)} to{' '}
                    {formatDate(match.truckPosting.availableUntil)}
                  </div>

                  {/* Actions - Task 6: Manual Matching UI */}
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        router.push(`/shipper/trucks/${match.truckPosting.truck.id}`)
                      }
                      className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() =>
                        setShowConfirmModal({
                          truckId: match.truckPosting.truck.id,
                          carrierName: match.truckPosting.truck.carrier.name,
                          licensePlate: match.truckPosting.truck.licensePlate,
                        })
                      }
                      disabled={assigningTruckId !== null}
                      className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      {assigningTruckId === match.truckPosting.truck.id ? (
                        <>
                          <span className="animate-spin">⟳</span>
                          Matching...
                        </>
                      ) : (
                        <>
                          <span>🤝</span>
                          Match Truck
                        </>
                      )}
                    </button>
                    <button
                      onClick={() =>
                        alert(
                          `Contact carrier functionality coming soon!\n\nCarrier: ${match.truckPosting.truck.carrier.name}\nTruck: ${match.truckPosting.truck.licensePlate}`
                        )
                      }
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Contact
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* No Matches */
            <div className="bg-white rounded-lg shadow p-12 text-center">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                No Matching Trucks Found
              </h3>
              <p className="text-gray-600 mb-4">
                There are no available trucks matching your load requirements with a
                score above {minScore}%.
              </p>
              <p className="text-sm text-gray-500">
                Try lowering the minimum match score or check back later for new
                postings.
              </p>
            </div>
          )}
        </>
      )}

      {/* Match Truck Confirmation Modal - Task 6 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Confirm Truck Match
            </h3>
            <p className="text-gray-600 mb-4">
              You are about to match this truck to your load:
            </p>
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="text-sm">
                <div className="font-medium text-gray-900">
                  {showConfirmModal.carrierName}
                </div>
                <div className="text-gray-600">
                  Truck: {showConfirmModal.licensePlate}
                </div>
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-6">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Once matched, the carrier will be notified and funds
                will be held in escrow. You can unassign later if needed.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirmModal(null)}
                disabled={assigningTruckId !== null}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAssignTruck(showConfirmModal.truckId)}
                disabled={assigningTruckId !== null}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {assigningTruckId ? (
                  <>
                    <span className="animate-spin">⟳</span>
                    Matching...
                  </>
                ) : (
                  'Confirm Match'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

/**
 * Truck Matches Client Component
 *
 * View and interact with truck matches for loads
 * Sprint 11 - Story 11.4: Matching Trucks View
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

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
                  className="bg-white rounded-lg shadow hover:shadow-md transition-shadow p-6"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {match.truckPosting.truck.carrier.name}
                        {match.truckPosting.truck.carrier.isVerified && (
                          <span className="ml-2 text-blue-600" title="Verified carrier">
                            ✓
                          </span>
                        )}
                      </h3>
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

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() =>
                        router.push(`/shipper/trucks/${match.truckPosting.truck.id}`)
                      }
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      View Details
                    </button>
                    <button
                      onClick={() =>
                        alert(
                          `Contact carrier functionality coming soon!\n\nCarrier: ${match.truckPosting.truck.carrier.name}\nTruck: ${match.truckPosting.truck.licensePlate}`
                        )
                      }
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                    >
                      Contact Carrier
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
    </div>
  );
}

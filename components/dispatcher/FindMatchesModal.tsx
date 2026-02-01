/**
 * Find Matches Modal Component
 *
 * Reusable modal for dispatchers to view matching trucks/loads
 * and propose matches directly from the results.
 *
 * Foundation Rule: DISPATCHER_COORDINATION_ONLY
 * - Dispatcher proposes, carrier approves
 */

'use client';

import { useState, useEffect } from 'react';
import { getCSRFToken } from '@/lib/csrfFetch';

interface MatchingTruck {
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
      };
      currentCity?: {
        name: string;
      };
    };
  };
  matchScore: number;
}

interface MatchingLoad {
  load: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    weight: number;
    truckType: string;
    pickupDate: string;
    shipper?: {
      name: string;
    };
  };
  matchScore: number;
}

interface FindMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'trucks' | 'loads';
  // For finding trucks for a load
  loadId?: string;
  loadDetails?: {
    pickupCity: string;
    deliveryCity: string;
    truckType: string;
    weight: number;
  };
  // For finding loads for a truck
  truckPostingId?: string;
  truckDetails?: {
    licensePlate: string;
    truckType: string;
    originCity: string;
    destinationCity: string;
  };
  truckId?: string; // Actual truck ID for proposals
  onProposalCreated?: () => void;
}

export default function FindMatchesModal({
  isOpen,
  onClose,
  type,
  loadId,
  loadDetails,
  truckPostingId,
  truckDetails,
  truckId,
  onProposalCreated,
}: FindMatchesModalProps) {
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposing, setProposing] = useState<string | null>(null);
  const [proposedIds, setProposedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      fetchMatches();
    }
  }, [isOpen, loadId, truckPostingId]);

  const fetchMatches = async () => {
    setLoading(true);
    setError(null);

    try {
      let url = '';
      if (type === 'trucks' && loadId) {
        url = `/api/loads/${loadId}/matching-trucks?minScore=0&limit=20`;
      } else if (type === 'loads' && truckPostingId) {
        url = `/api/truck-postings/${truckPostingId}/matching-loads?minScore=0&limit=20`;
      }

      if (!url) {
        throw new Error('Invalid modal configuration');
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error('Failed to fetch matches');
      }

      const data = await response.json();
      setMatches(data.matches || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load matches');
    } finally {
      setLoading(false);
    }
  };

  const handleProposeMatch = async (match: any) => {
    const matchLoadId = type === 'trucks' ? loadId : match.load?.id;
    const matchTruckId = type === 'trucks' ? match.truckPosting?.truck?.id : truckId;

    if (!matchLoadId || !matchTruckId) {
      setError('Missing load or truck ID');
      return;
    }

    setProposing(type === 'trucks' ? match.truckPosting?.id : match.load?.id);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch('/api/match-proposals', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
          loadId: matchLoadId,
          truckId: matchTruckId,
          notes: type === 'trucks'
            ? `Proposed for ${loadDetails?.pickupCity} → ${loadDetails?.deliveryCity}`
            : `Proposed for ${truckDetails?.originCity} → ${truckDetails?.destinationCity}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create proposal');
      }

      // Mark as proposed
      const proposedKey = type === 'trucks' ? match.truckPosting?.id : match.load?.id;
      setProposedIds(prev => new Set([...prev, proposedKey]));
      onProposalCreated?.();
    } catch (err: any) {
      setError(err.message || 'Failed to create proposal');
    } finally {
      setProposing(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-emerald-600 bg-emerald-50';
    if (score >= 60) return 'text-teal-600 bg-teal-50';
    if (score >= 40) return 'text-amber-600 bg-amber-50';
    return 'text-slate-600 bg-slate-50';
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                {type === 'trucks' ? 'Matching Trucks' : 'Matching Loads'}
              </h3>
              <p className="text-sm text-slate-500">
                {type === 'trucks' && loadDetails && (
                  <>For load: {loadDetails.pickupCity} → {loadDetails.deliveryCity}</>
                )}
                {type === 'loads' && truckDetails && (
                  <>For truck: {truckDetails.licensePlate} ({truckDetails.truckType})</>
                )}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <svg className="w-5 h-5 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
                <p className="mt-3 text-sm text-slate-500">Finding matches...</p>
              </div>
            ) : matches.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-slate-800">No Matches Found</h4>
                <p className="text-sm text-slate-500 mt-1">
                  {type === 'trucks'
                    ? 'No available trucks match this load criteria.'
                    : 'No available loads match this truck criteria.'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match, index) => {
                  const itemId = type === 'trucks' ? match.truckPosting?.id : match.load?.id;
                  const isProposed = proposedIds.has(itemId);
                  const isProposing = proposing === itemId;

                  return (
                    <div
                      key={index}
                      className={`border rounded-xl p-4 transition-colors ${
                        isProposed
                          ? 'border-emerald-300 bg-emerald-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {type === 'trucks' ? (
                            // Truck match card
                            <>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-semibold text-slate-800">
                                  {match.truckPosting?.truck?.licensePlate}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getScoreColor(match.matchScore)}`}>
                                  {Math.round(match.matchScore)}% match
                                </span>
                              </div>
                              <div className="text-sm text-slate-600 space-y-1">
                                <p>{match.truckPosting?.truck?.truckType} • {match.truckPosting?.truck?.capacity?.toLocaleString()} kg</p>
                                <p>Carrier: {match.truckPosting?.truck?.carrier?.name}</p>
                                <p>Location: {match.truckPosting?.truck?.currentCity?.name || 'N/A'}</p>
                              </div>
                            </>
                          ) : (
                            // Load match card
                            <>
                              <div className="flex items-center gap-3 mb-2">
                                <span className="font-semibold text-slate-800">
                                  {match.load?.pickupCity} → {match.load?.deliveryCity}
                                </span>
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getScoreColor(match.matchScore)}`}>
                                  {Math.round(match.matchScore)}% match
                                </span>
                              </div>
                              <div className="text-sm text-slate-600 space-y-1">
                                <p>{match.load?.truckType} • {match.load?.weight?.toLocaleString()} kg</p>
                                <p>Shipper: {match.load?.shipper?.name || 'Unknown'}</p>
                                <p>Pickup: {new Date(match.load?.pickupDate).toLocaleDateString()}</p>
                              </div>
                            </>
                          )}
                        </div>

                        <div className="ml-4">
                          {isProposed ? (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Proposed
                            </span>
                          ) : (
                            <button
                              onClick={() => handleProposeMatch(match)}
                              disabled={isProposing}
                              className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                              {isProposing ? 'Proposing...' : 'Propose Match'}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center">
            <p className="text-sm text-slate-500">
              {matches.length} match{matches.length !== 1 ? 'es' : ''} found
            </p>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

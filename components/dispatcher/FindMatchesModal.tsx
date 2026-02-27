/**
 * Find Matches Modal Component
 *
 * Reusable modal for dispatchers to view matching trucks/loads
 * and propose matches directly from the results.
 *
 * Foundation Rule: DISPATCHER_COORDINATION_ONLY
 * - Dispatcher proposes, carrier approves
 */

"use client";

import { useState, useEffect, useCallback } from "react";
import { getCSRFToken } from "@/lib/csrfFetch";

// H6 FIX: Define interfaces locally with discriminated union
interface TruckMatch {
  type: "truck";
  id: string;
  matchScore: number;
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  carrier?: {
    id: string;
    name: string;
  };
  originCity?: {
    name: string;
  };
  currentCity?: string;
}

interface LoadMatch {
  type: "load";
  matchScore: number;
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
}

type MatchResult = TruckMatch | LoadMatch;

// Type guard helpers
function isTruckMatch(match: MatchResult): match is TruckMatch {
  return match.type === "truck";
}

function isLoadMatch(match: MatchResult): match is LoadMatch {
  return match.type === "load";
}

interface FindMatchesModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "trucks" | "loads";
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
  // H6 FIX: Use proper typed matches
  const [matches, setMatches] = useState<MatchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [proposing, setProposing] = useState<string | null>(null);
  const [proposedIds, setProposedIds] = useState<Set<string>>(new Set());

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      let url = "";
      if (type === "trucks" && loadId) {
        url = `/api/loads/${loadId}/matching-trucks?minScore=0&limit=20`;
      } else if (type === "loads" && truckPostingId) {
        url = `/api/truck-postings/${truckPostingId}/matching-loads?minScore=0&limit=20`;
      }

      if (!url) {
        throw new Error("Invalid modal configuration");
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to fetch matches");
      }

      const data = await response.json();
      // H6 FIX: Add type discriminator to matches for proper typing
      // - matching-trucks returns { trucks: [...] }
      // - matching-loads returns { matches: [...] }
      const rawMatches = data.matches || data.trucks || [];
      const typedMatches: MatchResult[] = rawMatches.map(
        (m: Record<string, unknown>) => ({
          ...m,
          type: type === "trucks" ? "truck" : "load",
        })
      );
      setMatches(typedMatches);
      // H6 FIX: Use unknown type with type guard
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to load matches";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [type, loadId, truckPostingId]);

  useEffect(() => {
    if (isOpen) {
      fetchMatches();
    }
  }, [isOpen, loadId, truckPostingId, fetchMatches]);

  // H6 FIX: Use type guards for proper typing
  const handleProposeMatch = async (match: MatchResult) => {
    let matchLoadId: string | undefined;
    let matchTruckId: string | undefined;
    let proposingId: string | undefined;

    if (isTruckMatch(match)) {
      matchLoadId = loadId;
      matchTruckId = match.truck?.id;
      proposingId = match.id;
    } else if (isLoadMatch(match)) {
      matchLoadId = match.load?.id;
      matchTruckId = truckId;
      proposingId = match.load?.id;
    }

    if (!matchLoadId || !matchTruckId) {
      setError("Missing load or truck ID");
      return;
    }

    setProposing(proposingId || null);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/match-proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          loadId: matchLoadId,
          truckId: matchTruckId,
          notes:
            type === "trucks"
              ? `Proposed for ${loadDetails?.pickupCity} → ${loadDetails?.deliveryCity}`
              : `Proposed for ${truckDetails?.originCity} → ${truckDetails?.destinationCity}`,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to create proposal");
      }

      // Mark as proposed using the proposingId
      if (proposingId) {
        setProposedIds((prev) => new Set([...prev, proposingId]));
      }
      onProposalCreated?.();
      // H6 FIX: Use unknown type with type guard
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Failed to create proposal";
      setError(message);
    } finally {
      setProposing(null);
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 bg-emerald-50";
    if (score >= 60) return "text-teal-600 bg-teal-50";
    if (score >= 40) return "text-amber-600 bg-amber-50";
    return "text-slate-600 bg-slate-50";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-black/50" onClick={onClose} />

      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative flex max-h-[80vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-800">
                {type === "trucks" ? "Matching Trucks" : "Matching Loads"}
              </h3>
              <p className="text-sm text-slate-500">
                {type === "trucks" && loadDetails && (
                  <>
                    For load: {loadDetails.pickupCity} →{" "}
                    {loadDetails.deliveryCity}
                  </>
                )}
                {type === "loads" && truckDetails && (
                  <>
                    For truck: {truckDetails.licensePlate} (
                    {truckDetails.truckType})
                  </>
                )}
              </p>
            </div>
            {/* L1 FIX: Add aria-label for accessibility */}
            <button
              onClick={onClose}
              className="rounded-lg p-2 transition-colors hover:bg-slate-100"
              aria-label="Close modal"
            >
              <svg
                className="h-5 w-5 text-slate-500"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {error && (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {loading ? (
              <div className="py-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2 border-teal-500"></div>
                <p className="mt-3 text-sm text-slate-500">
                  Finding matches...
                </p>
              </div>
            ) : matches.length === 0 ? (
              <div className="py-12 text-center">
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                  <svg
                    className="h-8 w-8 text-slate-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h4 className="text-lg font-medium text-slate-800">
                  No Matches Found
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  {type === "trucks"
                    ? "No available trucks match this load criteria."
                    : "No available loads match this truck criteria."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {matches.map((match, index) => {
                  // H6 FIX: Use type guards for proper type checking
                  const itemId = isTruckMatch(match)
                    ? match.id
                    : isLoadMatch(match)
                      ? match.load?.id
                      : "";
                  const isProposed = itemId ? proposedIds.has(itemId) : false;
                  const isProposing = proposing === itemId;

                  return (
                    <div
                      key={index}
                      className={`rounded-xl border p-4 transition-colors ${
                        isProposed
                          ? "border-emerald-300 bg-emerald-50/50"
                          : "border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          {isTruckMatch(match) ? (
                            // Truck match card - API returns flat structure with truck nested
                            <>
                              <div className="mb-2 flex items-center gap-3">
                                <span className="font-semibold text-slate-800">
                                  {match.truck?.licensePlate}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${getScoreColor(match.matchScore)}`}
                                >
                                  {Math.round(match.matchScore)}% match
                                </span>
                              </div>
                              <div className="space-y-1 text-sm text-slate-600">
                                <p>
                                  {match.truck?.truckType} •{" "}
                                  {match.truck?.capacity?.toLocaleString()} kg
                                </p>
                                <p>Carrier: {match.carrier?.name}</p>
                                <p>
                                  Location:{" "}
                                  {match.originCity?.name ||
                                    match.currentCity ||
                                    "N/A"}
                                </p>
                              </div>
                            </>
                          ) : isLoadMatch(match) ? (
                            // Load match card
                            <>
                              <div className="mb-2 flex items-center gap-3">
                                <span className="font-semibold text-slate-800">
                                  {match.load?.pickupCity} →{" "}
                                  {match.load?.deliveryCity}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${getScoreColor(match.matchScore)}`}
                                >
                                  {Math.round(match.matchScore)}% match
                                </span>
                              </div>
                              <div className="space-y-1 text-sm text-slate-600">
                                <p>
                                  {match.load?.truckType} •{" "}
                                  {match.load?.weight?.toLocaleString()} kg
                                </p>
                                <p>
                                  Shipper:{" "}
                                  {match.load?.shipper?.name || "Unknown"}
                                </p>
                                <p>
                                  Pickup:{" "}
                                  {new Date(
                                    match.load?.pickupDate
                                  ).toLocaleDateString()}
                                </p>
                              </div>
                            </>
                          ) : null}
                        </div>

                        <div className="ml-4">
                          {isProposed ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-medium text-emerald-700">
                              <svg
                                className="h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                              Proposed
                            </span>
                          ) : (
                            <button
                              onClick={() => handleProposeMatch(match)}
                              disabled={isProposing}
                              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isProposing ? "Proposing..." : "Propose Match"}
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
          <div className="flex items-center justify-between border-t border-slate-200 px-6 py-4">
            <p className="text-sm text-slate-500">
              {matches.length} match{matches.length !== 1 ? "es" : ""} found
            </p>
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Match Proposals Client Component (Carrier View)
 *
 * Shows incoming match proposals from dispatchers
 * Carrier can accept or reject these proposals
 *
 * Foundation Rule: CARRIER_FINAL_AUTHORITY
 * - Only carrier can approve assignments to their trucks
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getCSRFToken } from "@/lib/csrfFetch";

interface MatchProposal {
  id: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  load: {
    id: string;
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
    weight: number;
    truckType: string;
    status: string;
  };
  truck: {
    id: string;
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  proposedBy: {
    name: string;
  } | null;
}

interface Props {
  proposals: MatchProposal[];
}

type StatusFilter = "all" | "PENDING" | "ACCEPTED" | "REJECTED";

export default function MatchProposalsClient({
  proposals: initialProposals,
}: Props) {
  const router = useRouter();
  const [proposals, setProposals] = useState<MatchProposal[]>(initialProposals);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("PENDING");
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>(
    {}
  );
  const [showResponseForm, setShowResponseForm] = useState<string | null>(null);

  const filteredProposals =
    statusFilter === "all"
      ? proposals
      : proposals.filter((p) => p.status === statusFilter);

  const handleRespond = async (proposalId: string, accept: boolean) => {
    setLoading(proposalId);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(
        `/api/match-proposals/${proposalId}/respond`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(csrfToken && { "X-CSRF-Token": csrfToken }),
          },
          body: JSON.stringify({
            action: accept ? "ACCEPT" : "REJECT",
            responseNotes: responseNotes[proposalId] || undefined,
          }),
          credentials: "include",
        }
      );

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to respond to proposal");
      }

      // Update local state
      setProposals(
        proposals.map((p) =>
          p.id === proposalId
            ? {
                ...p,
                status: accept ? "ACCEPTED" : "REJECTED",
                respondedAt: new Date().toISOString(),
              }
            : p
        )
      );
      setShowResponseForm(null);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: "bg-amber-50 text-amber-700 border border-amber-200",
      ACCEPTED: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      REJECTED: "bg-rose-50 text-rose-700 border border-rose-200",
      EXPIRED: "bg-slate-50 text-slate-600 border border-slate-200",
      CANCELLED: "bg-slate-50 text-slate-600 border border-slate-200",
    };
    return (
      styles[status] || "bg-slate-50 text-slate-600 border border-slate-200"
    );
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getTimeRemaining = (expiresAt: string) => {
    const now = new Date();
    const expiry = new Date(expiresAt);
    const diff = expiry.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days}d ${hours % 24}h`;
    }
    return `${hours}h ${minutes}m`;
  };

  const pendingCount = proposals.filter((p) => p.status === "PENDING").length;

  const statusCounts = {
    all: proposals.length,
    PENDING: pendingCount,
    ACCEPTED: proposals.filter((p) => p.status === "ACCEPTED").length,
    REJECTED: proposals.filter((p) => p.status === "REJECTED").length,
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-sm text-red-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-center gap-2">
            <svg
              className="h-5 w-5 text-amber-600"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="font-medium text-amber-800">
              {pendingCount} match proposal{pendingCount > 1 ? "s" : ""}{" "}
              awaiting your response
            </span>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(["PENDING", "ACCEPTED", "REJECTED", "all"] as StatusFilter[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`rounded-xl px-4 py-2 text-sm font-medium transition-all ${
                statusFilter === status
                  ? "bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25"
                  : "border border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100"
              }`}
            >
              {status === "all" ? "All" : status} ({statusCounts[status]})
            </button>
          )
        )}
      </div>

      {/* Proposals List */}
      {filteredProposals.length === 0 ? (
        <div className="rounded-2xl border border-slate-200/60 bg-white p-12 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
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
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
          </div>
          <h3 className="mb-2 text-lg font-semibold text-slate-800">
            No Match Proposals
          </h3>
          <p className="text-slate-500">
            {statusFilter === "all"
              ? "No dispatchers have proposed matches for your trucks yet."
              : `No ${statusFilter.toLowerCase()} proposals.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((proposal) => (
            <div
              key={proposal.id}
              className={`rounded-2xl border bg-white p-6 shadow-sm ${
                proposal.status === "PENDING"
                  ? "border-amber-300 ring-1 ring-amber-100"
                  : "border-slate-200/60"
              }`}
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${getStatusBadge(
                        proposal.status
                      )}`}
                    >
                      {proposal.status}
                    </span>
                    {proposal.status === "PENDING" && (
                      <span className="text-sm font-medium text-orange-600">
                        Expires in {getTimeRemaining(proposal.expiresAt)}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    Proposed {formatDate(proposal.createdAt)}
                    {proposal.proposedBy && ` by ${proposal.proposedBy.name}`}
                  </p>
                </div>

                {/* Response Actions */}
                {proposal.status === "PENDING" && (
                  <div className="flex gap-2">
                    {showResponseForm === proposal.id ? (
                      <button
                        onClick={() => setShowResponseForm(null)}
                        className="rounded-lg border border-slate-200 px-3 py-1 text-sm text-slate-600 hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRespond(proposal.id, false)}
                          disabled={loading === proposal.id}
                          className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 disabled:opacity-50"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleRespond(proposal.id, true)}
                          disabled={loading === proposal.id}
                          className="rounded-xl bg-gradient-to-r from-emerald-600 to-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-500/25 transition-all hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50"
                        >
                          {loading === proposal.id ? "Processing..." : "Accept"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Response Form */}
              {showResponseForm === proposal.id && (
                <div className="mb-4 rounded-lg bg-slate-50 p-4">
                  <label className="mb-2 block text-sm font-medium text-slate-700">
                    Response Notes (Optional)
                  </label>
                  <textarea
                    value={responseNotes[proposal.id] || ""}
                    onChange={(e) =>
                      setResponseNotes({
                        ...responseNotes,
                        [proposal.id]: e.target.value,
                      })
                    }
                    rows={2}
                    placeholder="Add any notes..."
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="mt-3 flex gap-2">
                    <button
                      onClick={() => handleRespond(proposal.id, false)}
                      disabled={loading === proposal.id}
                      className="rounded-lg border border-rose-200 px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleRespond(proposal.id, true)}
                      disabled={loading === proposal.id}
                      className="rounded-lg bg-emerald-600 px-4 py-2 text-sm text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {loading === proposal.id ? "Processing..." : "Accept"}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Load Info */}
                <div className="rounded-lg bg-slate-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-slate-500">
                    Load Details
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-lg font-medium text-slate-800">
                      {proposal.load.pickupCity} → {proposal.load.deliveryCity}
                    </p>
                    <p className="text-slate-600">
                      {proposal.load.weight?.toLocaleString()} kg •{" "}
                      {proposal.load.truckType}
                    </p>
                    <p className="text-slate-500">
                      Pickup:{" "}
                      {new Date(proposal.load.pickupDate).toLocaleDateString()}
                    </p>
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs ${
                        proposal.load.status === "POSTED"
                          ? "bg-blue-50 text-blue-700"
                          : proposal.load.status === "ASSIGNED"
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      Load: {proposal.load.status}
                    </span>
                  </div>
                </div>

                {/* Truck Info */}
                <div className="rounded-lg bg-teal-50 p-4">
                  <h3 className="mb-2 text-sm font-medium text-teal-700">
                    Your Truck
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-lg font-medium text-slate-800">
                      {proposal.truck.licensePlate}
                    </p>
                    <p className="text-slate-600">{proposal.truck.truckType}</p>
                    <p className="text-slate-500">
                      Capacity: {proposal.truck.capacity?.toLocaleString()} kg
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {proposal.notes && (
                <div className="mt-4 border-t border-slate-100 pt-4">
                  <p className="text-sm">
                    <span className="text-slate-500">Dispatcher notes:</span>{" "}
                    <span className="text-slate-700">{proposal.notes}</span>
                  </p>
                </div>
              )}

              {/* Accepted Message */}
              {proposal.status === "ACCEPTED" && (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100">
                      <svg
                        className="h-5 w-5 text-emerald-600"
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
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800">
                        Load Assigned!
                      </p>
                      <p className="text-sm text-emerald-700">
                        This load has been assigned to your truck. Check your
                        active trips.
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

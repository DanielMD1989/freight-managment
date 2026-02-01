/**
 * Match Proposals Client Component (Carrier View)
 *
 * Shows incoming match proposals from dispatchers
 * Carrier can accept or reject these proposals
 *
 * Foundation Rule: CARRIER_FINAL_AUTHORITY
 * - Only carrier can approve assignments to their trucks
 */

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCSRFToken } from '@/lib/csrfFetch';

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

type StatusFilter = 'all' | 'PENDING' | 'ACCEPTED' | 'REJECTED';

export default function MatchProposalsClient({ proposals: initialProposals }: Props) {
  const router = useRouter();
  const [proposals, setProposals] = useState<MatchProposal[]>(initialProposals);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('PENDING');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [responseNotes, setResponseNotes] = useState<Record<string, string>>({});
  const [showResponseForm, setShowResponseForm] = useState<string | null>(null);

  const filteredProposals =
    statusFilter === 'all'
      ? proposals
      : proposals.filter((p) => p.status === statusFilter);

  const handleRespond = async (proposalId: string, accept: boolean) => {
    setLoading(proposalId);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/match-proposals/${proposalId}/respond`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(csrfToken && { 'X-CSRF-Token': csrfToken }),
        },
        body: JSON.stringify({
          action: accept ? 'ACCEPT' : 'REJECT',
          responseNotes: responseNotes[proposalId] || undefined,
        }),
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to respond to proposal');
      }

      // Update local state
      setProposals(
        proposals.map((p) =>
          p.id === proposalId
            ? { ...p, status: accept ? 'ACCEPTED' : 'REJECTED', respondedAt: new Date().toISOString() }
            : p
        )
      );
      setShowResponseForm(null);
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      PENDING: 'bg-amber-50 text-amber-700 border border-amber-200',
      ACCEPTED: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      REJECTED: 'bg-rose-50 text-rose-700 border border-rose-200',
      EXPIRED: 'bg-slate-50 text-slate-600 border border-slate-200',
      CANCELLED: 'bg-slate-50 text-slate-600 border border-slate-200',
    };
    return styles[status] || 'bg-slate-50 text-slate-600 border border-slate-200';
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

  const pendingCount = proposals.filter((p) => p.status === 'PENDING').length;

  const statusCounts = {
    all: proposals.length,
    PENDING: pendingCount,
    ACCEPTED: proposals.filter((p) => p.status === 'ACCEPTED').length,
    REJECTED: proposals.filter((p) => p.status === 'REJECTED').length,
  };

  return (
    <div className="space-y-6">
      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-sm text-red-600 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Pending Alert */}
      {pendingCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
            <span className="text-amber-800 font-medium">
              {pendingCount} match proposal{pendingCount > 1 ? 's' : ''} awaiting your response
            </span>
          </div>
        </div>
      )}

      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['PENDING', 'ACCEPTED', 'REJECTED', 'all'] as StatusFilter[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 rounded-xl font-medium text-sm transition-all ${
              statusFilter === status
                ? 'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-md shadow-teal-500/25'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {status === 'all' ? 'All' : status} ({statusCounts[status]})
          </button>
        ))}
      </div>

      {/* Proposals List */}
      {filteredProposals.length === 0 ? (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 p-12 text-center">
          <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Match Proposals</h3>
          <p className="text-slate-500">
            {statusFilter === 'all'
              ? "No dispatchers have proposed matches for your trucks yet."
              : `No ${statusFilter.toLowerCase()} proposals.`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredProposals.map((proposal) => (
            <div
              key={proposal.id}
              className={`bg-white rounded-2xl shadow-sm border p-6 ${
                proposal.status === 'PENDING'
                  ? 'border-amber-300 ring-1 ring-amber-100'
                  : 'border-slate-200/60'
              }`}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadge(
                        proposal.status
                      )}`}
                    >
                      {proposal.status}
                    </span>
                    {proposal.status === 'PENDING' && (
                      <span className="text-sm text-orange-600 font-medium">
                        Expires in {getTimeRemaining(proposal.expiresAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-500 mt-1">
                    Proposed {formatDate(proposal.createdAt)}
                    {proposal.proposedBy && ` by ${proposal.proposedBy.name}`}
                  </p>
                </div>

                {/* Response Actions */}
                {proposal.status === 'PENDING' && (
                  <div className="flex gap-2">
                    {showResponseForm === proposal.id ? (
                      <button
                        onClick={() => setShowResponseForm(null)}
                        className="px-3 py-1 text-sm text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50"
                      >
                        Cancel
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => handleRespond(proposal.id, false)}
                          disabled={loading === proposal.id}
                          className="px-4 py-2 text-sm text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50 disabled:opacity-50 font-medium transition-colors"
                        >
                          Reject
                        </button>
                        <button
                          onClick={() => handleRespond(proposal.id, true)}
                          disabled={loading === proposal.id}
                          className="px-4 py-2 text-sm bg-gradient-to-r from-emerald-600 to-emerald-500 text-white rounded-xl hover:from-emerald-700 hover:to-emerald-600 disabled:opacity-50 font-medium shadow-md shadow-emerald-500/25 transition-all"
                        >
                          {loading === proposal.id ? 'Processing...' : 'Accept'}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Response Form */}
              {showResponseForm === proposal.id && (
                <div className="mb-4 p-4 bg-slate-50 rounded-lg">
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Response Notes (Optional)
                  </label>
                  <textarea
                    value={responseNotes[proposal.id] || ''}
                    onChange={(e) =>
                      setResponseNotes({ ...responseNotes, [proposal.id]: e.target.value })
                    }
                    rows={2}
                    placeholder="Add any notes..."
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-teal-500"
                  />
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => handleRespond(proposal.id, false)}
                      disabled={loading === proposal.id}
                      className="px-4 py-2 text-sm text-rose-600 border border-rose-200 rounded-lg hover:bg-rose-50 disabled:opacity-50"
                    >
                      Reject
                    </button>
                    <button
                      onClick={() => handleRespond(proposal.id, true)}
                      disabled={loading === proposal.id}
                      className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {loading === proposal.id ? 'Processing...' : 'Accept'}
                    </button>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Load Info */}
                <div className="bg-slate-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-slate-500 mb-2">
                    Load Details
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-800 font-medium text-lg">
                      {proposal.load.pickupCity} → {proposal.load.deliveryCity}
                    </p>
                    <p className="text-slate-600">
                      {proposal.load.weight?.toLocaleString()} kg • {proposal.load.truckType}
                    </p>
                    <p className="text-slate-500">
                      Pickup: {new Date(proposal.load.pickupDate).toLocaleDateString()}
                    </p>
                    <span className={`inline-flex px-2 py-0.5 text-xs rounded-full ${
                      proposal.load.status === 'POSTED'
                        ? 'bg-blue-50 text-blue-700'
                        : proposal.load.status === 'ASSIGNED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      Load: {proposal.load.status}
                    </span>
                  </div>
                </div>

                {/* Truck Info */}
                <div className="bg-teal-50 rounded-lg p-4">
                  <h3 className="text-sm font-medium text-teal-700 mb-2">
                    Your Truck
                  </h3>
                  <div className="space-y-1 text-sm">
                    <p className="text-slate-800 font-medium text-lg">
                      {proposal.truck.licensePlate}
                    </p>
                    <p className="text-slate-600">
                      {proposal.truck.truckType}
                    </p>
                    <p className="text-slate-500">
                      Capacity: {proposal.truck.capacity?.toLocaleString()} kg
                    </p>
                  </div>
                </div>
              </div>

              {/* Notes */}
              {proposal.notes && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <p className="text-sm">
                    <span className="text-slate-500">Dispatcher notes:</span>{' '}
                    <span className="text-slate-700">{proposal.notes}</span>
                  </p>
                </div>
              )}

              {/* Accepted Message */}
              {proposal.status === 'ACCEPTED' && (
                <div className="mt-4 p-4 bg-gradient-to-r from-emerald-50 to-teal-50 rounded-xl border border-emerald-200">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                      <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-semibold text-emerald-800">Load Assigned!</p>
                      <p className="text-sm text-emerald-700">
                        This load has been assigned to your truck. Check your active trips.
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

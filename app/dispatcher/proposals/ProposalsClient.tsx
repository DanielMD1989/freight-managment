/**
 * Dispatcher Proposals Client Component
 *
 * Shows all match proposals created by this dispatcher
 * Allows filtering by status and viewing proposal details
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';

interface MatchProposal {
  id: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  responseNotes: string | null;
  load: {
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string;
    weight: number;
    truckType: string;
    status: string;
  };
  truck: {
    licensePlate: string;
    truckType: string;
    capacity: number;
  };
  carrier: {
    name: string;
  };
}

interface Props {
  proposals: MatchProposal[];
}

type StatusFilter = 'all' | 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';

export default function ProposalsClient({ proposals: initialProposals }: Props) {
  const [proposals] = useState<MatchProposal[]>(initialProposals);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const filteredProposals =
    statusFilter === 'all'
      ? proposals
      : proposals.filter((p) => p.status === statusFilter);

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

  const statusCounts = {
    all: proposals.length,
    PENDING: proposals.filter((p) => p.status === 'PENDING').length,
    ACCEPTED: proposals.filter((p) => p.status === 'ACCEPTED').length,
    REJECTED: proposals.filter((p) => p.status === 'REJECTED').length,
    EXPIRED: proposals.filter((p) => p.status === 'EXPIRED' || p.status === 'CANCELLED').length,
  };

  return (
    <div className="space-y-6">
      {/* Status Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'] as StatusFilter[]).map((status) => (
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
          <div className="w-16 h-16 bg-gradient-to-br from-amber-100 to-amber-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-slate-800 mb-2">No Match Proposals</h3>
          <p className="text-slate-500 mb-4 max-w-md mx-auto">
            {statusFilter === 'all'
              ? "You haven't created any match proposals yet. Find loads or trucks and propose matches to carriers."
              : `No ${statusFilter.toLowerCase()} proposals at this time.`}
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/dispatcher/loads"
              className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              Find Loads
            </Link>
            <Link
              href="/dispatcher/trucks"
              className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 17h8M8 17a2 2 0 11-4 0 2 2 0 014 0zm8 0a2 2 0 104 0 2 2 0 00-4 0zM3 9h13a2 2 0 012 2v4H3V9zm13-4l4 4h-4V5z" />
              </svg>
              Find Trucks
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Load Route
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Truck
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Carrier
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Created
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    Expires
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredProposals.map((proposal) => (
                  <tr key={proposal.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-slate-800">
                          {proposal.load.pickupCity} → {proposal.load.deliveryCity}
                        </p>
                        <p className="text-sm text-slate-500">
                          {proposal.load.truckType} • {proposal.load.weight?.toLocaleString()} kg
                        </p>
                        <p className="text-xs text-slate-400">
                          Pickup: {new Date(proposal.load.pickupDate).toLocaleDateString()}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <div>
                        <p className="font-medium text-slate-800">{proposal.truck.licensePlate}</p>
                        <p className="text-sm text-slate-500">{proposal.truck.truckType}</p>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-slate-700">{proposal.carrier.name}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${getStatusBadge(proposal.status)}`}>
                        {proposal.status}
                      </span>
                      {proposal.status === 'REJECTED' && proposal.responseNotes && (
                        <p className="text-xs text-rose-600 mt-1 max-w-[150px] truncate" title={proposal.responseNotes}>
                          {proposal.responseNotes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-sm text-slate-600">{formatDate(proposal.createdAt)}</p>
                    </td>
                    <td className="px-4 py-4">
                      {proposal.status === 'PENDING' ? (
                        <p className="text-sm text-amber-600 font-medium">
                          {getTimeRemaining(proposal.expiresAt)}
                        </p>
                      ) : proposal.respondedAt ? (
                        <p className="text-sm text-slate-500">
                          Responded {formatDate(proposal.respondedAt)}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-400">-</p>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      {proposals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-2xl font-bold text-slate-800">{statusCounts.all}</p>
            <p className="text-sm text-slate-500">Total Proposals</p>
          </div>
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-4">
            <p className="text-2xl font-bold text-amber-700">{statusCounts.PENDING}</p>
            <p className="text-sm text-amber-600">Awaiting Response</p>
          </div>
          <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-4">
            <p className="text-2xl font-bold text-emerald-700">{statusCounts.ACCEPTED}</p>
            <p className="text-sm text-emerald-600">Accepted</p>
          </div>
          <div className="bg-rose-50 rounded-xl border border-rose-200 p-4">
            <p className="text-2xl font-bold text-rose-700">{statusCounts.REJECTED}</p>
            <p className="text-sm text-rose-600">Rejected</p>
          </div>
        </div>
      )}
    </div>
  );
}

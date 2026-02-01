/**
 * Dispatcher Proposals Page
 *
 * Shows all match proposals created by the dispatcher
 * Foundation Rule: DISPATCHER_COORDINATION_ONLY
 * - Dispatchers propose matches
 * - Carriers approve/reject
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import ProposalsClient from './ProposalsClient';

async function getProposals(userId: string) {
  const proposals = await db.matchProposal.findMany({
    where: {
      proposedById: userId,
    },
    include: {
      load: {
        select: {
          pickupCity: true,
          deliveryCity: true,
          pickupDate: true,
          weight: true,
          truckType: true,
          status: true,
        },
      },
      truck: {
        select: {
          licensePlate: true,
          truckType: true,
          capacity: true,
        },
      },
      carrier: {
        select: {
          name: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return proposals;
}

export default async function DispatcherProposalsPage() {
  const session = await requireAuth();

  if (session.role !== 'DISPATCHER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/dispatcher');
  }

  const proposals = await getProposals(session.userId);

  // Transform for client
  const transformedProposals = proposals.map((p) => ({
    id: p.id,
    status: p.status,
    notes: p.notes,
    proposedRate: p.proposedRate ? Number(p.proposedRate) : null,
    expiresAt: p.expiresAt.toISOString(),
    createdAt: p.createdAt.toISOString(),
    respondedAt: p.respondedAt?.toISOString() || null,
    responseNotes: p.responseNotes,
    load: {
      pickupCity: p.load.pickupCity || 'Unknown',
      deliveryCity: p.load.deliveryCity || 'Unknown',
      pickupDate: p.load.pickupDate.toISOString(),
      weight: Number(p.load.weight),
      truckType: p.load.truckType,
      status: p.load.status,
    },
    truck: {
      licensePlate: p.truck.licensePlate,
      truckType: p.truck.truckType,
      capacity: Number(p.truck.capacity),
    },
    carrier: {
      name: p.carrier.name,
    },
  }));

  const pendingCount = transformedProposals.filter((p) => p.status === 'PENDING').length;

  return (
    <div className="p-6">
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-500 to-teal-600 flex items-center justify-center shadow-md shadow-teal-500/25">
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Match Proposals</h1>
            <p className="text-slate-500 text-sm">
              Track load-truck match proposals you&apos;ve sent to carriers
            </p>
          </div>
        </div>
        {pendingCount > 0 && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-amber-600" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                  clipRule="evenodd"
                />
              </svg>
              <span className="text-amber-800 font-medium">
                {pendingCount} proposal{pendingCount > 1 ? 's' : ''} awaiting carrier response
              </span>
            </div>
          </div>
        )}
      </div>

      <Suspense fallback={<ProposalsSkeleton />}>
        <ProposalsClient proposals={transformedProposals} />
      </Suspense>
    </div>
  );
}

function ProposalsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-gray-200 rounded w-1/3"></div>
      <div className="h-64 bg-gray-200 rounded"></div>
    </div>
  );
}

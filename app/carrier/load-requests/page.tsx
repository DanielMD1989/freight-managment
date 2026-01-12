/**
 * Carrier Load Requests Page
 *
 * Sprint 18 - Story 18.1: Carrier views outgoing load requests
 *
 * Shows load requests the carrier has sent to shippers
 * with status tracking (PENDING, APPROVED, REJECTED)
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import LoadRequestsClient from './LoadRequestsClient';

async function getCarrierLoadRequests(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return [];
  }

  // Get outgoing load requests from this carrier
  const requests = await db.loadRequest.findMany({
    where: {
      carrierId: user.organizationId,
    },
    include: {
      load: {
        select: {
          id: true,
          status: true,
          weight: true,
          truckType: true,
          pickupCity: true,
          deliveryCity: true,
          pickupDate: true,
          rate: true,
          totalFareEtb: true,
          pickupLocation: {
            select: {
              name: true,
            },
          },
          deliveryLocation: {
            select: {
              name: true,
            },
          },
          shipper: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      },
      truck: {
        select: {
          id: true,
          licensePlate: true,
          truckType: true,
          capacity: true,
        },
      },
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return requests;
}

export default async function CarrierLoadRequestsPage() {
  const session = await requireAuth();

  if (session.role !== 'CARRIER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/carrier');
  }

  const requests = await getCarrierLoadRequests(session.userId);

  // Transform for client
  const transformedRequests = requests.map((req) => ({
    id: req.id,
    status: req.status,
    notes: req.notes,
    proposedRate: req.proposedRate ? Number(req.proposedRate) : null,
    responseNotes: req.responseNotes,
    expiresAt: req.expiresAt.toISOString(),
    createdAt: req.createdAt.toISOString(),
    respondedAt: req.respondedAt?.toISOString() || null,
    load: {
      id: req.load.id,
      referenceNumber: `LOAD-${req.load.id.slice(-8).toUpperCase()}`,
      status: req.load.status,
      weight: Number(req.load.weight),
      truckType: req.load.truckType,
      pickupCity: req.load.pickupLocation?.name || req.load.pickupCity || 'Unknown',
      deliveryCity: req.load.deliveryLocation?.name || req.load.deliveryCity || 'Unknown',
      pickupDate: req.load.pickupDate.toISOString(),
      rate: req.load.totalFareEtb ? Number(req.load.totalFareEtb) : (req.load.rate ? Number(req.load.rate) : null),
    },
    truck: {
      id: req.truck.id,
      plateNumber: req.truck.licensePlate,
      truckType: req.truck.truckType,
      capacity: Number(req.truck.capacity),
    },
    shipper: req.load.shipper || null,
    requestedBy: req.requestedBy
      ? {
          id: req.requestedBy.id,
          name: [req.requestedBy.firstName, req.requestedBy.lastName]
            .filter(Boolean)
            .join(' '),
          email: req.requestedBy.email,
        }
      : null,
  }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          My Load Requests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Track your load requests sent to shippers
        </p>
      </div>

      <Suspense fallback={<RequestsSkeleton />}>
        <LoadRequestsClient requests={transformedRequests} />
      </Suspense>
    </div>
  );
}

function RequestsSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 w-24 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        ))}
      </div>
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-48 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

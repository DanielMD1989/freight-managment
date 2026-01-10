/**
 * Shipper Truck Requests Page
 *
 * Phase 2 - Story 16.15: Shipper-Led Truck Matching
 * Task 16.15.4: Booking History
 *
 * View and manage truck booking requests
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import TruckRequestsClient from './TruckRequestsClient';

async function getTruckRequests(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return [];
  }

  const requests = await db.truckRequest.findMany({
    where: {
      shipperId: user.organizationId,
    },
    include: {
      load: {
        include: {
          pickupLocation: true,
          deliveryLocation: true,
        },
      },
      truck: {
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      },
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return requests;
}

export default async function ShipperRequestsPage() {
  const session = await requireAuth();

  if (session.role !== 'SHIPPER') {
    redirect('/shipper');
  }

  const requests = await getTruckRequests(session.userId);

  // Transform dates for client
  const transformedRequests = requests.map((req) => ({
    id: req.id,
    status: req.status,
    notes: req.notes,
    offeredRate: req.offeredRate ? Number(req.offeredRate) : null,
    expiresAt: req.expiresAt.toISOString(),
    createdAt: req.createdAt.toISOString(),
    respondedAt: req.respondedAt?.toISOString() || null,
    load: {
      id: req.load.id,
      referenceNumber: `LOAD-${req.load.id.slice(-8).toUpperCase()}`,
      status: req.load.status,
      weight: Number(req.load.weight),
      truckType: req.load.truckType,
      pickupCity: req.load.pickupLocation?.name || 'Unknown',
      deliveryCity: req.load.deliveryLocation?.name || 'Unknown',
      pickupDate: req.load.pickupDate.toISOString(),
    },
    truck: {
      id: req.truck.id,
      plateNumber: req.truck.licensePlate,
      truckType: req.truck.truckType,
      capacity: Number(req.truck.capacity),
      carrier: req.truck.carrier,
    },
    requestedBy: req.requestedBy
      ? {
          id: req.requestedBy.id,
          name: [req.requestedBy.firstName, req.requestedBy.lastName]
            .filter(Boolean)
            .join(' '),
        }
      : null,
  }));

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Truck Requests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          View and manage your truck booking requests
        </p>
      </div>

      <Suspense fallback={<RequestsSkeleton />}>
        <TruckRequestsClient requests={transformedRequests} />
      </Suspense>
    </div>
  );
}

function RequestsSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-12 bg-gray-200 dark:bg-gray-700 rounded w-1/3"></div>
      <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
    </div>
  );
}

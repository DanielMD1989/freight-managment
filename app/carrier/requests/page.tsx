/**
 * Carrier Truck Requests Page
 *
 * Phase 2 - Story 16.15: Shipper-Led Truck Matching
 * Task 16.15.3: Booking Request Management - Carrier
 *
 * View and respond to incoming truck booking requests
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect } from 'next/navigation';
import CarrierRequestsClient from './CarrierRequestsClient';

async function getIncomingRequests(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return [];
  }

  const requests = await db.truckRequest.findMany({
    where: {
      carrierId: user.organizationId,
    },
    include: {
      load: {
        include: {
          pickupLocation: true,
          deliveryLocation: true,
          shipper: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
        },
      },
      truck: true,
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

export default async function CarrierRequestsPage() {
  const session = await requireAuth();

  if (session.role !== 'CARRIER') {
    redirect('/carrier');
  }

  const requests = await getIncomingRequests(session.userId);

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
      cargoType: req.load.cargoDescription || 'General',
      pickupCity: req.load.pickupLocation?.name || 'Unknown',
      deliveryCity: req.load.deliveryLocation?.name || 'Unknown',
      pickupDate: req.load.pickupDate.toISOString(),
      deliveryDate: req.load.deliveryDate.toISOString(),
      shipper: req.load.shipper,
    },
    truck: {
      id: req.truck.id,
      plateNumber: req.truck.licensePlate,
      truckType: req.truck.truckType,
      capacity: Number(req.truck.capacity),
    },
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
          Incoming Requests
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Review and respond to truck booking requests from shippers
        </p>
      </div>

      <Suspense fallback={<RequestsSkeleton />}>
        <CarrierRequestsClient requests={transformedRequests} />
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

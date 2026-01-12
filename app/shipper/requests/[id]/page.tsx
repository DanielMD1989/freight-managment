/**
 * Shipper Request Detail Page
 *
 * Sprint 18 - Story 18.6: Shipper views request details
 *
 * Shows full details of a load request from a carrier
 * - Request info, carrier details, truck details
 * - For approved: link to track load/trip
 * - For rejected: shows rejection notes
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import RequestDetailClient from './RequestDetailClient';

async function getRequestDetails(requestId: string, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true },
  });

  if (!user?.organizationId) {
    return null;
  }

  // Get the load request with full details
  const request = await db.loadRequest.findUnique({
    where: { id: requestId },
    include: {
      load: {
        include: {
          pickupLocation: true,
          deliveryLocation: true,
          shipper: {
            select: {
              id: true,
              name: true,
            },
          },
          assignedTruck: {
            select: {
              id: true,
              licensePlate: true,
              truckType: true,
            },
          },
        },
      },
      truck: {
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
              isVerified: true,
              contactPhone: true,
              contactEmail: true,
            },
          },
        },
      },
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
        },
      },
    },
  });

  if (!request) {
    return null;
  }

  // Verify shipper owns the load
  if (request.load.shipperId !== user.organizationId) {
    return null;
  }

  return request;
}

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAuth();

  if (session.role !== 'SHIPPER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/shipper');
  }

  const request = await getRequestDetails(id, session.userId);

  if (!request) {
    notFound();
  }

  // Transform for client
  const requestData = {
    id: request.id,
    status: request.status,
    notes: request.notes,
    proposedRate: request.proposedRate ? Number(request.proposedRate) : null,
    responseNotes: request.responseNotes,
    expiresAt: request.expiresAt.toISOString(),
    createdAt: request.createdAt.toISOString(),
    respondedAt: request.respondedAt?.toISOString() || null,
    load: {
      id: request.load.id,
      referenceNumber: `LOAD-${request.load.id.slice(-8).toUpperCase()}`,
      status: request.load.status,
      weight: Number(request.load.weight),
      truckType: request.load.truckType,
      pickupCity: request.load.pickupLocation?.name || request.load.pickupCity || 'Unknown',
      deliveryCity: request.load.deliveryLocation?.name || request.load.deliveryCity || 'Unknown',
      pickupDate: request.load.pickupDate.toISOString(),
      deliveryDate: request.load.deliveryDate?.toISOString() || null,
      pickupAddress: request.load.pickupAddress,
      deliveryAddress: request.load.deliveryAddress,
      rate: request.load.totalFareEtb ? Number(request.load.totalFareEtb) : (request.load.rate ? Number(request.load.rate) : null),
      cargoDescription: request.load.cargoDescription,
      isAssigned: request.load.status !== 'DRAFT' && request.load.status !== 'SEARCHING',
      assignedTruck: request.load.assignedTruck
        ? {
            id: request.load.assignedTruck.id,
            licensePlate: request.load.assignedTruck.licensePlate,
            truckType: request.load.assignedTruck.truckType,
          }
        : null,
    },
    truck: {
      id: request.truck.id,
      licensePlate: request.truck.licensePlate,
      truckType: request.truck.truckType,
      capacity: Number(request.truck.capacity),
    },
    carrier: {
      id: request.truck.carrier.id,
      name: request.truck.carrier.name,
      isVerified: request.truck.carrier.isVerified,
      phone: request.truck.carrier.contactPhone,
      email: request.truck.carrier.contactEmail,
    },
    requestedBy: request.requestedBy
      ? {
          id: request.requestedBy.id,
          name: [request.requestedBy.firstName, request.requestedBy.lastName]
            .filter(Boolean)
            .join(' '),
          email: request.requestedBy.email,
          phone: request.requestedBy.phone,
        }
      : null,
  };

  return (
    <div className="p-6">
      <Suspense fallback={<RequestDetailSkeleton />}>
        <RequestDetailClient request={requestData} />
      </Suspense>
    </div>
  );
}

function RequestDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-8 w-48 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-64 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        <div className="h-64 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

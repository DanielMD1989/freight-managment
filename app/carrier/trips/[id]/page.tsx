/**
 * Carrier Trip Detail Page
 *
 * Sprint 18 - Story 18.3: Carrier starts and manages a trip
 *
 * Shows full trip details with status-based actions
 * - Start Trip, Confirm Pickup, End Trip buttons
 * - POD upload for delivered trips
 * - Live map for in-transit trips
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import TripDetailClient from './TripDetailClient';

async function getTripDetails(loadId: string, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, role: true },
  });

  if (!user?.organizationId) {
    return null;
  }

  // Get the load/trip with full details
  const load = await db.load.findUnique({
    where: { id: loadId },
    include: {
      shipper: {
        select: {
          id: true,
          name: true,
          isVerified: true,
        },
      },
      assignedTruck: {
        include: {
          carrier: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
      pickupLocation: true,
      deliveryLocation: true,
      documents: {
        where: {
          type: {
            in: ['POD', 'BOL', 'RECEIPT'],
          },
        },
        orderBy: { uploadedAt: 'desc' },
      },
      events: {
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
    },
  });

  if (!load) {
    return null;
  }

  // Verify carrier owns the assigned truck (or is admin)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    if (!load.assignedTruck || load.assignedTruck.carrierId !== user.organizationId) {
      return null;
    }
  }

  return load;
}

export default async function TripDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await requireAuth();

  if (session.role !== 'CARRIER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/carrier');
  }

  const load = await getTripDetails(params.id, session.userId);

  if (!load) {
    notFound();
  }

  // Transform for client
  const trip = {
    id: load.id,
    referenceNumber: `LOAD-${load.id.slice(-8).toUpperCase()}`,
    status: load.status,
    weight: Number(load.weight),
    truckType: load.truckType,
    pickupCity: load.pickupLocation?.name || load.pickupCity || 'Unknown',
    deliveryCity: load.deliveryLocation?.name || load.deliveryCity || 'Unknown',
    pickupDate: load.pickupDate.toISOString(),
    deliveryDate: load.deliveryDate?.toISOString() || null,
    pickupAddress: load.pickupAddress,
    deliveryAddress: load.deliveryAddress,
    pickupDockHours: load.pickupDockHours,
    deliveryDockHours: load.deliveryDockHours,
    rate: load.totalFareEtb ? Number(load.totalFareEtb) : (load.rate ? Number(load.rate) : null),
    cargoDescription: load.cargoDescription,
    safetyNotes: load.safetyNotes,
    shipperContactName: load.shipperContactName,
    shipperContactPhone: load.shipperContactPhone,
    trackingEnabled: load.trackingEnabled,
    trackingUrl: load.trackingUrl,
    tripProgressPercent: load.tripProgressPercent,
    remainingDistanceKm: load.remainingDistanceKm ? Number(load.remainingDistanceKm) : null,
    estimatedTripKm: load.estimatedTripKm ? Number(load.estimatedTripKm) : null,
    shipper: load.shipper,
    truck: load.assignedTruck ? {
      id: load.assignedTruck.id,
      licensePlate: load.assignedTruck.licensePlate,
      truckType: load.assignedTruck.truckType,
      capacity: Number(load.assignedTruck.capacity),
      carrier: load.assignedTruck.carrier,
    } : null,
    documents: load.documents.map((doc) => ({
      id: doc.id,
      documentType: doc.type,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      createdAt: doc.uploadedAt.toISOString(),
    })),
    events: load.events.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      description: event.description || '',
      createdAt: event.createdAt.toISOString(),
    })),
  };

  return (
    <div className="p-6">
      <Suspense fallback={<TripDetailSkeleton />}>
        <TripDetailClient trip={trip} />
      </Suspense>
    </div>
  );
}

function TripDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-10 w-64 bg-gray-200 dark:bg-slate-700 rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
        <div className="h-96 bg-gray-200 dark:bg-slate-700 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}

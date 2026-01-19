/**
 * Shipper Trip Detail Page
 *
 * Shows full trip details for shipper tracking
 * - Trip info, carrier/truck details
 * - Live map for IN_TRANSIT trips
 * - Route history for completed trips
 * - POD documents viewer
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import ShipperTripDetailClient from './ShipperTripDetailClient';

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
          carrier: true,
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
  }) as any;

  if (!load) {
    return null;
  }

  // Verify shipper owns this load (or is admin)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    if (load.shipperId !== user.organizationId) {
      return null;
    }
  }

  return load;
}

export default async function ShipperTripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAuth();

  if (session.role !== 'SHIPPER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/shipper');
  }

  const load = await getTripDetails(id, session.userId);

  if (!load) {
    notFound();
  }

  // Transform for client
  const trip = {
    id: load.id,
    loadId: load.id,
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
    specialInstructions: load.specialInstructions,
    trackingEnabled: load.trackingEnabled,
    trackingUrl: load.trackingUrl,
    tripProgressPercent: load.tripProgressPercent,
    remainingDistanceKm: load.remainingDistanceKm ? Number(load.remainingDistanceKm) : null,
    estimatedTripKm: load.estimatedTripKm ? Number(load.estimatedTripKm) : null,
    assignedAt: load.assignedAt?.toISOString() || null,
    completedAt: load.podSubmittedAt?.toISOString() || null,
    podUrl: load.podUrl,
    podSubmitted: load.podSubmitted ?? false,
    podVerified: load.podVerified ?? false,
    carrier: load.assignedTruck?.carrier ? {
      id: load.assignedTruck.carrier.id,
      name: load.assignedTruck.carrier.name,
      isVerified: load.assignedTruck.carrier.isVerified,
      phone: load.assignedTruck.carrier.phone,
    } : null,
    truck: load.assignedTruck ? {
      id: load.assignedTruck.id,
      licensePlate: load.assignedTruck.licensePlate,
      truckType: load.assignedTruck.truckType,
      capacity: Number(load.assignedTruck.capacity),
    } : null,
    documents: load.documents.map((doc: any) => ({
      id: doc.id,
      documentType: doc.type,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      createdAt: doc.uploadedAt.toISOString(),
    })),
    events: load.events.map((event: any) => ({
      id: event.id,
      eventType: event.eventType,
      description: event.description || '',
      createdAt: event.createdAt.toISOString(),
    })),
  };

  return (
    <div className="p-6">
      <Suspense fallback={<TripDetailSkeleton />}>
        <ShipperTripDetailClient trip={trip} />
      </Suspense>
    </div>
  );
}

function TripDetailSkeleton() {
  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <div className="h-10 w-64 bg-slate-200 rounded animate-pulse" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 h-96 bg-slate-200 rounded-xl animate-pulse" />
        <div className="h-96 bg-slate-200 rounded-xl animate-pulse" />
      </div>
    </div>
  );
}

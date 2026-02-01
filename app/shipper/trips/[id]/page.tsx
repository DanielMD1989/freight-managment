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

async function getTripDetails(id: string, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, role: true },
  });

  if (!user?.organizationId) {
    return null;
  }

  // Try to get Trip first (new model)
  let trip = await db.trip.findUnique({
    where: { id },
    include: {
      load: {
        include: {
          shipper: {
            select: {
              id: true,
              name: true,
              isVerified: true,
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
      },
      truck: {
        include: {
          carrier: true,
        },
      },
      shipper: {
        select: {
          id: true,
          name: true,
          isVerified: true,
        },
      },
      carrier: {
        select: {
          id: true,
          name: true,
          isVerified: true,
          contactPhone: true,
        },
      },
      podDocuments: {
        orderBy: { uploadedAt: 'desc' },
      },
    },
  });

  // If not found by trip ID, try by loadId (backward compatibility)
  if (!trip) {
    trip = await db.trip.findUnique({
      where: { loadId: id },
      include: {
        load: {
          include: {
            shipper: {
              select: {
                id: true,
                name: true,
                isVerified: true,
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
        },
        truck: {
          include: {
            carrier: true,
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
            isVerified: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
            isVerified: true,
            contactPhone: true,
          },
        },
        podDocuments: {
          orderBy: { uploadedAt: 'desc' },
        },
      },
    });
  }

  // If still no trip, fall back to Load-based lookup (legacy)
  if (!trip) {
    const load = await db.load.findUnique({
      where: { id },
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
    });

    if (!load) {
      return null;
    }

    // Verify shipper owns this load (or is admin)
    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      if (load.shipperId !== user.organizationId) {
        return null;
      }
    }

    // Return legacy format
    return { type: 'load', data: load };
  }

  // Verify shipper owns this trip (or is admin)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    if (trip.shipperId !== user.organizationId) {
      return null;
    }
  }

  return { type: 'trip', data: trip };
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

  const result = await getTripDetails(id, session.userId);

  if (!result) {
    notFound();
  }

  // Transform for client based on data type
  let trip;

  if (result.type === 'trip') {
    const tripData = result.data as any;
    const load = tripData.load;

    trip = {
      id: tripData.id,
      loadId: tripData.loadId,
      referenceNumber: `TRIP-${tripData.id.slice(-8).toUpperCase()}`,
      status: tripData.status,
      weight: load?.weight ? Number(load.weight) : 0,
      truckType: load?.truckType || tripData.truck?.truckType || 'Unknown',
      pickupCity: tripData.pickupCity || load?.pickupLocation?.name || load?.pickupCity || 'Unknown',
      deliveryCity: tripData.deliveryCity || load?.deliveryLocation?.name || load?.deliveryCity || 'Unknown',
      pickupDate: load?.pickupDate?.toISOString() || tripData.createdAt.toISOString(),
      deliveryDate: load?.deliveryDate?.toISOString() || null,
      pickupAddress: tripData.pickupAddress || load?.pickupAddress,
      deliveryAddress: tripData.deliveryAddress || load?.deliveryAddress,
      pickupDockHours: load?.pickupDockHours,
      deliveryDockHours: load?.deliveryDockHours,
      cargoDescription: load?.cargoDescription,
      specialInstructions: load?.specialInstructions,
      trackingEnabled: tripData.trackingEnabled,
      trackingUrl: tripData.trackingUrl,
      tripProgressPercent: load?.tripProgressPercent,
      remainingDistanceKm: load?.remainingDistanceKm ? Number(load.remainingDistanceKm) : null,
      estimatedTripKm: tripData.estimatedDistanceKm ? Number(tripData.estimatedDistanceKm) : null,
      assignedAt: tripData.createdAt?.toISOString() || null,
      completedAt: tripData.completedAt?.toISOString() || null,
      podUrl: load?.podUrl,
      podSubmitted: load?.podSubmitted ?? false,
      podVerified: load?.podVerified ?? false,
      // New fields
      shipperConfirmed: tripData.shipperConfirmed ?? false,
      receiverName: tripData.receiverName,
      receiverPhone: tripData.receiverPhone,
      deliveryNotes: tripData.deliveryNotes,
      cancelReason: tripData.cancelReason,
      carrier: tripData.carrier ? {
        id: tripData.carrier.id,
        name: tripData.carrier.name,
        isVerified: tripData.carrier.isVerified,
        phone: tripData.carrier.contactPhone,
      } : null,
      truck: tripData.truck ? {
        id: tripData.truck.id,
        licensePlate: tripData.truck.licensePlate,
        truckType: tripData.truck.truckType,
        capacity: Number(tripData.truck.capacity),
      } : null,
      documents: (load?.documents || []).map((doc: any) => ({
        id: doc.id,
        documentType: doc.type,
        fileName: doc.fileName,
        fileUrl: doc.fileUrl,
        createdAt: doc.uploadedAt.toISOString(),
      })),
      events: (load?.events || []).map((event: any) => ({
        id: event.id,
        eventType: event.eventType,
        description: event.description || '',
        createdAt: event.createdAt.toISOString(),
      })),
      podDocuments: (tripData.podDocuments || []).map((pod: any) => ({
        id: pod.id,
        fileUrl: pod.fileUrl,
        fileName: pod.fileName,
        fileType: pod.fileType,
        notes: pod.notes,
        uploadedAt: pod.uploadedAt.toISOString(),
      })),
    };
  } else {
    // Legacy load-based format
    const load = result.data as any;

    trip = {
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
      // New fields (defaults for legacy)
      shipperConfirmed: load.podVerified ?? false,
      receiverName: null,
      receiverPhone: null,
      deliveryNotes: null,
      cancelReason: null,
      carrier: load.assignedTruck?.carrier ? {
        id: load.assignedTruck.carrier.id,
        name: load.assignedTruck.carrier.name,
        isVerified: load.assignedTruck.carrier.isVerified,
        phone: load.assignedTruck.carrier.contactPhone,
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
      podDocuments: [],
    };
  }

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

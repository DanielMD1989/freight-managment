/**
 * Carrier Trip Detail Page
 *
 * Sprint 18 - Story 18.3: Carrier starts and manages a trip
 *
 * Shows full trip details with status-based actions
 * - Start Trip, Confirm Pickup, End Trip buttons
 * - POD upload for delivered trips
 * - Live map for in-transit trips
 *
 * Updated to use proper Trip model
 */

import { Suspense } from 'react';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import TripDetailClient from './TripDetailClient';
import { createTripForLoad } from '@/lib/tripManagement';

async function getTripDetails(id: string, userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organizationId: true, role: true },
  });

  if (!user?.organizationId) {
    return null;
  }

  // First try to find trip by ID, then by loadId (for backward compatibility)
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
          carrier: {
            select: {
              id: true,
              name: true,
            },
          },
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
        },
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
            carrier: {
              select: {
                id: true,
                name: true,
              },
            },
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
          },
        },
      },
    });
  }

  // If still no trip, check if load exists and is assigned - create trip if so
  if (!trip) {
    const load = await db.load.findUnique({
      where: { id: id },
      select: {
        id: true,
        status: true,
        assignedTruckId: true,
        shipperId: true,
      },
    });

    // If load exists, is assigned, and carrier owns the truck, create trip
    if (load?.assignedTruckId) {
      const truck = await db.truck.findUnique({
        where: { id: load.assignedTruckId },
        select: { carrierId: true },
      });

      if (truck?.carrierId === user.organizationId || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
        // Create the missing trip
        const newTrip = await createTripForLoad(load.id, load.assignedTruckId, userId);
        if (newTrip) {
          // Fetch the full trip with relations
          trip = await db.trip.findUnique({
            where: { id: newTrip.id },
            include: {
              load: {
                include: {
                  shipper: {
                    select: { id: true, name: true, isVerified: true },
                  },
                  pickupLocation: true,
                  deliveryLocation: true,
                  documents: {
                    where: { type: { in: ['POD', 'BOL', 'RECEIPT'] } },
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
                  carrier: {
                    select: { id: true, name: true },
                  },
                },
              },
              shipper: {
                select: { id: true, name: true, isVerified: true },
              },
              carrier: {
                select: { id: true, name: true },
              },
            },
          });
        }
      }
    }
  }

  if (!trip) {
    return null;
  }

  // Verify carrier owns the assigned truck (or is admin)
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    if (trip.carrierId !== user.organizationId) {
      return null;
    }
  }

  return trip;
}

export default async function TripDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await requireAuth();

  if (session.role !== 'CARRIER' && session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
    redirect('/carrier');
  }

  const tripData = await getTripDetails(id, session.userId);

  if (!tripData) {
    notFound();
  }

  const load = tripData.load;

  // Transform for client - now using Trip model
  const trip = {
    id: tripData.id, // This is now the Trip ID
    loadId: tripData.loadId, // Keep loadId for document uploads etc.
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
    pickupDockHours: load?.pickupDockHours || null,
    deliveryDockHours: load?.deliveryDockHours || null,
    rate: load?.totalFareEtb ? Number(load.totalFareEtb) : (load?.rate ? Number(load.rate) : null),
    cargoDescription: load?.cargoDescription || null,
    safetyNotes: load?.safetyNotes || null,
    shipperContactName: load?.shipperContactName || null,
    shipperContactPhone: load?.shipperContactPhone || null,
    trackingEnabled: tripData.trackingEnabled,
    trackingUrl: tripData.trackingUrl,
    tripProgressPercent: null, // Calculate from GPS positions if needed
    remainingDistanceKm: null,
    estimatedTripKm: tripData.estimatedDistanceKm ? Number(tripData.estimatedDistanceKm) : null,
    shipper: tripData.shipper || load?.shipper || null,
    truck: tripData.truck ? {
      id: tripData.truck.id,
      licensePlate: tripData.truck.licensePlate,
      truckType: tripData.truck.truckType,
      capacity: Number(tripData.truck.capacity),
      carrier: tripData.truck.carrier,
    } : null,
    documents: (load?.documents || []).map((doc) => ({
      id: doc.id,
      documentType: doc.type,
      fileName: doc.fileName,
      fileUrl: doc.fileUrl,
      createdAt: doc.uploadedAt.toISOString(),
    })),
    events: (load?.events || []).map((event) => ({
      id: event.id,
      eventType: event.eventType,
      description: event.description || '',
      createdAt: event.createdAt.toISOString(),
    })),
    // Add trip-specific timestamps
    startedAt: tripData.startedAt?.toISOString() || null,
    pickedUpAt: tripData.pickedUpAt?.toISOString() || null,
    deliveredAt: tripData.deliveredAt?.toISOString() || null,
    completedAt: tripData.completedAt?.toISOString() || null,
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

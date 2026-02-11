/**
 * Trip API - Individual Trip Routes
 *
 * GET /api/trips/[tripId] - Get trip details
 * PATCH /api/trips/[tripId] - Update trip status
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { requireCSRF } from '@/lib/csrf';
import { getAccessRoles } from '@/lib/rbac';
import { TripStatus, LoadStatus } from '@prisma/client';
import { z } from 'zod';
// P1-002 FIX: Import CacheInvalidation for post-update cache clearing
import { CacheInvalidation } from '@/lib/cache';

const updateTripSchema = z.object({
  status: z.enum(['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED']).optional(),
  // Receiver info (for DELIVERED status)
  receiverName: z.string().max(100).optional(),
  receiverPhone: z.string().max(20).optional(),
  deliveryNotes: z.string().max(500).optional(),
});

// Valid status transitions
const validTransitions: Record<TripStatus, TripStatus[]> = {
  ASSIGNED: ['PICKUP_PENDING', 'CANCELLED'],
  PICKUP_PENDING: ['IN_TRANSIT', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
  DELIVERED: ['COMPLETED', 'CANCELLED'],
  COMPLETED: [], // Terminal state
  CANCELLED: [], // Terminal state
};

/**
 * GET /api/trips/[tripId]
 *
 * Get trip details with role-based access control
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await requireAuth();
    const { tripId } = await params;

    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: {
          select: {
            id: true,
            status: true,
            pickupCity: true,
            pickupAddress: true,
            pickupDate: true,
            deliveryCity: true,
            deliveryAddress: true,
            deliveryDate: true,
            cargoDescription: true,
            weight: true,
            truckType: true,
            podUrl: true,
            podSubmitted: true,
            podVerified: true,
          },
        },
        truck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
            contactName: true,
            contactPhone: true,
            currentLocationLat: true,
            currentLocationLon: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
            contactPhone: true,
            isVerified: true,
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
            contactPhone: true,
          },
        },
        routeHistory: {
          select: {
            id: true,
            latitude: true,
            longitude: true,
            speed: true,
            heading: true,
            timestamp: true,
          },
          orderBy: { timestamp: 'desc' },
          take: 100, // Latest 100 positions
        },
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Check permissions using centralized access helper
    const { isAdmin, isDispatcher, isCarrier, isShipper, hasAccess } = getAccessRoles(session, {
      shipperOrgId: trip.shipperId,
      carrierOrgId: trip.carrierId,
    });

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to view this trip' },
        { status: 403 }
      );
    }

    // For shippers, only show carrier contact info and route when trip is IN_TRANSIT or later
    let responseTrip: any = trip;
    if (isShipper && trip.status === 'ASSIGNED') {
      // Hide carrier contact and route history until pickup begins
      responseTrip = {
        ...trip,
        truck: { ...trip.truck, contactPhone: '(hidden)' },
        carrier: { ...trip.carrier, contactPhone: '(hidden)' },
        routeHistory: [], // Don't expose GPS data before trip starts
      };
    }

    return NextResponse.json({ trip: responseTrip });
  } catch (error) {
    console.error('Get trip error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch trip' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/trips/[tripId]
 *
 * Update trip status. Only carrier can update status.
 * Status transitions are validated.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    // CSRF protection for state-changing operation
    // Mobile clients MUST use Bearer token authentication (inherently CSRF-safe)
    // Web clients MUST provide CSRF token
    const isMobileClient = request.headers.get('x-client-type') === 'mobile';
    const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');

    if (isMobileClient && !hasBearerAuth) {
      return NextResponse.json(
        { error: 'Mobile clients require Bearer authentication' },
        { status: 401 }
      );
    }

    if (!isMobileClient && !hasBearerAuth) {
      const csrfError = await requireCSRF(request);
      if (csrfError) {
        return csrfError;
      }
    }

    const session = await requireAuth();
    const { tripId } = await params;

    const body = await request.json();
    const validatedData = updateTripSchema.parse(body);

    // Get current trip
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      include: {
        load: true,
        truck: true,
      },
    });

    if (!trip) {
      return NextResponse.json(
        { error: 'Trip not found' },
        { status: 404 }
      );
    }

    // Only carrier can update trip status (GPS rule from spec)
    const isCarrier = session.role === 'CARRIER' && trip.carrierId === session.organizationId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the carrier can update trip status' },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: any = {
      updatedAt: new Date(),
    };

    // Handle status update
    if (validatedData.status) {
      // Validate status transition
      const allowedTransitions = validTransitions[trip.status];
      if (!allowedTransitions.includes(validatedData.status)) {
        return NextResponse.json(
          {
            error: `Invalid status transition from ${trip.status} to ${validatedData.status}`,
            allowedTransitions,
          },
          { status: 400 }
        );
      }

      // COMPLETED requires POD to be submitted and verified
      if (validatedData.status === 'COMPLETED') {
        if (!trip.load?.podSubmitted) {
          return NextResponse.json(
            {
              error: 'POD must be uploaded before completing the trip',
              requiresPod: true,
            },
            { status: 400 }
          );
        }
        if (!trip.load?.podVerified) {
          return NextResponse.json(
            {
              error: 'POD must be verified by shipper before completing the trip',
              awaitingVerification: true,
            },
            { status: 400 }
          );
        }
      }

      updateData.status = validatedData.status;

      // Set timestamps based on status
      switch (validatedData.status) {
        case 'PICKUP_PENDING':
          updateData.startedAt = new Date();
          break;
        case 'IN_TRANSIT':
          updateData.pickedUpAt = new Date();
          break;
        case 'DELIVERED':
          updateData.deliveredAt = new Date();
          // Add receiver info if provided
          if (validatedData.receiverName) {
            updateData.receiverName = validatedData.receiverName;
          }
          if (validatedData.receiverPhone) {
            updateData.receiverPhone = validatedData.receiverPhone;
          }
          if (validatedData.deliveryNotes) {
            updateData.deliveryNotes = validatedData.deliveryNotes;
          }
          break;
        case 'COMPLETED':
          updateData.completedAt = new Date();
          updateData.trackingEnabled = false; // GPS stops on completion
          break;
        case 'CANCELLED':
          updateData.cancelledAt = new Date();
          updateData.trackingEnabled = false;
          break;
      }
    }

    // P1-002 FIX: Wrap trip update and load sync in single transaction
    // to ensure atomic status synchronization
    const { updatedTrip, loadSynced } = await db.$transaction(async (tx) => {
      // Update trip
      const updatedTrip = await tx.trip.update({
        where: { id: tripId },
        data: updateData,
        include: {
          load: true,
          truck: true,
          carrier: true,
          shipper: true,
        },
      });

      // Sync trip status with load status (inside transaction)
      let loadSynced = false;
      if (validatedData.status) {
        const loadStatus = mapTripStatusToLoadStatus(validatedData.status);
        if (loadStatus) {
          await tx.load.update({
            where: { id: trip.loadId },
            data: { status: loadStatus },
          });
          loadSynced = true;
        }
      }

      // Create load event inside transaction
      await tx.loadEvent.create({
        data: {
          loadId: trip.loadId,
          eventType: 'TRIP_STATUS_UPDATED',
          description: `Trip status changed to ${validatedData.status}`,
          userId: session.userId,
          metadata: {
            tripId,
            previousStatus: trip.status,
            newStatus: validatedData.status,
            loadStatusSynced: loadSynced,
          },
        },
      });

      return { updatedTrip, loadSynced };
    });

    // P1-002 FIX: Cache invalidation after transaction commits
    await CacheInvalidation.trip(tripId, trip.carrierId, trip.shipperId);
    if (loadSynced) {
      await CacheInvalidation.load(trip.loadId, trip.shipperId);
    }

    return NextResponse.json({
      message: 'Trip updated successfully',
      trip: updatedTrip,
      loadSynced,
    });
  } catch (error) {
    console.error('Update trip error:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update trip' },
      { status: 500 }
    );
  }
}

// Map trip status to load status
function mapTripStatusToLoadStatus(tripStatus: TripStatus): LoadStatus | null {
  switch (tripStatus) {
    case 'ASSIGNED':
      return LoadStatus.ASSIGNED;
    case 'PICKUP_PENDING':
      return LoadStatus.PICKUP_PENDING;
    case 'IN_TRANSIT':
      return LoadStatus.IN_TRANSIT;
    case 'DELIVERED':
      return LoadStatus.DELIVERED;
    case 'COMPLETED':
      return LoadStatus.COMPLETED;
    case 'CANCELLED':
      return LoadStatus.CANCELLED;
    default:
      return null;
  }
}

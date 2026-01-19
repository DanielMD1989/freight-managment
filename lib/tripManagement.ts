/**
 * Trip Management Library
 *
 * Core functions for creating and managing trips.
 * A Trip is created when a load is assigned to a truck.
 *
 * Based on MAP_GPS_USER_STORIES.md specification.
 */

import { db } from './db';
import { Trip, TripStatus } from '@prisma/client';

/**
 * Create a trip when a load is assigned to a truck
 *
 * @param loadId - The load being assigned
 * @param truckId - The truck being assigned to the load
 * @param userId - The user creating the trip (for audit)
 * @returns The created trip or null if creation fails
 */
export async function createTripForLoad(
  loadId: string,
  truckId: string,
  userId: string
): Promise<Trip | null> {
  try {
    // Check if trip already exists
    const existingTrip = await db.trip.findUnique({
      where: { loadId },
    });

    if (existingTrip) {
      console.log(`Trip already exists for load ${loadId}: ${existingTrip.id}`);
      return existingTrip;
    }

    // Get load details
    const load = await db.load.findUnique({
      where: { id: loadId },
      include: {
        shipper: true,
        pickupLocation: true,
        deliveryLocation: true,
      },
    });

    if (!load) {
      throw new Error(`Load not found: ${loadId}`);
    }

    // Get truck details
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      include: { carrier: true },
    });

    if (!truck) {
      throw new Error(`Truck not found: ${truckId}`);
    }

    // Generate a unique tracking URL
    const trackingUrl = generateTrackingUrl(loadId);

    // Create the trip
    const trip = await db.trip.create({
      data: {
        loadId,
        truckId,
        carrierId: truck.carrierId,
        shipperId: load.shipperId,
        status: 'ASSIGNED',

        // Pickup location from load
        pickupLat: load.originLat || load.pickupLocation?.latitude || null,
        pickupLng: load.originLon || load.pickupLocation?.longitude || null,
        pickupAddress: load.pickupAddress,
        pickupCity: load.pickupCity || load.pickupLocation?.name || null,

        // Delivery location from load
        deliveryLat: load.destinationLat || load.deliveryLocation?.latitude || null,
        deliveryLng: load.destinationLon || load.deliveryLocation?.longitude || null,
        deliveryAddress: load.deliveryAddress,
        deliveryCity: load.deliveryCity || load.deliveryLocation?.name || null,

        // Distance from load
        estimatedDistanceKm: load.estimatedTripKm || load.tripKm || null,

        // Tracking
        trackingUrl,
        trackingEnabled: true,
      },
    });

    console.log(`Trip created for load ${loadId}: ${trip.id}`);
    return trip;
  } catch (error) {
    console.error('Failed to create trip:', error);
    return null;
  }
}

/**
 * Update trip status
 *
 * @param tripId - The trip ID
 * @param newStatus - The new status
 * @param userId - The user making the update
 * @returns The updated trip or null
 */
export async function updateTripStatus(
  tripId: string,
  newStatus: TripStatus,
  userId: string
): Promise<Trip | null> {
  try {
    const trip = await db.trip.findUnique({
      where: { id: tripId },
    });

    if (!trip) {
      throw new Error(`Trip not found: ${tripId}`);
    }

    // Validate status transition
    if (!isValidStatusTransition(trip.status, newStatus)) {
      throw new Error(`Invalid status transition from ${trip.status} to ${newStatus}`);
    }

    // Build update data with timestamps
    const updateData: any = {
      status: newStatus,
      updatedAt: new Date(),
    };

    switch (newStatus) {
      case 'PICKUP_PENDING':
        updateData.startedAt = new Date();
        break;
      case 'IN_TRANSIT':
        updateData.pickedUpAt = new Date();
        break;
      case 'DELIVERED':
        updateData.deliveredAt = new Date();
        break;
      case 'COMPLETED':
        updateData.completedAt = new Date();
        updateData.trackingEnabled = false; // GPS stops on completion
        break;
    }

    const updatedTrip = await db.trip.update({
      where: { id: tripId },
      data: updateData,
    });

    // Sync status with load
    await syncLoadStatus(trip.loadId, newStatus);

    return updatedTrip;
  } catch (error) {
    console.error('Failed to update trip status:', error);
    return null;
  }
}

/**
 * Get trip by load ID
 */
export async function getTripByLoadId(loadId: string): Promise<Trip | null> {
  return db.trip.findUnique({
    where: { loadId },
  });
}

/**
 * Get trip by tracking URL
 */
export async function getTripByTrackingUrl(trackingUrl: string): Promise<Trip | null> {
  return db.trip.findUnique({
    where: { trackingUrl },
  });
}

/**
 * Update trip's current location
 */
export async function updateTripLocation(
  tripId: string,
  latitude: number,
  longitude: number
): Promise<void> {
  await db.trip.update({
    where: { id: tripId },
    data: {
      currentLat: latitude,
      currentLng: longitude,
      currentLocationUpdatedAt: new Date(),
    },
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Generate a unique tracking URL for a trip
 */
function generateTrackingUrl(loadId: string): string {
  const shortId = loadId.slice(-8);
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `trip-${shortId}-${timestamp}-${random}`;
}

/**
 * Validate status transition
 */
function isValidStatusTransition(currentStatus: TripStatus, newStatus: TripStatus): boolean {
  const validTransitions: Record<TripStatus, TripStatus[]> = {
    ASSIGNED: ['PICKUP_PENDING', 'CANCELLED'],
    PICKUP_PENDING: ['IN_TRANSIT', 'CANCELLED'],
    IN_TRANSIT: ['DELIVERED', 'CANCELLED'],
    DELIVERED: ['COMPLETED', 'CANCELLED'],
    COMPLETED: [], // Terminal state
    CANCELLED: [], // Terminal state
  };

  return validTransitions[currentStatus]?.includes(newStatus) ?? false;
}

/**
 * Sync load status with trip status
 */
async function syncLoadStatus(loadId: string, tripStatus: TripStatus): Promise<void> {
  const loadStatusMap: Record<TripStatus, string> = {
    ASSIGNED: 'ASSIGNED',
    PICKUP_PENDING: 'PICKUP_PENDING',
    IN_TRANSIT: 'IN_TRANSIT',
    DELIVERED: 'DELIVERED',
    COMPLETED: 'COMPLETED',
    CANCELLED: 'CANCELLED',
  };

  const loadStatus = loadStatusMap[tripStatus];
  if (loadStatus) {
    await db.load.update({
      where: { id: loadId },
      data: { status: loadStatus as any },
    });
  }
}

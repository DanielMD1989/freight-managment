/**
 * GPS Tracking Utilities
 *
 * Sprint 16 - Story 16.3: GPS Live Tracking for Assigned Loads
 *
 * Provides utilities for enabling and managing GPS tracking for loads.
 *
 * Features:
 * - Generate unique tracking URLs
 * - Enable/disable tracking on load assignment
 * - Get live GPS positions
 * - Geofence detection for arrivals
 * - Signal loss detection
 */

import { db } from '@/lib/db';
import { GpsPosition } from './gpsVerification';
import crypto from 'crypto';

/**
 * Tracking status information
 */
export interface TrackingStatus {
  enabled: boolean;
  trackingUrl: string | null;
  startedAt: Date | null;
  currentPosition: GpsPosition | null;
  signalStatus: 'active' | 'weak' | 'lost';
  lastUpdate: Date | null;
}

/**
 * Geofence event types
 */
export type GeofenceEvent = 'ARRIVED_AT_PICKUP' | 'ARRIVED_AT_DESTINATION' | 'SIGNAL_LOST';

/**
 * Geofence alert
 */
export interface GeofenceAlert {
  event: GeofenceEvent;
  timestamp: Date;
  location: {
    latitude: number;
    longitude: number;
  };
  message: string;
}

/**
 * Generate a unique, secure tracking URL for a load
 *
 * Format: /tracking/{randomToken}
 *
 * @param loadId - Load ID
 * @returns Unique tracking token
 */
export function generateTrackingUrl(loadId: string): string {
  // Generate cryptographically secure random token
  const token = crypto.randomBytes(16).toString('hex');

  // Create tracking URL
  return `/tracking/${token}`;
}

/**
 * Enable GPS tracking for a load when assigned to a truck
 *
 * This function should be called when a load is assigned to a truck with GPS.
 *
 * @param loadId - Load ID
 * @param truckId - Assigned truck ID
 * @returns Tracking URL
 */
export async function enableTrackingForLoad(
  loadId: string,
  truckId: string
): Promise<string> {
  // Check if truck has GPS
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: {
      id: true,
      imei: true,
      gpsStatus: true,
      gpsVerifiedAt: true,
    },
  });

  if (!truck) {
    throw new Error('Truck not found');
  }

  if (!truck.imei) {
    throw new Error('Truck does not have GPS device registered');
  }

  if (!truck.gpsVerifiedAt) {
    throw new Error('Truck GPS has not been verified');
  }

  // Generate tracking URL
  const trackingUrl = generateTrackingUrl(loadId);

  // Enable tracking for the load
  await db.load.update({
    where: { id: loadId },
    data: {
      trackingUrl: trackingUrl,
      trackingEnabled: true,
      trackingStartedAt: new Date(),
    },
  });

  return trackingUrl;
}

/**
 * Disable GPS tracking for a load
 *
 * Called when load is delivered or cancelled.
 *
 * @param loadId - Load ID
 */
export async function disableTrackingForLoad(loadId: string): Promise<void> {
  await db.load.update({
    where: { id: loadId },
    data: {
      trackingEnabled: false,
    },
  });
}

/**
 * Get current live GPS position for a load
 *
 * @param loadId - Load ID
 * @returns GPS position or null if not available
 */
export async function getLoadLivePosition(loadId: string): Promise<GpsPosition | null> {
  // Get load with assigned truck
  const load = await db.load.findUnique({
    where: { id: loadId },
    include: {
      assignedTruck: {
        include: {
          gpsPositions: {
            orderBy: { timestamp: 'desc' },
            take: 1,
          },
        },
      },
    },
  });

  if (!load || !load.assignedTruck) {
    return null;
  }

  if (!load.trackingEnabled) {
    return null;
  }

  // Get latest GPS position
  if (load.assignedTruck.gpsPositions.length === 0) {
    return null;
  }

  const pos = load.assignedTruck.gpsPositions[0];

  return {
    latitude: pos.latitude.toNumber(),
    longitude: pos.longitude.toNumber(),
    speed: pos.speed?.toNumber(),
    heading: pos.heading?.toNumber(),
    altitude: pos.altitude?.toNumber(),
    accuracy: pos.accuracy?.toNumber(),
    timestamp: pos.timestamp,
  };
}

/**
 * Check if tracking is active for a load
 *
 * @param loadId - Load ID
 * @returns true if tracking is enabled
 */
export async function isTrackingActive(loadId: string): Promise<boolean> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: { trackingEnabled: true },
  });

  return load?.trackingEnabled || false;
}

/**
 * Get full tracking status for a load
 *
 * @param loadId - Load ID
 * @returns Tracking status information
 */
export async function getTrackingStatus(loadId: string): Promise<TrackingStatus | null> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      trackingEnabled: true,
      trackingUrl: true,
      trackingStartedAt: true,
      assignedTruck: {
        select: {
          gpsLastSeenAt: true,
          gpsStatus: true,
        },
      },
    },
  });

  if (!load) {
    return null;
  }

  // Get current position
  const position = await getLoadLivePosition(loadId);

  // Determine signal status
  let signalStatus: 'active' | 'weak' | 'lost' = 'lost';
  if (load.assignedTruck?.gpsLastSeenAt) {
    const diffMin = (Date.now() - load.assignedTruck.gpsLastSeenAt.getTime()) / (1000 * 60);
    if (diffMin < 5) {
      signalStatus = 'active';
    } else if (diffMin < 30) {
      signalStatus = 'weak';
    }
  }

  return {
    enabled: load.trackingEnabled,
    trackingUrl: load.trackingUrl,
    startedAt: load.trackingStartedAt,
    currentPosition: position,
    signalStatus,
    lastUpdate: load.assignedTruck?.gpsLastSeenAt || null,
  };
}

/**
 * Calculate distance between two GPS coordinates in meters
 * Uses Haversine formula
 *
 * @param lat1 - Latitude 1
 * @param lon1 - Longitude 1
 * @param lat2 - Latitude 2
 * @param lon2 - Longitude 2
 * @returns Distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Check if truck is within geofence (500m radius)
 *
 * @param truckPosition - Current truck position
 * @param targetLat - Target latitude
 * @param targetLon - Target longitude
 * @param radiusMeters - Geofence radius in meters (default: 500m)
 * @returns true if within geofence
 */
export function isWithinGeofence(
  truckPosition: GpsPosition,
  targetLat: number,
  targetLon: number,
  radiusMeters: number = 500
): boolean {
  const distance = calculateDistance(
    truckPosition.latitude,
    truckPosition.longitude,
    targetLat,
    targetLon
  );

  return distance <= radiusMeters;
}

/**
 * Check for geofence events (arrivals, signal loss)
 *
 * @param loadId - Load ID
 * @returns Array of geofence alerts
 */
export async function checkGeofenceEvents(loadId: string): Promise<GeofenceAlert[]> {
  const alerts: GeofenceAlert[] = [];

  // Get load details
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      status: true,
      originLat: true,
      originLon: true,
      destinationLat: true,
      destinationLon: true,
      trackingEnabled: true,
      assignedTruck: {
        select: {
          gpsLastSeenAt: true,
        },
      },
    },
  });

  if (!load || !load.trackingEnabled) {
    return alerts;
  }

  // Get current position
  const position = await getLoadLivePosition(loadId);

  if (!position) {
    return alerts;
  }

  // Check signal loss (> 30 minutes)
  const lastSeen = load.assignedTruck?.gpsLastSeenAt;
  if (lastSeen) {
    const diffMin = (Date.now() - lastSeen.getTime()) / (1000 * 60);
    if (diffMin > 30) {
      alerts.push({
        event: 'SIGNAL_LOST',
        timestamp: new Date(),
        location: {
          latitude: position.latitude,
          longitude: position.longitude,
        },
        message: `GPS signal lost for ${Math.floor(diffMin)} minutes`,
      });
    }
  }

  // Check arrival at pickup (if IN_TRANSIT status and origin coords available)
  if (load.status === 'IN_TRANSIT' && load.originLat && load.originLon) {
    const atPickup = isWithinGeofence(
      position,
      load.originLat.toNumber(),
      load.originLon.toNumber()
    );

    if (atPickup) {
      alerts.push({
        event: 'ARRIVED_AT_PICKUP',
        timestamp: new Date(),
        location: {
          latitude: position.latitude,
          longitude: position.longitude,
        },
        message: 'Truck arrived at pickup location',
      });
    }
  }

  // Check arrival at destination
  if (load.destinationLat && load.destinationLon) {
    const atDestination = isWithinGeofence(
      position,
      load.destinationLat.toNumber(),
      load.destinationLon.toNumber()
    );

    if (atDestination) {
      alerts.push({
        event: 'ARRIVED_AT_DESTINATION',
        timestamp: new Date(),
        location: {
          latitude: position.latitude,
          longitude: position.longitude,
        },
        message: 'Truck arrived at delivery location',
      });
    }
  }

  return alerts;
}

/**
 * Get load by tracking URL
 *
 * @param trackingUrl - Tracking URL (e.g., "/tracking/abc123")
 * @returns Load ID or null
 */
export async function getLoadByTrackingUrl(trackingUrl: string): Promise<string | null> {
  const load = await db.load.findUnique({
    where: { trackingUrl },
    select: { id: true },
  });

  return load?.id || null;
}

/**
 * Check if user has access to tracking
 *
 * @param loadId - Load ID
 * @param userId - User ID
 * @returns true if user can access tracking
 */
export async function canAccessTracking(loadId: string, userId: string): Promise<boolean> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      shipperId: true,
      createdById: true,
      assignedTruck: {
        select: {
          carrierId: true,
        },
      },
    },
  });

  if (!load) {
    return false;
  }

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      organizationId: true,
      role: true,
    },
  });

  if (!user) {
    return false;
  }

  // Admin and platform ops can always access
  if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
    return true;
  }

  // Shipper can access their own loads
  if (user.organizationId === load.shipperId) {
    return true;
  }

  // Carrier can access assigned loads
  if (load.assignedTruck && user.organizationId === load.assignedTruck.carrierId) {
    return true;
  }

  // Creator can access
  if (user.id === load.createdById) {
    return true;
  }

  return false;
}

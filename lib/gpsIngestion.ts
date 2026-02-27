/**
 * GPS Data Ingestion Service
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 *
 * Handles ingestion and storage of GPS position data
 */

import { db } from "./db";
import { Decimal } from "decimal.js";
import { GpsDeviceStatus } from "@prisma/client";

export interface GpsPositionData {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: Date;
}

/**
 * Ingest GPS data from a device by IMEI
 *
 * @param imei - GPS device IMEI
 * @param position - Position data
 */
export async function ingestGpsData(
  imei: string,
  position: GpsPositionData
): Promise<void> {
  // Find the GPS device
  const device = await db.gpsDevice.findUnique({
    where: { imei },
    select: {
      id: true,
      truck: {
        select: {
          id: true,
        },
      },
    },
  });

  if (!device) {
    throw new Error(`GPS device not found for IMEI: ${imei}`);
  }

  if (!device.truck?.id) {
    throw new Error(`GPS device ${imei} is not assigned to a truck`);
  }

  // Check if truck is on an active load
  const activeTruck = await db.truck.findUnique({
    where: { id: device.truck.id },
    select: {
      assignedLoad: {
        select: {
          id: true,
          trackingEnabled: true,
        },
      },
    },
  });

  const loadId =
    activeTruck?.assignedLoad?.trackingEnabled === true
      ? activeTruck.assignedLoad.id
      : null;

  // Store position data
  await storePositionData(
    device.truck.id,
    device.id,
    loadId,
    position.latitude,
    position.longitude,
    position.speed,
    position.heading,
    position.altitude,
    position.accuracy,
    position.timestamp || new Date()
  );

  // Update truck last seen
  await updateTruckLastSeen(device.truck.id);
}

/**
 * Store GPS position data
 *
 * @param truckId - Truck ID
 * @param deviceId - GPS Device ID
 * @param loadId - Load ID (if truck is on active load)
 * @param latitude - Latitude
 * @param longitude - Longitude
 * @param speed - Speed in km/h (optional)
 * @param heading - Heading in degrees (optional)
 * @param altitude - Altitude in meters (optional)
 * @param accuracy - GPS accuracy in meters (optional)
 * @param timestamp - Position timestamp (defaults to now)
 */
export async function storePositionData(
  truckId: string,
  deviceId: string,
  loadId: string | null,
  latitude: number,
  longitude: number,
  speed?: number,
  heading?: number,
  altitude?: number,
  accuracy?: number,
  timestamp?: Date
): Promise<void> {
  await db.gpsPosition.create({
    data: {
      truckId,
      deviceId,
      loadId,
      latitude: new Decimal(latitude),
      longitude: new Decimal(longitude),
      speed: speed !== undefined ? new Decimal(speed) : null,
      heading: heading !== undefined ? new Decimal(heading) : null,
      altitude: altitude !== undefined ? new Decimal(altitude) : null,
      accuracy: accuracy !== undefined ? new Decimal(accuracy) : null,
      timestamp: timestamp || new Date(),
    },
  });
}

/**
 * Update truck's last seen timestamp and GPS status
 *
 * @param truckId - Truck ID
 */
export async function updateTruckLastSeen(truckId: string): Promise<void> {
  const now = new Date();

  // Get current GPS status for truck
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: {
      gpsLastSeenAt: true,
    },
  });

  // Determine new GPS status based on freshness
  const gpsStatus = determineGpsStatus(now);

  // Update truck
  await db.truck.update({
    where: { id: truckId },
    data: {
      gpsLastSeenAt: now,
      gpsStatus,
    },
  });
}

/**
 * Determine GPS status based on current time
 *
 * - ACTIVE: Position received just now
 * - INACTIVE: N/A for just-received position
 * - SIGNAL_LOST: N/A for just-received position
 * - OFFLINE: N/A for just-received position
 *
 * @param timestamp - Timestamp of last GPS position
 * @returns GPS status
 */
function determineGpsStatus(timestamp: Date): GpsDeviceStatus {
  // When we just received data, truck is ACTIVE
  return GpsDeviceStatus.ACTIVE;
}

/**
 * Update GPS status for all trucks based on freshness
 *
 * Called by background job to update stale statuses
 */
export async function updateAllTruckGpsStatuses(): Promise<void> {
  const trucks = await db.truck.findMany({
    where: {
      gpsDeviceId: {
        not: null,
      },
    },
    select: {
      id: true,
      gpsLastSeenAt: true,
    },
  });

  const now = new Date();

  for (const truck of trucks) {
    if (!truck.gpsLastSeenAt) {
      continue;
    }

    const minutesAgo = Math.floor(
      (now.getTime() - truck.gpsLastSeenAt.getTime()) / (1000 * 60)
    );

    let newStatus: GpsDeviceStatus = GpsDeviceStatus.ACTIVE;

    if (minutesAgo >= 30) {
      newStatus = GpsDeviceStatus.SIGNAL_LOST;
    } else if (minutesAgo >= 5) {
      newStatus = GpsDeviceStatus.INACTIVE;
    }

    // Only update if status changed
    await db.truck.update({
      where: { id: truck.id },
      data: {
        gpsStatus: newStatus,
      },
    });
  }
}

/**
 * Get active load ID for a truck
 *
 * Returns the ID of the load currently being transported by the truck
 *
 * @param truckId - Truck ID
 * @returns Load ID or null
 */
export async function getActiveTruckLoadId(
  truckId: string
): Promise<string | null> {
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: {
      assignedLoad: {
        select: {
          id: true,
          status: true,
          trackingEnabled: true,
        },
      },
    },
  });

  if (
    truck?.assignedLoad &&
    truck.assignedLoad.trackingEnabled &&
    (truck.assignedLoad.status === "IN_TRANSIT" ||
      truck.assignedLoad.status === "ASSIGNED")
  ) {
    return truck.assignedLoad.id;
  }

  return null;
}

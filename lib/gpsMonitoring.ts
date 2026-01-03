/**
 * GPS Background Monitoring Service
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 * Task: Background GPS monitoring cron job
 *
 * Polls GPS devices and updates truck statuses
 */

import { db } from './db';
import { ingestGpsData } from './gpsIngestion';
import { updateAllTruckGpsStatuses } from './gpsIngestion';

export interface GpsDeviceData {
  imei: string;
  gpsDeviceId: string;
  truckId: string;
  truckPlateNumber: string;
  provider: string | null;
  lastSeenAt: Date | null;
}

/**
 * Poll all active GPS devices and update positions
 *
 * This function should be called by a cron job every 30 seconds
 * In production, this would call GPS provider APIs
 *
 * @returns Summary of polling results
 */
export async function pollAllGpsDevices(): Promise<{
  polled: number;
  successful: number;
  failed: number;
  errors: string[];
}> {
  const summary = {
    polled: 0,
    successful: 0,
    failed: 0,
    errors: [] as string[],
  };

  try {
    // Get all active GPS devices
    const devices = await getActiveGpsDevices();
    summary.polled = devices.length;

    // Poll each device
    for (const device of devices) {
      try {
        await pollGpsDevice(device);
        summary.successful++;
      } catch (error) {
        summary.failed++;
        summary.errors.push(
          `Device ${device.imei}: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    }

    // Update GPS statuses for all trucks based on freshness
    await updateAllTruckGpsStatuses();

    return summary;
  } catch (error) {
    console.error('GPS polling error:', error);
    throw error;
  }
}

/**
 * Get all active GPS devices that should be polled
 *
 * @returns Array of GPS device data
 */
export async function getActiveGpsDevices(): Promise<GpsDeviceData[]> {
  const devices = await db.gpsDevice.findMany({
    where: {
      isActive: true,
      truck: {
        isNot: null,
      },
    },
    select: {
      id: true,
      imei: true,
      provider: true,
      lastSeenAt: true,
      truck: {
        select: {
          id: true,
          plateNumber: true,
        },
      },
    },
  });

  return devices.map((device) => ({
    imei: device.imei,
    gpsDeviceId: device.id,
    truckId: device.truck!.id,
    truckPlateNumber: device.truck!.plateNumber,
    provider: device.provider,
    lastSeenAt: device.lastSeenAt,
  }));
}

/**
 * Poll a single GPS device for its current position
 *
 * In production, this would make an API call to the GPS provider
 * For MVP/testing, we simulate GPS data or skip polling
 *
 * @param device - GPS device data
 */
export async function pollGpsDevice(device: GpsDeviceData): Promise<void> {
  // In production, call GPS provider API based on device.provider
  // For now, we'll simulate or skip actual polling

  // Example for production:
  // const position = await fetchGpsProviderApi(device.imei, device.provider);
  // await ingestGpsData(device.imei, position);

  // MVP: Skip actual polling, devices will be updated when they push data
  // or when testing APIs are called manually

  // For testing purposes, you could uncomment this to generate fake data:
  /*
  const fakePosition = {
    latitude: 9.0 + Math.random() * 0.1, // Near Addis Ababa
    longitude: 38.7 + Math.random() * 0.1,
    speed: Math.random() * 80, // 0-80 km/h
    heading: Math.random() * 360, // 0-360 degrees
    altitude: 2300 + Math.random() * 100, // ~2300m elevation
    accuracy: 5 + Math.random() * 5, // 5-10m accuracy
    timestamp: new Date(),
  };
  await ingestGpsData(device.imei, fakePosition);
  */
}

/**
 * Fetch GPS position from provider API
 *
 * This is a placeholder for production GPS provider integration
 * Each provider (e.g., Teltonika, Concox, etc.) has different APIs
 *
 * @param imei - GPS device IMEI
 * @param provider - GPS provider name
 * @returns GPS position data
 */
export async function fetchGpsProviderApi(
  imei: string,
  provider: string | null
): Promise<{
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: Date;
}> {
  // Production implementation would switch based on provider
  switch (provider) {
    case 'TELTONIKA':
      // return await fetchTeltonikaApi(imei);
      break;
    case 'CONCOX':
      // return await fetchConcoxApi(imei);
      break;
    case 'QUECLINK':
      // return await fetchQueclinkApi(imei);
      break;
    default:
      // Generic GPS provider API call
      break;
  }

  throw new Error(`GPS provider ${provider} not implemented`);
}

/**
 * Check for trucks that have gone offline and need alerts
 *
 * Called after GPS status updates to detect newly offline trucks
 *
 * @returns Array of truck IDs that went offline
 */
export async function checkForOfflineTrucks(): Promise<string[]> {
  // Get trucks with active loads that recently went offline
  const offlineTrucks = await db.truck.findMany({
    where: {
      gpsStatus: 'SIGNAL_LOST',
      assignedLoadId: {
        not: null,
      },
      assignedLoad: {
        status: {
          in: ['IN_TRANSIT', 'ASSIGNED'],
        },
      },
    },
    select: {
      id: true,
      plateNumber: true,
      gpsLastSeenAt: true,
      assignedLoad: {
        select: {
          id: true,
          loadNumber: true,
        },
      },
    },
  });

  return offlineTrucks.map((truck) => truck.id);
}

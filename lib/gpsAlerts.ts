/**
 * GPS Alert System
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 * Task: GPS alert system for truck offline events
 *
 * Handles GPS-related alerts and notifications
 */

import { db } from './db';
import { createNotification } from './notifications';

export interface GpsAlertEvent {
  type: 'GPS_OFFLINE' | 'GPS_SIGNAL_LOST' | 'GPS_BACK_ONLINE';
  truckId: string;
  loadId?: string;
  timestamp: Date;
  details?: Record<string, any>;
}

/**
 * Trigger GPS offline alerts for trucks with active loads
 *
 * Called when trucks go offline during active deliveries
 *
 * @param truckIds - Array of truck IDs that went offline
 */
export async function triggerGpsOfflineAlerts(
  truckIds: string[]
): Promise<void> {
  for (const truckId of truckIds) {
    try {
      await sendGpsOfflineAlert(truckId);
    } catch (error) {
      console.error(`Failed to send offline alert for truck ${truckId}:`, error);
    }
  }
}

/**
 * Send GPS offline alert for a specific truck
 *
 * @param truckId - Truck ID
 */
export async function sendGpsOfflineAlert(truckId: string): Promise<void> {
  // Get truck details with active load
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: {
      id: true,
      plateNumber: true,
      gpsLastSeenAt: true,
      gpsStatus: true,
      organization: {
        select: {
          id: true,
          name: true,
          users: {
            where: {
              role: {
                in: ['CARRIER', 'DISPATCHER', 'ADMIN'],
              },
            },
            select: {
              id: true,
              email: true,
            },
          },
        },
      },
      assignedLoad: {
        select: {
          id: true,
          loadNumber: true,
          status: true,
          shipper: {
            select: {
              id: true,
              name: true,
              users: {
                where: {
                  role: {
                    in: ['SHIPPER', 'ADMIN'],
                  },
                },
                select: {
                  id: true,
                  email: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!truck || !truck.assignedLoad) {
    return; // No active load, skip alert
  }

  const minutesOffline = truck.gpsLastSeenAt
    ? Math.floor((Date.now() - truck.gpsLastSeenAt.getTime()) / (1000 * 60))
    : 0;

  // Create notification for carrier organization
  for (const user of truck.organization.users) {
    await createNotification({
      userId: user.id,
      type: 'GPS_OFFLINE',
      title: `GPS Signal Lost: ${truck.plateNumber}`,
      message: `Truck ${truck.plateNumber} on Load #${truck.assignedLoad.loadNumber} has lost GPS signal (offline for ${minutesOffline} minutes).`,
      priority: 'HIGH',
      metadata: {
        truckId: truck.id,
        loadId: truck.assignedLoad.id,
        minutesOffline,
        gpsStatus: truck.gpsStatus,
      },
    });
  }

  // Create notification for shipper organization
  for (const user of truck.assignedLoad.shipper.users) {
    await createNotification({
      userId: user.id,
      type: 'GPS_OFFLINE',
      title: `Tracking Alert: Load #${truck.assignedLoad.loadNumber}`,
      message: `GPS tracking for Load #${truck.assignedLoad.loadNumber} is currently unavailable. The carrier has been notified.`,
      priority: 'MEDIUM',
      metadata: {
        truckId: truck.id,
        loadId: truck.assignedLoad.id,
        minutesOffline,
      },
    });
  }

  console.log(
    `[GPS Alert] Offline alert sent for truck ${truck.plateNumber} (Load #${truck.assignedLoad.loadNumber})`
  );
}

/**
 * Send GPS back online alert
 *
 * Called when a truck that was offline comes back online
 *
 * @param truckId - Truck ID
 */
export async function sendGpsBackOnlineAlert(truckId: string): Promise<void> {
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: {
      id: true,
      plateNumber: true,
      gpsStatus: true,
      organization: {
        select: {
          users: {
            where: {
              role: {
                in: ['CARRIER', 'DISPATCHER', 'ADMIN'],
              },
            },
            select: {
              id: true,
            },
          },
        },
      },
      assignedLoad: {
        select: {
          id: true,
          loadNumber: true,
          shipper: {
            select: {
              users: {
                where: {
                  role: {
                    in: ['SHIPPER', 'ADMIN'],
                  },
                },
                select: {
                  id: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!truck || !truck.assignedLoad) {
    return;
  }

  // Notify carrier
  for (const user of truck.organization.users) {
    await createNotification({
      userId: user.id,
      type: 'GPS_BACK_ONLINE',
      title: `GPS Restored: ${truck.plateNumber}`,
      message: `GPS signal has been restored for truck ${truck.plateNumber}.`,
      priority: 'LOW',
      metadata: {
        truckId: truck.id,
        loadId: truck.assignedLoad.id,
      },
    });
  }

  // Notify shipper
  for (const user of truck.assignedLoad.shipper.users) {
    await createNotification({
      userId: user.id,
      type: 'GPS_BACK_ONLINE',
      title: `Tracking Restored: Load #${truck.assignedLoad.loadNumber}`,
      message: `GPS tracking has been restored for Load #${truck.assignedLoad.loadNumber}.`,
      priority: 'LOW',
      metadata: {
        truckId: truck.id,
        loadId: truck.assignedLoad.id,
      },
    });
  }

  console.log(
    `[GPS Alert] Back online alert sent for truck ${truck.plateNumber}`
  );
}

/**
 * Check if a truck just went offline (status changed to SIGNAL_LOST)
 *
 * This should be called after GPS status updates to detect state changes
 *
 * @param truckId - Truck ID
 * @param oldStatus - Previous GPS status
 * @param newStatus - New GPS status
 */
export async function handleGpsStatusChange(
  truckId: string,
  oldStatus: string,
  newStatus: string
): Promise<void> {
  // Truck went offline
  if (oldStatus !== 'SIGNAL_LOST' && newStatus === 'SIGNAL_LOST') {
    await sendGpsOfflineAlert(truckId);
  }

  // Truck came back online
  if (
    oldStatus === 'SIGNAL_LOST' &&
    (newStatus === 'ACTIVE' || newStatus === 'INACTIVE')
  ) {
    await sendGpsBackOnlineAlert(truckId);
  }
}

/**
 * Get GPS alert statistics
 *
 * For admin dashboard showing GPS reliability metrics
 *
 * @param startDate - Start date (optional)
 * @param endDate - End date (optional)
 * @returns GPS alert statistics
 */
export async function getGpsAlertStats(
  startDate?: Date,
  endDate?: Date
): Promise<{
  totalOfflineEvents: number;
  avgOfflineMinutes: number;
  trucksCurrentlyOffline: number;
  mostUnreliableTrucks: Array<{
    truckId: string;
    plateNumber: string;
    offlineEvents: number;
  }>;
}> {
  // Get currently offline trucks with active loads
  const offlineTrucks = await db.truck.count({
    where: {
      gpsStatus: 'SIGNAL_LOST',
      assignedLoadId: {
        not: null,
      },
    },
  });

  // This is a simplified version
  // In production, you'd track offline events in a separate table
  return {
    totalOfflineEvents: 0, // Would come from event tracking table
    avgOfflineMinutes: 0, // Would be calculated from event durations
    trucksCurrentlyOffline: offlineTrucks,
    mostUnreliableTrucks: [], // Would come from event aggregation
  };
}

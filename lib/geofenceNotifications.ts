/**
 * Geofence Notification System
 *
 * Sprint 16 - Story 16.10: User Notifications for GPS & Settlement Events
 * Task: Implement GPS event notifications (geofence arrivals)
 *
 * Handles notifications for geofence events (truck arrivals at pickup/delivery)
 */

import { db } from "./db";
import { createNotification } from "./notifications";
import { checkGeofenceEvents, GeofenceAlert } from "./gpsTracking";
import { sendEmailToUser, EmailTemplate } from "./emailService";

// In-memory cache to track recent geofence events (prevent duplicates)
const recentGeofenceEvents = new Map<string, Date>();
const GEOFENCE_EVENT_COOLDOWN_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Check for geofence events for all active loads
 *
 * Called by GPS monitoring cron job
 *
 * @returns Number of notifications sent
 */
export async function checkAllGeofenceEvents(): Promise<number> {
  let notificationCount = 0;

  // Get all loads with active tracking
  const activeLoads = await db.load.findMany({
    where: {
      trackingEnabled: true,
      status: {
        in: ["ASSIGNED", "IN_TRANSIT", "PICKUP_PENDING"],
      },
    },
    select: {
      id: true,
      status: true,
    },
  });

  // Check geofence events for each load
  for (const load of activeLoads) {
    try {
      const alerts = await checkGeofenceEvents(load.id);

      for (const alert of alerts) {
        const sent = await handleGeofenceAlert(load.id, alert);
        if (sent) {
          notificationCount++;
        }
      }
    } catch (error) {
      console.error(`Geofence check failed for load ${load.id}:`, error);
    }
  }

  // Cleanup old events from cache
  cleanupGeofenceEventCache();

  return notificationCount;
}

/**
 * Handle a geofence alert and send notifications
 *
 * @param loadId - Load ID
 * @param alert - Geofence alert
 * @returns true if notification was sent
 */
async function handleGeofenceAlert(
  loadId: string,
  alert: GeofenceAlert
): Promise<boolean> {
  // Check if we already sent a notification for this event recently
  const eventKey = `${loadId}:${alert.event}`;
  const lastEventTime = recentGeofenceEvents.get(eventKey);

  if (lastEventTime) {
    const timeSinceLastEvent = Date.now() - lastEventTime.getTime();
    if (timeSinceLastEvent < GEOFENCE_EVENT_COOLDOWN_MS) {
      // Skip duplicate notification (within cooldown period)
      return false;
    }
  }

  // Send notifications based on event type
  switch (alert.event) {
    case "ARRIVED_AT_PICKUP":
      await sendPickupArrivalNotification(loadId, alert);
      break;
    case "ARRIVED_AT_DESTINATION":
      await sendDeliveryArrivalNotification(loadId, alert);
      break;
    case "SIGNAL_LOST":
      // Signal loss is already handled by gpsAlerts.ts
      return false;
    default:
      return false;
  }

  // Record this event to prevent duplicates
  recentGeofenceEvents.set(eventKey, new Date());

  return true;
}

/**
 * Send notification when truck arrives at pickup location
 *
 * @param loadId - Load ID
 * @param alert - Geofence alert
 */
async function sendPickupArrivalNotification(
  loadId: string,
  alert: GeofenceAlert
): Promise<void> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipper: {
        select: {
          id: true,
          name: true,
          users: {
            where: {
              role: {
                in: ["SHIPPER", "ADMIN"],
              },
            },
            select: {
              id: true,
            },
          },
        },
      },
      assignedTruck: {
        select: {
          id: true,
          licensePlate: true,
          carrier: {
            select: {
              id: true,
              users: {
                where: {
                  role: {
                    in: ["CARRIER", "DISPATCHER", "ADMIN"],
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

  if (!load || !load.assignedTruck) {
    return;
  }

  // Send all notifications and emails in parallel
  await Promise.all([
    // Shipper notifications + emails
    ...load.shipper.users.flatMap((user) => [
      createNotification({
        userId: user.id,
        type: "TRUCK_AT_PICKUP",
        title: `Truck Arrived: Load #${load.id.slice(-8)}`,
        message: `Truck ${load.assignedTruck!.licensePlate} has arrived at the pickup location.`,
        metadata: {
          loadId: load.id,
          event: "ARRIVED_AT_PICKUP",
          location: alert.location,
          timestamp: alert.timestamp,
        },
      }),
      sendEmailToUser(user.id, EmailTemplate.TRUCK_AT_PICKUP, {
        truckPlate: load.assignedTruck!.licensePlate,
        loadId: load.id,
      }),
    ]),
    // Carrier notifications
    ...load.assignedTruck.carrier.users.map((user) =>
      createNotification({
        userId: user.id,
        type: "TRUCK_AT_PICKUP",
        title: `Arrival Confirmed: ${load.assignedTruck!.licensePlate}`,
        message: `Your truck ${load.assignedTruck!.licensePlate} has arrived at the pickup location for Load #${load.id.slice(-8)}.`,
        metadata: {
          loadId: load.id,
          event: "ARRIVED_AT_PICKUP",
          location: alert.location,
          timestamp: alert.timestamp,
        },
      })
    ),
  ]);
}

/**
 * Send notification when truck arrives at delivery location
 *
 * @param loadId - Load ID
 * @param alert - Geofence alert
 */
async function sendDeliveryArrivalNotification(
  loadId: string,
  alert: GeofenceAlert
): Promise<void> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      shipper: {
        select: {
          id: true,
          name: true,
          users: {
            where: {
              role: {
                in: ["SHIPPER", "ADMIN"],
              },
            },
            select: {
              id: true,
            },
          },
        },
      },
      assignedTruck: {
        select: {
          id: true,
          licensePlate: true,
          carrier: {
            select: {
              id: true,
              users: {
                where: {
                  role: {
                    in: ["CARRIER", "DISPATCHER", "ADMIN"],
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

  if (!load || !load.assignedTruck) {
    return;
  }

  // Send all notifications and emails in parallel
  await Promise.all([
    // Shipper notifications + emails
    ...load.shipper.users.flatMap((user) => [
      createNotification({
        userId: user.id,
        type: "TRUCK_AT_DELIVERY",
        title: `Delivery Imminent: Load #${load.id.slice(-8)}`,
        message: `Truck ${load.assignedTruck!.licensePlate} has arrived at the delivery location. Please prepare to receive the shipment.`,
        metadata: {
          loadId: load.id,
          event: "ARRIVED_AT_DESTINATION",
          location: alert.location,
          timestamp: alert.timestamp,
        },
      }),
      sendEmailToUser(user.id, EmailTemplate.TRUCK_AT_DELIVERY, {
        truckPlate: load.assignedTruck!.licensePlate,
        loadId: load.id,
      }),
    ]),
    // Carrier notifications
    ...load.assignedTruck.carrier.users.map((user) =>
      createNotification({
        userId: user.id,
        type: "TRUCK_AT_DELIVERY",
        title: `Destination Reached: ${load.assignedTruck!.licensePlate}`,
        message: `Your truck has arrived at the delivery location for Load #${load.id.slice(-8)}. Please complete POD submission.`,
        metadata: {
          loadId: load.id,
          event: "ARRIVED_AT_DESTINATION",
          location: alert.location,
          timestamp: alert.timestamp,
        },
      })
    ),
  ]);
}

/**
 * Clean up old geofence events from cache
 *
 * Removes events older than cooldown period to prevent memory leaks
 */
function cleanupGeofenceEventCache(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  recentGeofenceEvents.forEach((timestamp, key) => {
    const age = now - timestamp.getTime();
    if (age > GEOFENCE_EVENT_COOLDOWN_MS * 2) {
      keysToDelete.push(key);
    }
  });

  keysToDelete.forEach((key) => recentGeofenceEvents.delete(key));

  if (keysToDelete.length > 0) {
  }
}

/**
 * Manually check geofence for a specific load
 *
 * For testing or manual trigger
 *
 * @param loadId - Load ID
 * @returns Array of alerts that triggered notifications
 */
export async function checkLoadGeofence(
  loadId: string
): Promise<GeofenceAlert[]> {
  const alerts = await checkGeofenceEvents(loadId);
  const triggeredAlerts: GeofenceAlert[] = [];

  for (const alert of alerts) {
    const sent = await handleGeofenceAlert(loadId, alert);
    if (sent) {
      triggeredAlerts.push(alert);
    }
  }

  return triggeredAlerts;
}

/**
 * Sprint 5: Automated Exception Detection
 *
 * Rules and logic for automatically detecting and creating exceptions
 * based on load status, GPS data, and business rules
 */

import { db } from '@/lib/db';

export interface ExceptionRule {
  type: string;
  shouldTrigger: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  description: string;
}

/**
 * Check for late pickup exception
 * Triggers when: Current time > pickup time + grace period and status is ASSIGNED or PICKUP_PENDING
 */
export async function checkLatePickup(loadId: string): Promise<ExceptionRule | null> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      status: true,
      pickupDate: true,
      pickupCity: true,
      deliveryCity: true,
    },
  });

  if (!load) return null;

  // Only check if load is in pre-pickup status
  if (load.status !== 'ASSIGNED' && load.status !== 'PICKUP_PENDING') {
    return null;
  }

  const now = new Date();
  const pickupTime = new Date(load.pickupDate);
  const gracePeriodHours = 2; // 2 hours grace period
  const gracePeriodMs = gracePeriodHours * 60 * 60 * 1000;

  // Check if current time is past pickup time + grace period
  if (now.getTime() > pickupTime.getTime() + gracePeriodMs) {
    const hoursLate = Math.floor((now.getTime() - pickupTime.getTime()) / (60 * 60 * 1000));

    return {
      type: 'LATE_PICKUP',
      shouldTrigger: true,
      priority: hoursLate > 4 ? 'HIGH' : 'MEDIUM',
      title: `Pickup is ${hoursLate} hours late`,
      description: `Scheduled pickup at ${pickupTime.toLocaleString()} has not occurred. Current status: ${load.status}`,
    };
  }

  return null;
}

/**
 * Check for late delivery exception
 * Triggers when: Current time > delivery time + grace period and status is IN_TRANSIT
 */
export async function checkLateDelivery(loadId: string): Promise<ExceptionRule | null> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      status: true,
      deliveryDate: true,
      pickupCity: true,
      deliveryCity: true,
    },
  });

  if (!load) return null;

  // Only check if load is in transit
  if (load.status !== 'IN_TRANSIT') {
    return null;
  }

  const now = new Date();
  const deliveryTime = new Date(load.deliveryDate);
  const gracePeriodHours = 2; // 2 hours grace period
  const gracePeriodMs = gracePeriodHours * 60 * 60 * 1000;

  // Check if current time is past delivery time + grace period
  if (now.getTime() > deliveryTime.getTime() + gracePeriodMs) {
    const hoursLate = Math.floor((now.getTime() - deliveryTime.getTime()) / (60 * 60 * 1000));

    return {
      type: 'LATE_DELIVERY',
      shouldTrigger: true,
      priority: hoursLate > 4 ? 'CRITICAL' : 'HIGH',
      title: `Delivery is ${hoursLate} hours late`,
      description: `Scheduled delivery at ${deliveryTime.toLocaleString()} has not occurred. Load still in transit.`,
    };
  }

  return null;
}

/**
 * Check for GPS offline exception
 * Triggers when: No GPS data received for X hours and load is active
 */
export async function checkGpsOffline(loadId: string): Promise<ExceptionRule | null> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      status: true,
      trackingEnabled: true,
      assignedTruck: {
        select: {
          id: true,
          licensePlate: true,
          imei: true,
        },
      },
    },
  });

  if (!load) return null;

  // Only check if load has tracking enabled
  if (!load.trackingEnabled || !load.assignedTruck?.imei) {
    return null;
  }

  // Only check for active loads
  if (!['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'].includes(load.status)) {
    return null;
  }

  // Get last GPS position
  const lastPosition = await db.gpsPosition.findFirst({
    where: {
      truckId: load.assignedTruck.id,
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      timestamp: true,
    },
  });

  if (!lastPosition) {
    // No GPS data at all
    return {
      type: 'GPS_OFFLINE',
      shouldTrigger: true,
      priority: 'HIGH',
      title: 'GPS device has no data',
      description: `Truck ${load.assignedTruck.licensePlate} has not sent any GPS data since tracking was enabled.`,
    };
  }

  const now = new Date();
  const lastUpdate = new Date(lastPosition.timestamp);
  const offlineThresholdHours = 4; // 4 hours without GPS data
  const offlineThresholdMs = offlineThresholdHours * 60 * 60 * 1000;

  if (now.getTime() - lastUpdate.getTime() > offlineThresholdMs) {
    const hoursOffline = Math.floor((now.getTime() - lastUpdate.getTime()) / (60 * 60 * 1000));

    return {
      type: 'GPS_OFFLINE',
      shouldTrigger: true,
      priority: hoursOffline > 8 ? 'CRITICAL' : 'HIGH',
      title: `GPS offline for ${hoursOffline} hours`,
      description: `Last GPS update from truck ${load.assignedTruck.licensePlate} was ${hoursOffline} hours ago at ${lastUpdate.toLocaleString()}.`,
    };
  }

  return null;
}

/**
 * Check for stalled load exception
 * Triggers when: Truck hasn't moved significantly for X hours during IN_TRANSIT
 */
export async function checkStalledLoad(loadId: string): Promise<ExceptionRule | null> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      status: true,
      trackingEnabled: true,
      assignedTruck: {
        select: {
          id: true,
          licensePlate: true,
          imei: true,
        },
      },
    },
  });

  if (!load) return null;

  // Only check if load is in transit with tracking
  if (load.status !== 'IN_TRANSIT' || !load.trackingEnabled || !load.assignedTruck?.imei) {
    return null;
  }

  // Get GPS positions from last 4 hours
  const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
  const positions = await db.gpsPosition.findMany({
    where: {
      truckId: load.assignedTruck.id,
      timestamp: {
        gte: fourHoursAgo,
      },
    },
    orderBy: {
      timestamp: 'desc',
    },
    select: {
      latitude: true,
      longitude: true,
      timestamp: true,
    },
  });

  if (positions.length < 2) {
    return null; // Not enough data
  }

  // Calculate max distance moved in last 4 hours
  let maxDistance = 0;
  for (let i = 0; i < positions.length - 1; i++) {
    const dist = calculateDistance(
      parseFloat(positions[i].latitude.toString()),
      parseFloat(positions[i].longitude.toString()),
      parseFloat(positions[i + 1].latitude.toString()),
      parseFloat(positions[i + 1].longitude.toString())
    );
    maxDistance = Math.max(maxDistance, dist);
  }

  const stalledThresholdKm = 1; // Less than 1km movement in 4 hours

  if (maxDistance < stalledThresholdKm) {
    return {
      type: 'TRUCK_BREAKDOWN',
      shouldTrigger: true,
      priority: 'CRITICAL',
      title: 'Truck appears stalled for 4+ hours',
      description: `Truck ${load.assignedTruck.licensePlate} has moved less than ${stalledThresholdKm}km in the last 4 hours. Possible breakdown or issue.`,
    };
  }

  return null;
}

/**
 * Check all exception rules for a load
 * Returns array of triggered rules
 */
export async function checkAllRules(loadId: string): Promise<ExceptionRule[]> {
  const results = await Promise.all([
    checkLatePickup(loadId),
    checkLateDelivery(loadId),
    checkGpsOffline(loadId),
    checkStalledLoad(loadId),
  ]);

  return results.filter((rule): rule is ExceptionRule => rule !== null);
}

/**
 * Auto-create escalations for triggered rules
 * Prevents duplicate escalations for the same issue
 */
export async function autoCreateEscalations(loadId: string, createdBy: string = 'SYSTEM') {
  const triggeredRules = await checkAllRules(loadId);

  if (triggeredRules.length === 0) {
    return { created: 0, rules: [] };
  }

  const createdEscalations = [];

  for (const rule of triggeredRules) {
    // Check if escalation already exists for this type
    const existingEscalation = await db.loadEscalation.findFirst({
      where: {
        loadId,
        escalationType: rule.type as any,
        status: {
          in: ['OPEN', 'ASSIGNED', 'IN_PROGRESS'],
        },
      },
    });

    // Don't create duplicate escalations
    if (existingEscalation) {
      continue;
    }

    // Create escalation
    const escalation = await db.loadEscalation.create({
      data: {
        loadId,
        escalationType: rule.type as any,
        priority: rule.priority,
        title: rule.title,
        description: rule.description,
        createdBy,
        status: 'OPEN',
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: 'ESCALATION_AUTO_CREATED',
        description: `Auto-created escalation: ${rule.title}`,
        metadata: {
          escalationId: escalation.id,
          escalationType: rule.type,
          priority: rule.priority,
          autoDetected: true,
        },
      },
    });

    createdEscalations.push(escalation);
  }

  return {
    created: createdEscalations.length,
    rules: triggeredRules,
    escalations: createdEscalations,
  };
}

/**
 * Calculate distance between two GPS coordinates in kilometers
 * Using Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

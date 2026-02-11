/**
 * Trip Progress Tracking Module
 *
 * Service Fee Implementation - Task 4
 *
 * Calculates and updates trip progress based on GPS positions.
 * Triggers return-load notifications at 80% progress or destination geofence entry.
 */

import { db } from '@/lib/db';
import { calculateDistance, getLoadLivePosition, isWithinGeofence } from './gpsTracking';
import { Decimal } from 'decimal.js';

export interface TripProgressInfo {
  progressPercent: number;
  remainingKm: number;
  totalDistanceKm: number;
  travelledKm: number;
  estimatedArrival: Date | null;
  isNearDestination: boolean;
  enteredDestGeofence: boolean;
}

export interface TripProgressUpdate {
  loadId: string;
  previousProgress: number;
  newProgress: number;
  enteredDestGeofence: boolean;
  triggersReturnLoad: boolean;
}

/**
 * Calculate trip progress based on current GPS position
 *
 * Progress is calculated as:
 * - Distance from origin to current position / Total route distance
 * - Capped at 100%
 *
 * @param loadId - Load ID
 * @returns Trip progress information
 */
export async function calculateTripProgress(loadId: string): Promise<TripProgressInfo | null> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      status: true,
      originLat: true,
      originLon: true,
      destinationLat: true,
      destinationLon: true,
      estimatedTripKm: true,
      tripKm: true,
      corridor: {
        select: {
          distanceKm: true,
        },
      },
      tripProgressPercent: true,
      enteredDestGeofence: true,
      trackingEnabled: true,
    },
  });

  if (!load) {
    return null;
  }

  // DISTANCE PRIORITY LOGIC — INTENTIONAL DIFFERENCE DOCUMENTED (2026-02-07)
  //
  // RATIONALE: Progress calculation uses PLANNED distance as the reference
  // because we need a consistent total to measure progress against.
  // GPS actual distance grows as the trip progresses and would cause
  // the percentage to fluctuate incorrectly.
  //
  // Priority: corridor.distanceKm > estimatedTripKm > tripKm
  //
  // CONTRAST with lib/serviceFeeManagement.ts which uses:
  // actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm
  // (Fee calculation uses actual GPS distance when available for accuracy)
  //
  // Get total route distance (from corridor, estimatedTripKm, or tripKm)
  let totalDistanceKm = 0;
  if (load.corridor?.distanceKm) {
    totalDistanceKm = Number(load.corridor.distanceKm);
  } else if (load.estimatedTripKm) {
    totalDistanceKm = Number(load.estimatedTripKm);
  } else if (load.tripKm) {
    totalDistanceKm = Number(load.tripKm);
  }

  // If no distance available, can't calculate progress
  if (totalDistanceKm <= 0) {
    return {
      progressPercent: load.tripProgressPercent || 0,
      remainingKm: 0,
      totalDistanceKm: 0,
      travelledKm: 0,
      estimatedArrival: null,
      isNearDestination: false,
      enteredDestGeofence: load.enteredDestGeofence,
    };
  }

  // Get current GPS position
  const currentPosition = await getLoadLivePosition(loadId);

  if (!currentPosition) {
    // No GPS position available, return stored progress
    return {
      progressPercent: load.tripProgressPercent || 0,
      remainingKm: totalDistanceKm,
      totalDistanceKm,
      travelledKm: 0,
      estimatedArrival: null,
      isNearDestination: false,
      enteredDestGeofence: load.enteredDestGeofence,
    };
  }

  // Check if we have origin and destination coordinates
  if (!load.originLat || !load.originLon || !load.destinationLat || !load.destinationLon) {
    return {
      progressPercent: load.tripProgressPercent || 0,
      remainingKm: totalDistanceKm,
      totalDistanceKm,
      travelledKm: 0,
      estimatedArrival: null,
      isNearDestination: false,
      enteredDestGeofence: load.enteredDestGeofence,
    };
  }

  const originLat = Number(load.originLat);
  const originLon = Number(load.originLon);
  const destLat = Number(load.destinationLat);
  const destLon = Number(load.destinationLon);

  // Calculate distances
  const distanceFromOriginMeters = calculateDistance(
    originLat,
    originLon,
    currentPosition.latitude,
    currentPosition.longitude
  );

  const distanceToDestMeters = calculateDistance(
    currentPosition.latitude,
    currentPosition.longitude,
    destLat,
    destLon
  );

  const distanceFromOriginKm = distanceFromOriginMeters / 1000;
  const distanceToDestKm = distanceToDestMeters / 1000;

  // Calculate progress percentage
  // Use remaining distance to destination for more accurate progress
  let progressPercent = 0;
  if (totalDistanceKm > 0) {
    const remainingRatio = distanceToDestKm / totalDistanceKm;
    progressPercent = Math.max(0, Math.min(100, (1 - remainingRatio) * 100));
  }

  // Round to integer
  progressPercent = Math.round(progressPercent);

  // Check if within destination geofence (500m)
  const isNearDestination = isWithinGeofence(
    currentPosition,
    destLat,
    destLon,
    500 // 500 meters
  );

  // Estimate arrival time based on current speed
  let estimatedArrival: Date | null = null;
  if (currentPosition.speed && currentPosition.speed > 0 && distanceToDestKm > 0) {
    const hoursRemaining = distanceToDestKm / currentPosition.speed;
    estimatedArrival = new Date(Date.now() + hoursRemaining * 60 * 60 * 1000);
  }

  return {
    progressPercent,
    remainingKm: Math.round(distanceToDestKm * 100) / 100,
    totalDistanceKm,
    travelledKm: Math.round(distanceFromOriginKm * 100) / 100,
    estimatedArrival,
    isNearDestination,
    enteredDestGeofence: load.enteredDestGeofence || isNearDestination,
  };
}

/**
 * Update trip progress for a load
 *
 * Called periodically by GPS update webhook or cron job.
 * Updates the load's progress fields and checks for return-load triggers.
 *
 * @param loadId - Load ID
 * @returns Progress update result
 */
export async function updateTripProgress(loadId: string): Promise<TripProgressUpdate | null> {
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      status: true,
      tripProgressPercent: true,
      enteredDestGeofence: true,
      trackingEnabled: true,
    },
  });

  if (!load) {
    return null;
  }

  // Only update progress for IN_TRANSIT loads with tracking enabled
  if (load.status !== 'IN_TRANSIT' || !load.trackingEnabled) {
    return null;
  }

  const previousProgress = load.tripProgressPercent || 0;
  const previousGeofence = load.enteredDestGeofence;

  // Calculate current progress
  const progress = await calculateTripProgress(loadId);

  if (!progress) {
    return null;
  }

  // Check if this update triggers return-load notification
  const triggersReturnLoad =
    // First time reaching 80%
    (previousProgress < 80 && progress.progressPercent >= 80) ||
    // First time entering destination geofence
    (!previousGeofence && progress.enteredDestGeofence);

  // Update load with new progress
  await db.load.update({
    where: { id: loadId },
    data: {
      tripProgressPercent: progress.progressPercent,
      remainingDistanceKm: new Decimal(progress.remainingKm),
      lastProgressUpdateAt: new Date(),
      enteredDestGeofence: progress.enteredDestGeofence,
      enteredDestGeofenceAt: progress.enteredDestGeofence && !previousGeofence
        ? new Date()
        : undefined,
    },
  });

  return {
    loadId,
    previousProgress,
    newProgress: progress.progressPercent,
    enteredDestGeofence: progress.enteredDestGeofence,
    triggersReturnLoad,
  };
}

/**
 * Update progress for all active IN_TRANSIT loads
 *
 * Called by cron job to batch update all loads.
 *
 * @returns Array of updates with return-load triggers
 */
export async function updateAllActiveLoadProgress(): Promise<TripProgressUpdate[]> {
  // Get all IN_TRANSIT loads with tracking enabled
  const activeLoads = await db.load.findMany({
    where: {
      status: 'IN_TRANSIT',
      trackingEnabled: true,
    },
    select: {
      id: true,
    },
  });

  const updates: TripProgressUpdate[] = [];

  for (const load of activeLoads) {
    try {
      const update = await updateTripProgress(load.id);
      if (update) {
        updates.push(update);
      }
    } catch (error) {
      console.error(`Error updating progress for load ${load.id}:`, error);
    }
  }

  return updates;
}

/**
 * Get loads that need return-load notifications
 *
 * Returns loads that have just:
 * - Reached 80% progress
 * - Entered destination geofence
 *
 * @param updates - Array of recent progress updates
 * @returns Loads needing return-load notification
 */
export function getLoadsNeedingReturnLoadNotification(
  updates: TripProgressUpdate[]
): TripProgressUpdate[] {
  return updates.filter((u) => u.triggersReturnLoad);
}

/**
 * Check if a load should trigger return-load notification
 *
 * @param loadId - Load ID
 * @returns true if should trigger notification
 */
export async function shouldTriggerReturnLoadNotification(loadId: string): Promise<boolean> {
  const progress = await calculateTripProgress(loadId);

  if (!progress) {
    return false;
  }

  return progress.progressPercent >= 80 || progress.enteredDestGeofence;
}

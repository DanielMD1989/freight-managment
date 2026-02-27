/**
 * Return Load Notification System
 *
 * Service Fee Implementation - Task 5
 *
 * Notifies carriers of available return loads when:
 * - Trip progress reaches 80%
 * - Truck enters destination geofence
 *
 * Matches loads based on:
 * - Destination region matching available load origins
 * - GPS-active carriers get priority
 * - Completed trip history for ranking
 */

import { db } from "@/lib/db";
import { createNotification, NotificationType } from "./notifications";

export interface ReturnLoadMatch {
  loadId: string;
  pickupCity: string;
  pickupRegion: string;
  deliveryCity: string;
  deliveryRegion: string;
  weight: number;
  truckType: string;
  distanceKm: number;
  matchScore: number;
  postedAt: Date;
}

export interface ReturnLoadNotificationResult {
  success: boolean;
  carrierUserId: string;
  loadId: string;
  destinationRegion: string;
  matchingLoads: number;
  notificationId?: string;
  error?: string;
}

/**
 * Find matching return loads for a carrier at a destination
 *
 * @param destinationRegion - Region where carrier is arriving
 * @param carrierId - Carrier organization ID
 * @param truckType - Type of truck (for matching)
 * @param limit - Max number of loads to return
 * @returns Array of matching loads
 */
export async function findReturnLoads(
  destinationRegion: string,
  carrierId: string,
  truckType?: string,
  limit: number = 10
): Promise<ReturnLoadMatch[]> {
  // Build where clause for POSTED loads in the destination region
  const loads = await db.load.findMany({
    where: {
      status: "POSTED",
      OR: [
        { pickupCity: destinationRegion },
        { pickupLocation: { region: destinationRegion } },
      ],
      ...(truckType ? { truckType: truckType as never } : {}),
    },
    include: {
      pickupLocation: {
        select: { region: true, name: true },
      },
      deliveryLocation: {
        select: { region: true, name: true },
      },
      corridor: {
        select: { distanceKm: true },
      },
      shipper: {
        select: {
          completionRate: true,
          totalLoadsCompleted: true,
        },
      },
    },
    orderBy: [{ postedAt: "desc" }],
    take: limit * 2, // Get more than needed for scoring/ranking
  });

  // Calculate match scores and transform results
  const matches: ReturnLoadMatch[] = loads.map((load) => {
    let matchScore = 50; // Base score

    // Bonus for reliable shippers
    if (load.shipper?.completionRate) {
      matchScore += Number(load.shipper.completionRate) * 0.2;
    }

    // Bonus for recently posted
    const hoursOld =
      (Date.now() - (load.postedAt?.getTime() || 0)) / (1000 * 60 * 60);
    if (hoursOld < 24) {
      matchScore += 10;
    } else if (hoursOld < 48) {
      matchScore += 5;
    }

    // DISTANCE PRIORITY LOGIC — INTENTIONAL DIFFERENCE DOCUMENTED (2026-02-07)
    //
    // RATIONALE: Return load matching uses PLANNED/CORRIDOR distance for
    // display because we're showing available loads, not calculating fees.
    // These loads haven't been assigned yet, so no GPS actual distance exists.
    //
    // Priority: corridor.distanceKm > estimatedTripKm > tripKm
    //
    // CONTRAST with lib/serviceFeeManagement.ts which uses:
    // actualTripKm > estimatedTripKm > tripKm > corridor.distanceKm
    // (Fee calculation uses actual GPS distance when available for accuracy)
    //
    // Get distance
    let distanceKm = 0;
    if (load.corridor?.distanceKm) {
      distanceKm = Number(load.corridor.distanceKm);
    } else if (load.estimatedTripKm) {
      distanceKm = Number(load.estimatedTripKm);
    } else if (load.tripKm) {
      distanceKm = Number(load.tripKm);
    }

    return {
      loadId: load.id,
      pickupCity: load.pickupLocation?.name || load.pickupCity || "",
      pickupRegion: load.pickupLocation?.region || "",
      deliveryCity: load.deliveryLocation?.name || load.deliveryCity || "",
      deliveryRegion: load.deliveryLocation?.region || "",
      weight: Number(load.weight),
      truckType: load.truckType,
      distanceKm,
      matchScore: Math.round(matchScore),
      postedAt: load.postedAt || new Date(),
    };
  });

  // Sort by match score and return top results
  return matches.sort((a, b) => b.matchScore - a.matchScore).slice(0, limit);
}

/**
 * Notify carrier of available return loads
 *
 * Called when:
 * - Trip progress reaches 80%
 * - Truck enters destination geofence
 *
 * @param loadId - Current load ID (the one being delivered)
 * @returns Notification result
 */
export async function notifyCarrierOfReturnLoads(
  loadId: string
): Promise<ReturnLoadNotificationResult> {
  // Get load with carrier info
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      id: true,
      deliveryCity: true,
      deliveryLocation: {
        select: { region: true },
      },
      assignedTruck: {
        select: {
          id: true,
          truckType: true,
          carrierId: true,
          carrier: {
            select: {
              id: true,
              name: true,
              users: {
                where: {
                  role: { in: ["CARRIER", "DISPATCHER"] },
                },
                select: {
                  id: true,
                },
                take: 1,
              },
            },
          },
        },
      },
      tripProgressPercent: true,
      enteredDestGeofence: true,
    },
  });

  if (!load) {
    return {
      success: false,
      carrierUserId: "",
      loadId,
      destinationRegion: "",
      matchingLoads: 0,
      error: "Load not found",
    };
  }

  if (!load.assignedTruck) {
    return {
      success: false,
      carrierUserId: "",
      loadId,
      destinationRegion: "",
      matchingLoads: 0,
      error: "No truck assigned to load",
    };
  }

  const carrier = load.assignedTruck.carrier;
  if (!carrier || carrier.users.length === 0) {
    return {
      success: false,
      carrierUserId: "",
      loadId,
      destinationRegion: "",
      matchingLoads: 0,
      error: "No carrier user to notify",
    };
  }

  const carrierUserId = carrier.users[0].id;
  const destinationRegion =
    load.deliveryLocation?.region || load.deliveryCity || "";

  if (!destinationRegion) {
    return {
      success: false,
      carrierUserId,
      loadId,
      destinationRegion: "",
      matchingLoads: 0,
      error: "No destination region available",
    };
  }

  // Find matching return loads
  const returnLoads = await findReturnLoads(
    destinationRegion,
    carrier.id,
    load.assignedTruck.truckType,
    5
  );

  if (returnLoads.length === 0) {
    // Still notify but indicate no loads found
    const notification = await createNotification({
      userId: carrierUserId,
      type: NotificationType.RETURN_LOAD_AVAILABLE,
      title: "Return Load Check",
      message: `No return loads currently available from ${destinationRegion}. Check back later or post your truck as available.`,
      metadata: {
        loadId,
        destinationRegion,
        matchingLoads: 0,
        triggerReason: load.enteredDestGeofence ? "geofence" : "progress_80",
      },
    });

    return {
      success: true,
      carrierUserId,
      loadId,
      destinationRegion,
      matchingLoads: 0,
      notificationId: notification?.id,
    };
  }

  // Create notification with matched loads
  const topLoads = returnLoads.slice(0, 3);
  const loadSummary = topLoads
    .map(
      (l) =>
        `${l.pickupCity} → ${l.deliveryCity} (${l.distanceKm.toFixed(0)} km)`
    )
    .join("\n• ");

  const notification = await createNotification({
    userId: carrierUserId,
    type: NotificationType.RETURN_LOAD_MATCHED,
    title: `${returnLoads.length} Return Loads Available`,
    message: `Return loads available from ${destinationRegion}:\n• ${loadSummary}${returnLoads.length > 3 ? `\n...and ${returnLoads.length - 3} more` : ""}`,
    metadata: {
      loadId,
      destinationRegion,
      matchingLoads: returnLoads.length,
      topLoadIds: topLoads.map((l) => l.loadId),
      triggerReason: load.enteredDestGeofence ? "geofence" : "progress_80",
    },
  });

  return {
    success: true,
    carrierUserId,
    loadId,
    destinationRegion,
    matchingLoads: returnLoads.length,
    notificationId: notification?.id,
  };
}

/**
 * Check and notify for return loads based on trip progress update
 *
 * Called after updateTripProgress() when triggers are detected.
 *
 * @param loadId - Load ID
 * @param triggerReason - What triggered the check
 * @returns Notification result
 */
export async function checkAndNotifyReturnLoads(
  loadId: string,
  triggerReason: "progress_80" | "geofence" | "manual"
): Promise<ReturnLoadNotificationResult> {
  // Check if we've already notified for this load
  const existingNotification = await db.notification.findFirst({
    where: {
      type: { in: ["RETURN_LOAD_AVAILABLE", "RETURN_LOAD_MATCHED"] },
      metadata: {
        path: ["loadId"],
        equals: loadId,
      },
    },
  });

  if (existingNotification && triggerReason !== "manual") {
    // Already notified for this load
    return {
      success: true,
      carrierUserId: existingNotification.userId,
      loadId,
      destinationRegion: "",
      matchingLoads: 0,
      notificationId: existingNotification.id,
      error: "Already notified",
    };
  }

  return notifyCarrierOfReturnLoads(loadId);
}

/**
 * Get return load suggestions for a carrier
 *
 * API endpoint helper for carriers to manually search return loads.
 *
 * @param carrierId - Carrier organization ID
 * @param region - Region to search for loads
 * @param truckType - Optional truck type filter
 * @returns Array of matching loads
 */
export async function getReturnLoadSuggestions(
  carrierId: string,
  region: string,
  truckType?: string
): Promise<ReturnLoadMatch[]> {
  return findReturnLoads(region, carrierId, truckType, 20);
}

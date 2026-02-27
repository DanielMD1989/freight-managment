/**
 * Sprint 6: Deadhead Optimization
 *
 * Utilities for calculating and optimizing deadhead miles (empty miles)
 * Helps carriers minimize unprofitable empty driving
 */

import { db } from "@/lib/db";
import { calculateDistanceKm } from "@/lib/geo";
import { LoadStatus, Prisma, TruckType } from "@prisma/client";

// Re-export for backwards compatibility
export { calculateDistanceKm as calculateDistance } from "@/lib/geo";

/**
 * Calculate DH-O (Deadhead to Origin)
 * Distance from truck's current location to load's pickup location
 */
export async function calculateDHO(
  truckId: string,
  loadId: string
): Promise<number | null> {
  // Get truck's current location
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: {
      id: true,
      currentLocationLat: true,
      currentLocationLon: true,
    },
  });

  if (!truck || !truck.currentLocationLat || !truck.currentLocationLon) {
    return null; // No location data
  }

  // Get load pickup location
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      originLat: true,
      originLon: true,
      pickupLocation: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (!load) {
    return null;
  }

  // Use explicit coordinates if available, otherwise use location
  const pickupLat = load.originLat
    ? Number(load.originLat)
    : load.pickupLocation
      ? Number(load.pickupLocation.latitude)
      : null;

  const pickupLon = load.originLon
    ? Number(load.originLon)
    : load.pickupLocation
      ? Number(load.pickupLocation.longitude)
      : null;

  if (!pickupLat || !pickupLon) {
    return null;
  }

  return calculateDistanceKm(
    Number(truck.currentLocationLat),
    Number(truck.currentLocationLon),
    pickupLat,
    pickupLon
  );
}

/**
 * Calculate DH-D (Deadhead from Destination)
 * Distance from load's delivery location to truck's next desired location
 */
export async function calculateDHD(
  loadId: string,
  nextLoadId?: string,
  targetLat?: number,
  targetLon?: number
): Promise<number | null> {
  // Get current load delivery location
  const load = await db.load.findUnique({
    where: { id: loadId },
    select: {
      destinationLat: true,
      destinationLon: true,
      deliveryLocation: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (!load) {
    return null;
  }

  const deliveryLat = load.destinationLat
    ? Number(load.destinationLat)
    : load.deliveryLocation
      ? Number(load.deliveryLocation.latitude)
      : null;

  const deliveryLon = load.destinationLon
    ? Number(load.destinationLon)
    : load.deliveryLocation
      ? Number(load.deliveryLocation.longitude)
      : null;

  if (!deliveryLat || !deliveryLon) {
    return null;
  }

  // If next load specified, calculate DH-D to next load's pickup
  if (nextLoadId) {
    const nextLoad = await db.load.findUnique({
      where: { id: nextLoadId },
      select: {
        originLat: true,
        originLon: true,
        pickupLocation: {
          select: {
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!nextLoad) {
      return null;
    }

    const nextPickupLat = nextLoad.originLat
      ? Number(nextLoad.originLat)
      : nextLoad.pickupLocation
        ? Number(nextLoad.pickupLocation.latitude)
        : null;

    const nextPickupLon = nextLoad.originLon
      ? Number(nextLoad.originLon)
      : nextLoad.pickupLocation
        ? Number(nextLoad.pickupLocation.longitude)
        : null;

    if (!nextPickupLat || !nextPickupLon) {
      return null;
    }

    return calculateDistanceKm(
      deliveryLat,
      deliveryLon,
      nextPickupLat,
      nextPickupLon
    );
  }

  // If target coordinates specified, calculate DH-D to target
  if (targetLat !== undefined && targetLon !== undefined) {
    return calculateDistanceKm(deliveryLat, deliveryLon, targetLat, targetLon);
  }

  return null;
}

/**
 * Get truck's current location from GPS or last known position
 */
export async function getTruckCurrentLocation(truckId: string): Promise<{
  latitude: number;
  longitude: number;
  source: "gps" | "database" | "none";
  timestamp?: Date;
} | null> {
  const truck = await db.truck.findUnique({
    where: { id: truckId },
    select: {
      id: true,
      currentLocationLat: true,
      currentLocationLon: true,
    },
  });

  if (!truck) {
    return null;
  }

  // Try to get latest GPS position
  const latestGPS = await db.gpsPosition.findFirst({
    where: { truckId },
    orderBy: { timestamp: "desc" },
    select: {
      latitude: true,
      longitude: true,
      timestamp: true,
    },
  });

  // Use GPS if recent (within last 24 hours)
  if (latestGPS) {
    const age = Date.now() - new Date(latestGPS.timestamp).getTime();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours

    if (age < maxAge) {
      return {
        latitude: Number(latestGPS.latitude),
        longitude: Number(latestGPS.longitude),
        source: "gps",
        timestamp: latestGPS.timestamp,
      };
    }
  }

  // Fall back to database location
  if (truck.currentLocationLat && truck.currentLocationLon) {
    return {
      latitude: Number(truck.currentLocationLat),
      longitude: Number(truck.currentLocationLon),
      source: "database",
    };
  }

  return null;
}

/**
 * Find loads with minimal deadhead from truck's current location
 * Returns loads sorted by DH-O (closest first)
 */
export async function findLoadsWithMinimalDHO(
  truckId: string,
  maxDHO: number = 200, // Max deadhead in km
  filters?: {
    truckType?: string;
    minTripKm?: number;
    maxTripKm?: number;
    pickupAfter?: Date;
    pickupBefore?: Date;
  }
): Promise<
  Array<{
    loadId: string;
    dho: number;
    pickupCity: string;
    deliveryCity: string;
    tripKm: number | null;
  }>
> {
  // Get truck location
  const location = await getTruckCurrentLocation(truckId);
  if (!location) {
    return [];
  }

  // Build where clause
  const where: Prisma.LoadWhereInput = {
    status: LoadStatus.POSTED,
  };

  if (filters?.truckType) {
    where.truckType = filters.truckType as TruckType;
  }

  if (filters?.minTripKm || filters?.maxTripKm) {
    where.tripKm = {};
    if (filters.minTripKm) {
      where.tripKm.gte = filters.minTripKm;
    }
    if (filters.maxTripKm) {
      where.tripKm.lte = filters.maxTripKm;
    }
  }

  if (filters?.pickupAfter || filters?.pickupBefore) {
    where.pickupDate = {};
    if (filters.pickupAfter) {
      where.pickupDate.gte = filters.pickupAfter;
    }
    if (filters.pickupBefore) {
      where.pickupDate.lte = filters.pickupBefore;
    }
  }

  // Get available loads
  const loads = await db.load.findMany({
    where,
    select: {
      id: true,
      pickupCity: true,
      deliveryCity: true,
      tripKm: true,
      originLat: true,
      originLon: true,
    },
    take: 100, // Limit for performance
  });

  // Calculate DH-O for each load and filter
  const loadsWithDHO = loads
    .map((load) => {
      const pickupLat = load.originLat ? Number(load.originLat) : null;
      const pickupLon = load.originLon ? Number(load.originLon) : null;

      if (!pickupLat || !pickupLon) {
        return null;
      }

      const dho = calculateDistanceKm(
        location.latitude,
        location.longitude,
        pickupLat,
        pickupLon
      );

      return {
        loadId: load.id,
        dho,
        pickupCity: load.pickupCity || "",
        deliveryCity: load.deliveryCity || "",
        tripKm: load.tripKm ? Number(load.tripKm) : null,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.dho <= maxDHO)
    .sort((a, b) => a.dho - b.dho); // Sort by DH-O ascending

  return loadsWithDHO;
}

/**
 * Find next loads with minimal DH-D from current load's delivery location
 * Helps carriers plan load chains to minimize empty miles
 */
export async function findNextLoadsWithMinimalDHD(
  currentLoadId: string,
  maxDHD: number = 200, // Max deadhead in km
  filters?: {
    truckType?: string;
    minTripKm?: number;
    maxTripKm?: number;
    pickupAfter?: Date;
  }
): Promise<
  Array<{
    loadId: string;
    dhd: number;
    pickupCity: string;
    deliveryCity: string;
    tripKm: number | null;
    pickupDate: Date;
  }>
> {
  // Get current load delivery location
  const currentLoad = await db.load.findUnique({
    where: { id: currentLoadId },
    select: {
      deliveryDate: true,
      destinationLat: true,
      destinationLon: true,
      deliveryLocation: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
      truckType: true,
    },
  });

  if (!currentLoad) {
    return [];
  }

  const deliveryLat = currentLoad.destinationLat
    ? Number(currentLoad.destinationLat)
    : currentLoad.deliveryLocation
      ? Number(currentLoad.deliveryLocation.latitude)
      : null;

  const deliveryLon = currentLoad.destinationLon
    ? Number(currentLoad.destinationLon)
    : currentLoad.deliveryLocation
      ? Number(currentLoad.deliveryLocation.longitude)
      : null;

  if (!deliveryLat || !deliveryLon) {
    return [];
  }

  // Build where clause for next loads
  const where: Prisma.LoadWhereInput = {
    status: LoadStatus.POSTED,
    id: { not: currentLoadId }, // Exclude current load
    pickupDate: {
      gte: currentLoad.deliveryDate ?? undefined, // Pickup after current delivery
    },
  };

  // Match truck type if specified in filters, otherwise use current load's truck type
  if (filters?.truckType) {
    where.truckType = filters.truckType as TruckType;
  } else if (currentLoad.truckType) {
    where.truckType = currentLoad.truckType;
  }

  if (filters?.minTripKm || filters?.maxTripKm) {
    where.tripKm = {};
    if (filters.minTripKm) {
      where.tripKm.gte = filters.minTripKm;
    }
    if (filters.maxTripKm) {
      where.tripKm.lte = filters.maxTripKm;
    }
  }

  if (
    filters?.pickupAfter &&
    where.pickupDate &&
    typeof where.pickupDate === "object" &&
    "gte" in where.pickupDate
  ) {
    (where.pickupDate as Prisma.DateTimeFilter).gte = filters.pickupAfter;
  }

  // Get available next loads
  const loads = await db.load.findMany({
    where,
    select: {
      id: true,
      pickupCity: true,
      deliveryCity: true,
      tripKm: true,
      pickupDate: true,
      originLat: true,
      originLon: true,
      pickupLocation: {
        select: {
          latitude: true,
          longitude: true,
        },
      },
    },
    take: 100,
  });

  // Calculate DH-D for each load and filter
  const loadsWithDHD = loads
    .map((load) => {
      const pickupLat = load.originLat
        ? Number(load.originLat)
        : load.pickupLocation
          ? Number(load.pickupLocation.latitude)
          : null;

      const pickupLon = load.originLon
        ? Number(load.originLon)
        : load.pickupLocation
          ? Number(load.pickupLocation.longitude)
          : null;

      if (!pickupLat || !pickupLon) {
        return null;
      }

      const dhd = calculateDistanceKm(
        deliveryLat,
        deliveryLon,
        pickupLat,
        pickupLon
      );

      return {
        loadId: load.id,
        dhd,
        pickupCity: load.pickupCity || "",
        deliveryCity: load.deliveryCity || "",
        tripKm: load.tripKm ? Number(load.tripKm) : null,
        pickupDate: load.pickupDate,
      };
    })
    .filter((item): item is NonNullable<typeof item> => item !== null)
    .filter((item) => item.dhd <= maxDHD)
    .sort((a, b) => a.dhd - b.dhd); // Sort by DH-D ascending

  return loadsWithDHD;
}

/**
 * Calculate deadhead efficiency metrics for a load
 * Returns DH-O%, DH-D%, and total empty miles ratio
 */
export function calculateDeadheadMetrics(
  dho: number,
  dhd: number,
  tripKm: number
): {
  dhoPercent: number; // DH-O as % of trip distance
  dhdPercent: number; // DH-D as % of trip distance
  totalDeadheadPercent: number; // (DH-O + DH-D) as % of trip
  efficiency: "excellent" | "good" | "acceptable" | "poor";
} {
  const dhoPercent = (dho / tripKm) * 100;
  const dhdPercent = (dhd / tripKm) * 100;
  const totalDeadheadPercent = ((dho + dhd) / tripKm) * 100;

  let efficiency: "excellent" | "good" | "acceptable" | "poor";
  if (totalDeadheadPercent < 10) {
    efficiency = "excellent";
  } else if (totalDeadheadPercent < 25) {
    efficiency = "good";
  } else if (totalDeadheadPercent < 50) {
    efficiency = "acceptable";
  } else {
    efficiency = "poor";
  }

  return {
    dhoPercent: Math.round(dhoPercent * 10) / 10,
    dhdPercent: Math.round(dhdPercent * 10) / 10,
    totalDeadheadPercent: Math.round(totalDeadheadPercent * 10) / 10,
    efficiency,
  };
}

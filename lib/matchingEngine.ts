/**
 * Matching Engine - Truck/Load Bidirectional Matching
 *
 * Automatically matches available trucks with posted loads based on:
 * - Route compatibility (40%)
 * - Time window overlap (30%)
 * - Capacity match (20%)
 * - Deadhead distance (10%)
 *
 * Sprint 8 - Story 8.4: Truck/Load Matching Algorithm
 */

import { db } from '@/lib/db';
import { Load, TruckPosting, Truck, EthiopianLocation } from '@prisma/client';

interface MatchScore {
  score: number; // 0-100
  breakdown: {
    routeScore: number; // 0-40
    timeScore: number; // 0-30
    capacityScore: number; // 0-20
    deadheadScore: number; // 0-10
  };
  details: {
    routeMatch: 'exact' | 'destination_flexible' | 'nearby';
    timeOverlap: boolean;
    capacityFit: boolean;
    deadheadKm?: number;
    totalKm?: number;
  };
}

interface TruckMatch {
  posting: TruckPosting & {
    truck: Truck;
    originCity: EthiopianLocation;
    destinationCity: EthiopianLocation | null;
  };
  matchScore: MatchScore;
}

interface LoadMatch {
  load: Load & {
    pickupLocation: EthiopianLocation;
    deliveryLocation: EthiopianLocation;
    shipper: {
      id: string;
      name: string;
      isVerified: boolean;
    } | null;
  };
  matchScore: MatchScore;
}

/**
 * Calculate distance between two coordinates using Haversine formula
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
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
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calculate route compatibility score (0-40 points)
 *
 * Exact match: 40 points
 * Destination flexible (truck has no dest): 35 points
 * Nearby (within 100km): 20 points
 * Far (100-200km): 10 points
 * Too far (>200km): 0 points
 */
function calculateRouteScore(
  truckOrigin: EthiopianLocation,
  truckDest: EthiopianLocation | null,
  loadPickup: EthiopianLocation,
  loadDelivery: EthiopianLocation
): { score: number; match: 'exact' | 'destination_flexible' | 'nearby' } {
  // Check origin match (truck's current location should be near load's pickup)
  const originDistance = calculateDistance(
    Number(truckOrigin.latitude),
    Number(truckOrigin.longitude),
    Number(loadPickup.latitude),
    Number(loadPickup.longitude)
  );

  // If truck is too far from pickup, score 0
  if (originDistance > 200) {
    return { score: 0, match: 'nearby' };
  }

  // If truck has no destination preference (flexible routing)
  if (!truckDest) {
    // Origin nearby (within 50km): 35 points
    if (originDistance <= 50) {
      return { score: 35, match: 'destination_flexible' };
    }
    // Origin somewhat far (50-200km): scaled score
    return {
      score: Math.max(0, 35 - (originDistance - 50) / 5),
      match: 'destination_flexible',
    };
  }

  // Check destination match
  const destDistance = calculateDistance(
    Number(truckDest.latitude),
    Number(truckDest.longitude),
    Number(loadDelivery.latitude),
    Number(loadDelivery.longitude)
  );

  // Exact match (same origin and destination cities)
  if (truckOrigin.id === loadPickup.id && truckDest.id === loadDelivery.id) {
    return { score: 40, match: 'exact' };
  }

  // Near match (both origin and dest within 50km)
  if (originDistance <= 50 && destDistance <= 50) {
    return { score: 38, match: 'nearby' };
  }

  // Good match (origin close, dest reasonable)
  if (originDistance <= 100 && destDistance <= 100) {
    return { score: 25, match: 'nearby' };
  }

  // Acceptable match (both within 200km)
  if (originDistance <= 200 && destDistance <= 200) {
    return { score: 15, match: 'nearby' };
  }

  return { score: 0, match: 'nearby' };
}

/**
 * Calculate time window overlap score (0-30 points)
 *
 * Perfect overlap: 30 points
 * Partial overlap: 15-25 points
 * No overlap: 0 points
 */
function calculateTimeScore(
  truckAvailableFrom: Date,
  truckAvailableTo: Date | null,
  loadPickupDate: Date,
  loadDeliveryDate: Date
): { score: number; overlap: boolean } {
  const truckStart = truckAvailableFrom.getTime();
  const truckEnd = truckAvailableTo ? truckAvailableTo.getTime() : Infinity;
  const loadStart = loadPickupDate.getTime();
  const loadEnd = loadDeliveryDate.getTime();

  // Check if there's any overlap
  const hasOverlap = truckStart <= loadEnd && loadStart <= truckEnd;

  if (!hasOverlap) {
    return { score: 0, overlap: false };
  }

  // Calculate overlap amount
  const overlapStart = Math.max(truckStart, loadStart);
  const overlapEnd = Math.min(truckEnd, loadEnd);
  const overlapDuration = overlapEnd - overlapStart;

  // If truck is available for the entire load duration
  const loadDuration = loadEnd - loadStart;
  if (truckStart <= loadStart && (truckEnd === Infinity || truckEnd >= loadEnd)) {
    return { score: 30, overlap: true };
  }

  // Partial overlap: score based on percentage
  const overlapPercentage = overlapDuration / loadDuration;
  const score = Math.min(30, Math.round(overlapPercentage * 30));

  return { score, overlap: true };
}

/**
 * Calculate capacity match score (0-20 points)
 *
 * Perfect fit: 20 points
 * Sufficient capacity: 15 points
 * Insufficient capacity: 0 points
 */
function calculateCapacityScore(
  truck: Truck,
  truckPosting: TruckPosting,
  load: Load
): { score: number; fit: boolean } {
  const truckWeight = Number(truck.capacity);
  const loadWeight = Number(load.weight);

  // Check weight
  if (loadWeight > truckWeight) {
    return { score: 0, fit: false };
  }

  // Check length if both specified
  if (truckPosting.availableLength && load.lengthM) {
    const truckLength = Number(truckPosting.availableLength);
    const loadLength = Number(load.lengthM);

    if (loadLength > truckLength) {
      return { score: 0, fit: false };
    }
  }

  // Check truck type match
  if (truck.truckType !== load.truckType) {
    return { score: 5, fit: true }; // Different type but capacity fits
  }

  // Check full/partial load type match
  if (truckPosting.fullPartial !== load.fullPartial) {
    return { score: 10, fit: true }; // Type mismatch but capacity OK
  }

  // Perfect match: type, capacity, and load type all match
  const utilizationRate = loadWeight / truckWeight;

  // Perfect utilization (80-100%): 20 points
  if (utilizationRate >= 0.8) {
    return { score: 20, fit: true };
  }

  // Good utilization (50-80%): 15 points
  if (utilizationRate >= 0.5) {
    return { score: 15, fit: true };
  }

  // Low utilization (below 50%): 10 points
  return { score: 10, fit: true };
}

/**
 * Calculate deadhead distance score (0-10 points)
 *
 * Low deadhead (<50km): 10 points
 * Medium deadhead (50-100km): 5 points
 * High deadhead (>100km): 0 points
 */
function calculateDeadheadScore(
  truckOrigin: EthiopianLocation,
  loadPickup: EthiopianLocation,
  loadDelivery: EthiopianLocation,
  truckDest: EthiopianLocation | null,
  preferredDhToOrigin?: number | null,
  preferredDhAfterDelivery?: number | null
): { score: number; deadheadKm: number } {
  // Calculate deadhead to pickup
  const dhToPickup = calculateDistance(
    Number(truckOrigin.latitude),
    Number(truckOrigin.longitude),
    Number(loadPickup.latitude),
    Number(loadPickup.longitude)
  );

  // Calculate deadhead after delivery (if truck has destination preference)
  let dhAfterDelivery = 0;
  if (truckDest) {
    dhAfterDelivery = calculateDistance(
      Number(loadDelivery.latitude),
      Number(loadDelivery.longitude),
      Number(truckDest.latitude),
      Number(truckDest.longitude)
    );
  }

  const totalDeadhead = dhToPickup + dhAfterDelivery;

  // Check against truck's deadhead preferences
  if (preferredDhToOrigin && dhToPickup > preferredDhToOrigin) {
    return { score: 0, deadheadKm: totalDeadhead };
  }

  if (preferredDhAfterDelivery && dhAfterDelivery > preferredDhAfterDelivery) {
    return { score: 0, deadheadKm: totalDeadhead };
  }

  // Score based on total deadhead
  if (totalDeadhead < 50) {
    return { score: 10, deadheadKm: totalDeadhead };
  }

  if (totalDeadhead < 100) {
    return { score: 5, deadheadKm: totalDeadhead };
  }

  return { score: 0, deadheadKm: totalDeadhead };
}

/**
 * Calculate overall match score for a truck-load pair
 */
function calculateMatchScore(
  truckPosting: TruckPosting & {
    truck: Truck;
    originCity: EthiopianLocation;
    destinationCity: EthiopianLocation | null;
  },
  load: Load & {
    pickupLocation: EthiopianLocation;
    deliveryLocation: EthiopianLocation;
  }
): MatchScore {
  const routeResult = calculateRouteScore(
    truckPosting.originCity,
    truckPosting.destinationCity,
    load.pickupLocation,
    load.deliveryLocation
  );

  const timeResult = calculateTimeScore(
    truckPosting.availableFrom,
    truckPosting.availableTo,
    load.pickupDate,
    load.deliveryDate
  );

  const capacityResult = calculateCapacityScore(
    truckPosting.truck,
    truckPosting,
    load
  );

  const deadheadResult = calculateDeadheadScore(
    truckPosting.originCity,
    load.pickupLocation,
    load.deliveryLocation,
    truckPosting.destinationCity,
    truckPosting.preferredDhToOriginKm
      ? Number(truckPosting.preferredDhToOriginKm)
      : null,
    truckPosting.preferredDhAfterDeliveryKm
      ? Number(truckPosting.preferredDhAfterDeliveryKm)
      : null
  );

  const totalScore =
    routeResult.score +
    timeResult.score +
    capacityResult.score +
    deadheadResult.score;

  return {
    score: Math.round(totalScore),
    breakdown: {
      routeScore: routeResult.score,
      timeScore: timeResult.score,
      capacityScore: capacityResult.score,
      deadheadScore: deadheadResult.score,
    },
    details: {
      routeMatch: routeResult.match,
      timeOverlap: timeResult.overlap,
      capacityFit: capacityResult.fit,
      deadheadKm: deadheadResult.deadheadKm,
    },
  };
}

/**
 * Find matching loads for a truck posting
 *
 * @param truckPostingId - Truck posting ID
 * @param minScore - Minimum match score (default: 40)
 * @param limit - Max results (default: 20)
 * @returns Array of matching loads with scores
 */
export async function findMatchingLoadsForTruck(
  truckPostingId: string,
  minScore: number = 40,
  limit: number = 20
): Promise<LoadMatch[]> {
  // Fetch truck posting with relations
  const truckPosting = await db.truckPosting.findUnique({
    where: { id: truckPostingId },
    include: {
      truck: true,
      originCity: true,
      destinationCity: true,
    },
  });

  if (!truckPosting) {
    throw new Error('Truck posting not found');
  }

  // Fetch all POSTED loads with location details
  const loads = await db.load.findMany({
    where: {
      status: 'POSTED',
      pickupCityId: { not: null },
      deliveryCityId: { not: null },
    },
    include: {
      pickupLocation: true,
      deliveryLocation: true,
      shipper: {
        select: {
          id: true,
          name: true,
          isVerified: true,
        },
      },
    },
  });

  // Calculate match scores for all loads
  const matches: LoadMatch[] = loads
    .filter((load) => load.pickupLocation && load.deliveryLocation)
    .map((load) => ({
      load: load as any,
      matchScore: calculateMatchScore(truckPosting, load as any),
    }))
    .filter((match) => match.matchScore.score >= minScore)
    .sort((a, b) => b.matchScore.score - a.matchScore.score)
    .slice(0, limit);

  return matches;
}

/**
 * Find matching trucks for a load
 *
 * @param loadId - Load ID
 * @param minScore - Minimum match score (default: 40)
 * @param limit - Max results (default: 20)
 * @returns Array of matching trucks with scores
 */
export async function findMatchingTrucksForLoad(
  loadId: string,
  minScore: number = 40,
  limit: number = 20
): Promise<TruckMatch[]> {
  // Fetch load with location details
  const load = await db.load.findUnique({
    where: { id: loadId },
    include: {
      pickupLocation: true,
      deliveryLocation: true,
    },
  });

  if (!load || !load.pickupLocation || !load.deliveryLocation) {
    throw new Error('Load not found or missing location details');
  }

  // Fetch all ACTIVE truck postings
  const truckPostings = await db.truckPosting.findMany({
    where: {
      status: 'ACTIVE',
    },
    include: {
      truck: true,
      originCity: true,
      destinationCity: true,
    },
  });

  // Calculate match scores for all trucks
  const matches: TruckMatch[] = truckPostings
    .map((posting) => ({
      posting,
      matchScore: calculateMatchScore(posting, load as any),
    }))
    .filter((match) => match.matchScore.score >= minScore)
    .sort((a, b) => b.matchScore.score - a.matchScore.score)
    .slice(0, limit);

  return matches;
}

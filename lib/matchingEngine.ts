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
import { calculateDistanceKm } from '@/lib/geo';

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
  const originDistance = calculateDistanceKm(
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
  const destDistance = calculateDistanceKm(
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
  const dhToPickup = calculateDistanceKm(
    Number(truckOrigin.latitude),
    Number(truckOrigin.longitude),
    Number(loadPickup.latitude),
    Number(loadPickup.longitude)
  );

  // Calculate deadhead after delivery (if truck has destination preference)
  let dhAfterDelivery = 0;
  if (truckDest) {
    dhAfterDelivery = calculateDistanceKm(
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

/**
 * Enhance match results with accurate road distances
 *
 * Replaces Haversine (straight-line) deadhead distances with
 * actual road distances from Google Routes API.
 *
 * @param matches - Array of truck matches (or load matches)
 * @param load - The load being matched
 * @returns Enhanced matches with road distances
 */
export async function enhanceMatchesWithRoadDistances<T extends TruckMatch | LoadMatch>(
  matches: T[],
  load: {
    pickupLocation: { latitude: number | any; longitude: number | any };
    deliveryLocation: { latitude: number | any; longitude: number | any };
  }
): Promise<T[]> {
  // Dynamically import to avoid circular dependencies
  const { calculateRoadDistance } = await import('@/lib/googleRoutes');

  const enhanced = await Promise.all(
    matches.map(async (match) => {
      try {
        // Get truck/posting origin location
        let originLat: number;
        let originLng: number;

        if ('posting' in match) {
          // TruckMatch
          originLat = Number(match.posting.originCity.latitude);
          originLng = Number(match.posting.originCity.longitude);
        } else {
          // LoadMatch - use load pickup as origin for now
          originLat = Number(load.pickupLocation.latitude);
          originLng = Number(load.pickupLocation.longitude);
        }

        // Calculate road distance from truck to pickup (DH-O)
        const dhOrigin = await calculateRoadDistance(
          { lat: originLat, lng: originLng },
          {
            lat: Number(load.pickupLocation.latitude),
            lng: Number(load.pickupLocation.longitude),
          }
        );

        // Update match with road distance
        const updatedMatch = { ...match };
        updatedMatch.matchScore = {
          ...match.matchScore,
          details: {
            ...match.matchScore.details,
            deadheadKm: dhOrigin.distanceKm,
            roadDistanceSource: dhOrigin.source,
          } as any,
        };

        return updatedMatch;
      } catch (error) {
        console.error('Error calculating road distance:', error);
        return match; // Return original if calculation fails
      }
    })
  );

  return enhanced;
}

// ============================================================================
// In-Memory Matching Functions (Compatible with matchCalculation.ts interface)
// ============================================================================

/**
 * Criteria interface for in-memory load matching
 */
interface LoadMatchCriteria {
  id?: string;
  pickupCity: string;
  deliveryCity: string;
  pickupDate?: Date | string | null;
  truckType: string;
  weight?: number | null;
  lengthM?: number | null;
  fullPartial?: string | null;
  [key: string]: any; // Allow additional fields to pass through
}

/**
 * Criteria interface for in-memory truck matching
 */
interface TruckMatchCriteria {
  id?: string;
  currentCity: string;
  destinationCity?: string | null;
  availableDate?: Date | string | null;
  truckType: string;
  maxWeight?: number | null;
  lengthM?: number | null;
  fullPartial?: string | null;
  [key: string]: any; // Allow additional fields to pass through
}

/**
 * Simple match result for in-memory matching
 */
interface SimpleMatchResult {
  score: number; // 0-100
  matchReasons: string[];
  isExactMatch: boolean;
}

/**
 * Calculate distance match score using city name comparison
 * Used when GPS coordinates are not available
 */
function calculateCityDistanceScore(city1: string, city2: string): number {
  if (!city1 || !city2) return 0;

  const c1 = city1.toLowerCase().trim();
  const c2 = city2.toLowerCase().trim();

  // Exact match
  if (c1 === c2) return 100;

  // Partial match (same region/area)
  if (c1.includes(c2) || c2.includes(c1)) return 70;

  // Handle spelling variations (e.g., Mekelle/Mekele)
  const simplify = (s: string) => s.replace(/(.)\1+/g, '$1');
  if (simplify(c1) === simplify(c2)) return 90;

  return 0;
}

/**
 * Calculate date match score
 */
function calculateSimpleDateScore(
  loadDate: Date | string | null | undefined,
  truckDate: Date | string | null | undefined
): number {
  if (!loadDate || !truckDate) return 50; // Neutral if not specified

  const load = new Date(loadDate);
  const truck = new Date(truckDate);

  // Same day
  if (load.toDateString() === truck.toDateString()) return 100;

  const diffDays = Math.abs(load.getTime() - truck.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) return 90;
  if (diffDays <= 3) return 70;
  if (diffDays <= 7) return 50;

  return 20;
}

/**
 * Calculate truck type match score
 */
function calculateTruckTypeScore(loadType: string, truckType: string): number {
  const loadNorm = loadType?.toUpperCase() || '';
  const truckNorm = truckType?.toUpperCase() || '';

  if (loadNorm === truckNorm) return 100;

  // Compatible types
  const compatiblePairs: Record<string, string[]> = {
    'DRY_VAN': ['VAN', 'FLATBED', 'CONTAINER'],
    'VAN': ['DRY_VAN', 'CONTAINER'],
    'FLATBED': ['DRY_VAN', 'CONTAINER'],
    'REFRIGERATED': ['REEFER'],
    'REEFER': ['REFRIGERATED'],
  };

  const compatible = compatiblePairs[loadNorm] || [];
  if (compatible.includes(truckNorm)) return 70;

  return 0;
}

/**
 * Calculate weight capacity score
 */
function calculateSimpleWeightScore(
  loadWeight: number | null | undefined,
  truckMaxWeight: number | null | undefined
): number {
  if (!loadWeight || !truckMaxWeight) return 50;

  if (truckMaxWeight >= loadWeight) {
    const utilization = (loadWeight / truckMaxWeight) * 100;
    if (utilization >= 90) return 100;
    if (utilization >= 70) return 90;
    if (utilization >= 50) return 70;
    return 50;
  }

  return 0; // Truck cannot handle the load
}

/**
 * Calculate length match score
 */
function calculateSimpleLengthScore(
  loadLength: number | null | undefined,
  truckLength: number | null | undefined
): number {
  if (!loadLength || !truckLength) return 50;
  return truckLength >= loadLength ? 100 : 0;
}

/**
 * Calculate full/partial match score
 */
function calculateFullPartialScore(
  loadType: string | null | undefined,
  truckType: string | null | undefined
): number {
  if (!loadType || !truckType) return 50;

  const loadNorm = loadType.toUpperCase();
  const truckNorm = truckType.toUpperCase();

  if (loadNorm === truckNorm) return 100;
  if (truckNorm === 'FULL' && loadNorm === 'PARTIAL') return 70;
  if (truckNorm === 'PARTIAL' && loadNorm === 'FULL') return 30;

  return 50;
}

/**
 * Calculate match score between a load and a truck (in-memory version)
 * Uses weighted scoring: Route 40%, Time 30%, Capacity 20%, Type 10%
 */
function calculateSimpleMatchScore(
  load: LoadMatchCriteria,
  truck: TruckMatchCriteria
): SimpleMatchResult {
  const reasons: string[] = [];

  // Route score (40% weight) - using city name comparison
  const originScore = calculateCityDistanceScore(load.pickupCity, truck.currentCity);
  const destScore = truck.destinationCity
    ? calculateCityDistanceScore(load.deliveryCity, truck.destinationCity)
    : 70; // Flexible destination gets 70%
  const routeScore = (originScore * 0.6 + destScore * 0.4); // Origin more important

  if (originScore === 100) reasons.push('Exact origin match');
  else if (originScore >= 70) reasons.push('Nearby origin');

  if (destScore === 100) reasons.push('Exact destination match');
  else if (destScore >= 70 && truck.destinationCity) reasons.push('Nearby destination');

  // Time score (30% weight)
  const timeScore = calculateSimpleDateScore(load.pickupDate, truck.availableDate);
  if (timeScore >= 90) reasons.push('Perfect timing');
  else if (timeScore >= 70) reasons.push('Good timing');

  // Capacity score (20% weight)
  const weightScore = calculateSimpleWeightScore(load.weight, truck.maxWeight);
  const lengthScore = calculateSimpleLengthScore(load.lengthM, truck.lengthM);
  const fpScore = calculateFullPartialScore(load.fullPartial, truck.fullPartial);
  const capacityScore = (weightScore * 0.5 + lengthScore * 0.25 + fpScore * 0.25);

  if (weightScore === 100) reasons.push('Optimal weight utilization');
  else if (weightScore === 0) reasons.push('Insufficient weight capacity');
  if (lengthScore === 0 && load.lengthM && truck.lengthM) reasons.push('Insufficient length');

  // Type score (10% weight)
  const typeScore = calculateTruckTypeScore(load.truckType, truck.truckType);
  if (typeScore === 100) reasons.push('Perfect truck type match');
  else if (typeScore === 0) reasons.push('Incompatible truck type');

  // Calculate final weighted score (matching matchingEngine weights: Route 40%, Time 30%, Capacity 20%, Type 10%)
  const finalScore = Math.round(
    routeScore * 0.40 +
    timeScore * 0.30 +
    capacityScore * 0.20 +
    typeScore * 0.10
  );

  const isExactMatch = finalScore >= 85 && typeScore === 100 && originScore >= 70;

  if (isExactMatch) {
    reasons.unshift('Exact Match');
  }

  return {
    score: finalScore,
    matchReasons: reasons,
    isExactMatch,
  };
}

/**
 * Find matching loads for a truck (in-memory version)
 * Compatible with matchCalculation.ts interface
 *
 * @param truck - Truck criteria
 * @param loads - Array of load criteria
 * @param minScore - Minimum match score (default: 50)
 * @returns Array of loads with match scores
 */
export function findMatchingLoads<T extends LoadMatchCriteria>(
  truck: TruckMatchCriteria,
  loads: T[],
  minScore: number = 50
): Array<T & { matchScore: number; matchReasons: string[]; isExactMatch: boolean }> {
  return loads
    .map(load => {
      const match = calculateSimpleMatchScore(load, truck);
      return {
        ...load,
        matchScore: match.score,
        matchReasons: match.matchReasons,
        isExactMatch: match.isExactMatch,
      };
    })
    .filter(load => load.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Find matching trucks for a load (in-memory version)
 * Compatible with matchCalculation.ts interface
 *
 * @param load - Load criteria
 * @param trucks - Array of truck criteria
 * @param minScore - Minimum match score (default: 50)
 * @returns Array of trucks with match scores
 */
export function findMatchingTrucks<T extends TruckMatchCriteria>(
  load: LoadMatchCriteria,
  trucks: T[],
  minScore: number = 50
): Array<T & { matchScore: number; matchReasons: string[]; isExactMatch: boolean }> {
  return trucks
    .map(truck => {
      const match = calculateSimpleMatchScore(load, truck);
      return {
        ...truck,
        matchScore: match.score,
        matchReasons: match.matchReasons,
        isExactMatch: match.isExactMatch,
      };
    })
    .filter(truck => truck.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore);
}

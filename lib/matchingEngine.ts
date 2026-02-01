/**
 * Matching Engine - Truck/Load Bidirectional Matching
 *
 * Automatically matches available trucks with posted loads based on:
 * - Route compatibility (35%)
 * - Truck type match (25%)
 * - Capacity match (20%)
 * - Time window overlap (20%)
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
// In-Memory Matching Functions with Real-World Ethiopian Freight Logic
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
 * Match result with DH-O distance
 */
interface MatchResult {
  score: number; // 0-100
  matchReasons: string[];
  isExactMatch: boolean;
  dhOriginKm: number; // Deadhead to origin in km
  excluded: boolean; // True if filtered out
  excludeReason?: string;
}

// ============================================================================
// ETHIOPIAN CITY DISTANCE LOOKUP TABLE
// Used when GPS coordinates are not available
// Distances in kilometers (approximate road distances)
// ============================================================================
const ETHIOPIAN_CITY_DISTANCES: Record<string, Record<string, number>> = {
  'addis ababa': {
    'addis ababa': 0,
    'dire dawa': 450,
    'djibouti': 910,
    'mekelle': 780,
    'mekele': 780,
    'hawassa': 275,
    'bahir dar': 565,
    'gondar': 740,
    'jimma': 350,
    'adama': 100,
    'nazret': 100,
  },
  'dire dawa': {
    'dire dawa': 0,
    'addis ababa': 450,
    'djibouti': 310,
    'mekelle': 850,
    'mekele': 850,
    'hawassa': 725,
    'harar': 55,
  },
  'djibouti': {
    'djibouti': 0,
    'addis ababa': 910,
    'dire dawa': 310,
    'mekelle': 1100,
    'mekele': 1100,
  },
  'mekelle': {
    'mekelle': 0,
    'mekele': 0,
    'addis ababa': 780,
    'dire dawa': 850,
    'djibouti': 1100,
    'gondar': 440,
    'bahir dar': 570,
  },
  'mekele': {
    'mekele': 0,
    'mekelle': 0,
    'addis ababa': 780,
    'dire dawa': 850,
    'djibouti': 1100,
  },
  'hawassa': {
    'hawassa': 0,
    'addis ababa': 275,
    'dire dawa': 725,
    'djibouti': 1000,
  },
};

/**
 * Get distance between two Ethiopian cities in km
 * Returns null if distance is unknown
 */
function getEthiopianCityDistance(city1: string, city2: string): number | null {
  const c1 = city1.toLowerCase().trim();
  const c2 = city2.toLowerCase().trim();

  // Same city
  if (c1 === c2) return 0;

  // Handle spelling variations
  const normalize = (s: string) => s.replace(/e+l+e?$/i, 'elle'); // Mekele -> Mekelle
  const n1 = normalize(c1);
  const n2 = normalize(c2);

  if (n1 === n2) return 0;

  // Look up in table
  if (ETHIOPIAN_CITY_DISTANCES[n1]?.[n2] !== undefined) {
    return ETHIOPIAN_CITY_DISTANCES[n1][n2];
  }
  if (ETHIOPIAN_CITY_DISTANCES[n2]?.[n1] !== undefined) {
    return ETHIOPIAN_CITY_DISTANCES[n2][n1];
  }

  // Try original names too
  if (ETHIOPIAN_CITY_DISTANCES[c1]?.[c2] !== undefined) {
    return ETHIOPIAN_CITY_DISTANCES[c1][c2];
  }
  if (ETHIOPIAN_CITY_DISTANCES[c2]?.[c1] !== undefined) {
    return ETHIOPIAN_CITY_DISTANCES[c2][c1];
  }

  return null; // Unknown distance
}

/**
 * Check if two cities are the same (handling spelling variations)
 */
function isSameCity(city1: string, city2: string): boolean {
  if (!city1 || !city2) return false;
  const c1 = city1.toLowerCase().trim();
  const c2 = city2.toLowerCase().trim();
  if (c1 === c2) return true;

  // Handle Mekelle/Mekele variations
  const simplify = (s: string) => s.replace(/(.)\1+/g, '$1');
  return simplify(c1) === simplify(c2);
}

// ============================================================================
// HARD FILTER: Truck Type Compatibility
// ============================================================================

/**
 * Compatible truck type groups for Ethiopian freight
 * - General cargo: DRY_VAN, FLATBED, CONTAINER, VAN (interchangeable)
 * - Temperature controlled: REFRIGERATED, REEFER (interchangeable)
 * These groups are NOT compatible with each other
 */
const TRUCK_TYPE_GROUPS: Record<string, string[]> = {
  'GENERAL': ['DRY_VAN', 'FLATBED', 'CONTAINER', 'VAN'],
  'COLD_CHAIN': ['REFRIGERATED', 'REEFER'],
};

/**
 * Check if truck type is compatible with load requirement
 * Returns: 'exact' | 'compatible' | 'incompatible'
 */
function checkTruckTypeCompatibility(
  loadType: string,
  truckType: string
): 'exact' | 'compatible' | 'incompatible' {
  const loadNorm = loadType?.toUpperCase() || '';
  const truckNorm = truckType?.toUpperCase() || '';

  // Exact match
  if (loadNorm === truckNorm) return 'exact';

  // Find which group each type belongs to
  let loadGroup: string | null = null;
  let truckGroup: string | null = null;

  for (const [group, types] of Object.entries(TRUCK_TYPE_GROUPS)) {
    if (types.includes(loadNorm)) loadGroup = group;
    if (types.includes(truckNorm)) truckGroup = group;
  }

  // Same group = compatible
  if (loadGroup && truckGroup && loadGroup === truckGroup) {
    return 'compatible';
  }

  // Different groups or unknown = incompatible
  return 'incompatible';
}

// ============================================================================
// SCORING FUNCTIONS
// ============================================================================

/**
 * Calculate DH-O (Deadhead to Origin) score
 * This is the distance from truck's current location to load's pickup
 *
 * Scoring:
 * - 0-50km: 100 points (excellent, minimal deadhead)
 * - 50-100km: 70 points (acceptable)
 * - 100-200km: 30 points (marginal, heavily penalized)
 * - >200km: EXCLUDED (not shown in results)
 */
function calculateDhOriginScore(dhKm: number): number {
  if (dhKm <= 50) return 100;
  if (dhKm <= 100) return 70;
  if (dhKm <= 200) return 30;
  return 0; // Should be filtered out before reaching here
}

/**
 * Calculate route match score for in-memory matching (origin + destination alignment)
 */
function calcRouteMatchScore(
  loadPickup: string,
  loadDelivery: string,
  truckOrigin: string,
  truckDestination: string | null
): number {
  // Origin match (truck is at or near load pickup)
  const originMatch = isSameCity(loadPickup, truckOrigin) ? 100 : 0;

  // Destination match (if truck has a destination preference)
  let destMatch = 70; // Default: flexible destination
  if (truckDestination) {
    destMatch = isSameCity(loadDelivery, truckDestination) ? 100 : 0;
  }

  // Origin is more important (60/40 split)
  return Math.round(originMatch * 0.6 + destMatch * 0.4);
}

/**
 * Calculate capacity score for in-memory matching
 */
function calcCapacityMatchScore(
  loadWeight: number | null | undefined,
  truckMaxWeight: number | null | undefined
): number {
  if (!loadWeight || !truckMaxWeight) return 50; // Neutral if not specified

  if (truckMaxWeight < loadWeight) return 0; // Can't carry the load

  const utilization = (loadWeight / truckMaxWeight) * 100;
  if (utilization >= 80) return 100; // Good utilization
  if (utilization >= 60) return 90;
  if (utilization >= 40) return 70;
  return 50; // Low utilization but fits
}

/**
 * Calculate time/availability score for in-memory matching
 */
function calcTimeMatchScore(
  loadDate: Date | string | null | undefined,
  truckDate: Date | string | null | undefined
): number {
  if (!loadDate || !truckDate) return 50; // Neutral if not specified

  const load = new Date(loadDate);
  const truck = new Date(truckDate);

  // Same day or truck available before load needs pickup
  if (truck <= load) return 100;

  const diffDays = (truck.getTime() - load.getTime()) / (1000 * 60 * 60 * 24);

  if (diffDays <= 1) return 80; // 1 day late
  if (diffDays <= 3) return 50; // 2-3 days late
  if (diffDays <= 7) return 20; // Week late

  return 0; // Too late
}

/**
 * Calculate match score for a load-truck pair (in-memory version)
 *
 * HARD FILTERS (result in exclusion):
 * 1. Incompatible truck type
 * 2. DH-O > 200km
 * 3. Truck can't carry the weight
 *
 * SCORING (for trucks that pass filters):
 * - Route match: 30%
 * - DH-O distance: 30%
 * - Capacity: 20%
 * - Time: 20%
 */
function calcLoadTruckMatchScore(
  load: LoadMatchCriteria,
  truck: TruckMatchCriteria
): MatchResult {
  const reasons: string[] = [];

  // ============================================
  // HARD FILTER 1: Truck Type Compatibility
  // ============================================
  const typeCompat = checkTruckTypeCompatibility(load.truckType, truck.truckType);

  if (typeCompat === 'incompatible') {
    return {
      score: 0,
      matchReasons: [],
      isExactMatch: false,
      dhOriginKm: 9999,
      excluded: true,
      excludeReason: `Incompatible truck type: ${truck.truckType} cannot carry ${load.truckType} loads`,
    };
  }

  // ============================================
  // HARD FILTER 2: DH-O Distance
  // ============================================
  const dhOriginKm = getEthiopianCityDistance(truck.currentCity, load.pickupCity);

  // If we can't determine distance and cities are different, assume too far
  if (dhOriginKm === null && !isSameCity(truck.currentCity, load.pickupCity)) {
    return {
      score: 0,
      matchReasons: [],
      isExactMatch: false,
      dhOriginKm: 9999,
      excluded: true,
      excludeReason: `Unknown distance: ${truck.currentCity} to ${load.pickupCity}`,
    };
  }

  const actualDhKm = dhOriginKm ?? 0;

  if (actualDhKm > 200) {
    return {
      score: 0,
      matchReasons: [],
      isExactMatch: false,
      dhOriginKm: actualDhKm,
      excluded: true,
      excludeReason: `DH-O too far: ${actualDhKm}km (max 200km)`,
    };
  }

  // ============================================
  // HARD FILTER 3: Weight Capacity
  // ============================================
  if (load.weight && truck.maxWeight && truck.maxWeight < load.weight) {
    return {
      score: 0,
      matchReasons: [],
      isExactMatch: false,
      dhOriginKm: actualDhKm,
      excluded: true,
      excludeReason: `Insufficient capacity: ${truck.maxWeight}kg < ${load.weight}kg needed`,
    };
  }

  // ============================================
  // SCORING (truck passed all filters)
  // ============================================

  // Route score (30%)
  const routeScore = calcRouteMatchScore(
    load.pickupCity,
    load.deliveryCity,
    truck.currentCity,
    truck.destinationCity || null
  );
  if (routeScore === 100) reasons.push('Perfect route match');
  else if (routeScore >= 60) reasons.push('Good route alignment');

  // DH-O score (30%)
  const dhScore = calculateDhOriginScore(actualDhKm);
  if (actualDhKm === 0) reasons.push(`Same city pickup`);
  else if (actualDhKm <= 50) reasons.push(`Nearby: ${actualDhKm}km to pickup`);
  else if (actualDhKm <= 100) reasons.push(`Acceptable: ${actualDhKm}km to pickup`);
  else reasons.push(`Far: ${actualDhKm}km to pickup`);

  // Capacity score (20%)
  const capacityScore = calcCapacityMatchScore(load.weight, truck.maxWeight);
  if (capacityScore === 100) reasons.push('Optimal capacity utilization');
  else if (capacityScore === 0) reasons.push('Insufficient capacity');

  // Time score (20%)
  const timeScore = calcTimeMatchScore(load.pickupDate, truck.availableDate);
  if (timeScore === 100) reasons.push('Available on time');
  else if (timeScore >= 50) reasons.push('Available soon');

  // Truck type bonus/info
  if (typeCompat === 'exact') {
    reasons.push(`Exact ${truck.truckType} match`);
  } else {
    reasons.push(`Compatible: ${truck.truckType} for ${load.truckType}`);
  }

  // Calculate final score: Route 30%, DH-O 30%, Capacity 20%, Time 20%
  const finalScore = Math.round(
    routeScore * 0.30 +
    dhScore * 0.30 +
    capacityScore * 0.20 +
    timeScore * 0.20
  );

  // Exact match: high score + exact type + same city
  const isExactMatch = finalScore >= 85 && typeCompat === 'exact' && actualDhKm <= 50;

  if (isExactMatch) {
    reasons.unshift('⭐ Excellent Match');
  }

  return {
    score: finalScore,
    matchReasons: reasons,
    isExactMatch,
    dhOriginKm: actualDhKm,
    excluded: false,
  };
}

/**
 * Find matching loads for a truck (in-memory version)
 * Applies hard filters: truck type compatibility, DH-O distance
 *
 * @param truck - Truck criteria
 * @param loads - Array of load criteria
 * @param minScore - Minimum match score (default: 50)
 * @returns Array of loads with match scores (filtered and sorted)
 */
export function findMatchingLoads<T extends LoadMatchCriteria>(
  truck: TruckMatchCriteria,
  loads: T[],
  minScore: number = 50
): Array<T & { matchScore: number; matchReasons: string[]; isExactMatch: boolean; dhOriginKm: number }> {
  return loads
    .map(load => {
      const match = calcLoadTruckMatchScore(load, truck);
      return {
        ...load,
        matchScore: match.score,
        matchReasons: match.matchReasons,
        isExactMatch: match.isExactMatch,
        dhOriginKm: match.dhOriginKm,
        _excluded: match.excluded,
        _excludeReason: match.excludeReason,
      };
    })
    .filter(load => !load._excluded && load.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore)
    .map(({ _excluded, _excludeReason, ...rest }) => rest);
}

/**
 * Find matching trucks for a load (in-memory version)
 * Applies hard filters: truck type compatibility, DH-O distance
 *
 * @param load - Load criteria
 * @param trucks - Array of truck criteria
 * @param minScore - Minimum match score (default: 50)
 * @returns Array of trucks with match scores (filtered and sorted)
 */
export function findMatchingTrucks<T extends TruckMatchCriteria>(
  load: LoadMatchCriteria,
  trucks: T[],
  minScore: number = 50
): Array<T & { matchScore: number; matchReasons: string[]; isExactMatch: boolean; dhOriginKm: number }> {
  return trucks
    .map(truck => {
      const match = calcLoadTruckMatchScore(load, truck);
      return {
        ...truck,
        matchScore: match.score,
        matchReasons: match.matchReasons,
        isExactMatch: match.isExactMatch,
        dhOriginKm: match.dhOriginKm,
        _excluded: match.excluded,
        _excludeReason: match.excludeReason,
      };
    })
    .filter(truck => !truck._excluded && truck.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore)
    .map(({ _excluded, _excludeReason, ...rest }) => rest);
}

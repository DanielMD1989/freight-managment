/**
 * Match Calculation Utilities
 *
 * Calculate compatibility scores between loads and trucks
 * Sprint 15 - Story 15.8: Match Calculation
 */

interface LoadMatchCriteria {
  pickupCity: string;
  deliveryCity: string;
  pickupDate?: Date | string | null;
  truckType: string;
  weight?: number | null;
  lengthM?: number | null;
  fullPartial?: string | null;
}

interface TruckMatchCriteria {
  currentCity: string;
  destinationCity?: string | null;
  availableDate?: Date | string | null;
  truckType: string;
  maxWeight?: number | null;
  lengthM?: number | null;
  fullPartial?: string | null;
}

interface MatchResult {
  score: number; // 0-100
  reasons: string[];
  isExactMatch: boolean;
}

/**
 * Calculate distance match score (simplified)
 * In production, this would use actual geolocation calculations
 */
function calculateDistanceScore(city1: string, city2: string): number {
  // Exact match
  if (city1.toLowerCase() === city2.toLowerCase()) {
    return 100;
  }

  // Partial match (same region/area)
  if (city1.toLowerCase().includes(city2.toLowerCase()) ||
      city2.toLowerCase().includes(city1.toLowerCase())) {
    return 70;
  }

  // No match
  return 0;
}

/**
 * Calculate date match score
 */
function calculateDateScore(loadDate: Date | string | null | undefined, truckDate: Date | string | null | undefined): number {
  if (!loadDate || !truckDate) {
    return 50; // Neutral if dates not specified
  }

  const load = new Date(loadDate);
  const truck = new Date(truckDate);

  // Same day
  if (load.toDateString() === truck.toDateString()) {
    return 100;
  }

  // Within 1 day
  const diffDays = Math.abs(load.getTime() - truck.getTime()) / (1000 * 60 * 60 * 24);
  if (diffDays <= 1) {
    return 90;
  }

  // Within 3 days
  if (diffDays <= 3) {
    return 70;
  }

  // Within 7 days
  if (diffDays <= 7) {
    return 50;
  }

  // More than a week
  return 20;
}

/**
 * Calculate truck type match score
 */
function calculateTruckTypeScore(loadType: string, truckType: string): number {
  const loadTypeNorm = loadType?.toUpperCase() || '';
  const truckTypeNorm = truckType?.toUpperCase() || '';

  // Exact match
  if (loadTypeNorm === truckTypeNorm) {
    return 100;
  }

  // Compatible types (e.g., DRY_VAN can handle many load types)
  const compatiblePairs: Record<string, string[]> = {
    'DRY_VAN': ['VAN', 'FLATBED', 'CONTAINER'],
    'VAN': ['DRY_VAN', 'CONTAINER'],
    'FLATBED': ['DRY_VAN', 'CONTAINER'],
    'REFRIGERATED': ['REEFER'],
    'REEFER': ['REFRIGERATED'],
  };

  const compatible = compatiblePairs[loadTypeNorm] || [];
  if (compatible.includes(truckTypeNorm)) {
    return 70;
  }

  // No match
  return 0;
}

/**
 * Calculate capacity match score (weight)
 */
function calculateWeightScore(loadWeight: number | null | undefined, truckMaxWeight: number | null | undefined): number {
  if (!loadWeight || !truckMaxWeight) {
    return 50; // Neutral if not specified
  }

  // Truck can handle the load
  if (truckMaxWeight >= loadWeight) {
    // Perfect utilization (90-100% of capacity)
    const utilization = (loadWeight / truckMaxWeight) * 100;
    if (utilization >= 90) {
      return 100;
    }
    // Good utilization (70-90%)
    if (utilization >= 70) {
      return 90;
    }
    // Acceptable utilization (50-70%)
    if (utilization >= 50) {
      return 70;
    }
    // Low utilization (below 50%)
    return 50;
  }

  // Truck cannot handle the load
  return 0;
}

/**
 * Calculate length match score
 */
function calculateLengthScore(loadLength: number | null | undefined, truckLength: number | null | undefined): number {
  if (!loadLength || !truckLength) {
    return 50; // Neutral if not specified
  }

  // Truck can accommodate the load
  if (truckLength >= loadLength) {
    return 100;
  }

  // Truck too small
  return 0;
}

/**
 * Calculate full/partial match score
 */
function calculateFullPartialScore(loadType: string | null | undefined, truckType: string | null | undefined): number {
  if (!loadType || !truckType) {
    return 50; // Neutral if not specified
  }

  const loadNorm = loadType.toUpperCase();
  const truckNorm = truckType.toUpperCase();

  // Exact match
  if (loadNorm === truckNorm) {
    return 100;
  }

  // Full truck can take partial loads
  if (truckNorm === 'FULL' && loadNorm === 'PARTIAL') {
    return 70;
  }

  // Partial truck looking for full load
  if (truckNorm === 'PARTIAL' && loadNorm === 'FULL') {
    return 30;
  }

  return 50;
}

/**
 * Calculate match score between a load and a truck
 */
export function calculateLoadTruckMatch(load: LoadMatchCriteria, truck: TruckMatchCriteria): MatchResult {
  const reasons: string[] = [];
  let totalScore = 0;
  let weightSum = 0;

  // Origin match (weight: 25%)
  const originScore = calculateDistanceScore(load.pickupCity, truck.currentCity);
  totalScore += originScore * 0.25;
  weightSum += 0.25;
  if (originScore === 100) {
    reasons.push('Exact origin match');
  } else if (originScore > 0) {
    reasons.push('Nearby origin');
  }

  // Destination match (weight: 20%)
  if (truck.destinationCity) {
    const destScore = calculateDistanceScore(load.deliveryCity, truck.destinationCity);
    totalScore += destScore * 0.20;
    weightSum += 0.20;
    if (destScore === 100) {
      reasons.push('Exact destination match');
    } else if (destScore > 0) {
      reasons.push('Nearby destination');
    }
  }

  // Date match (weight: 15%)
  const dateScore = calculateDateScore(load.pickupDate, truck.availableDate);
  totalScore += dateScore * 0.15;
  weightSum += 0.15;
  if (dateScore >= 90) {
    reasons.push('Perfect timing');
  } else if (dateScore >= 70) {
    reasons.push('Good timing');
  }

  // Truck type match (weight: 20%)
  const typeScore = calculateTruckTypeScore(load.truckType, truck.truckType);
  totalScore += typeScore * 0.20;
  weightSum += 0.20;
  if (typeScore === 100) {
    reasons.push('Perfect truck type match');
  } else if (typeScore === 0) {
    reasons.push('Incompatible truck type');
  }

  // Weight capacity match (weight: 10%)
  const weightScore = calculateWeightScore(load.weight, truck.maxWeight);
  totalScore += weightScore * 0.10;
  weightSum += 0.10;
  if (weightScore === 100) {
    reasons.push('Optimal weight utilization');
  } else if (weightScore === 0) {
    reasons.push('Insufficient weight capacity');
  }

  // Length match (weight: 5%)
  const lengthScore = calculateLengthScore(load.lengthM, truck.lengthM);
  totalScore += lengthScore * 0.05;
  weightSum += 0.05;
  if (lengthScore === 0) {
    reasons.push('Insufficient length');
  }

  // Full/Partial match (weight: 5%)
  const fpScore = calculateFullPartialScore(load.fullPartial, truck.fullPartial);
  totalScore += fpScore * 0.05;
  weightSum += 0.05;

  // Normalize score to 0-100
  const finalScore = weightSum > 0 ? (totalScore / weightSum) : 0;

  // Determine if exact match (score >= 85)
  const isExactMatch = finalScore >= 85 && typeScore === 100 && originScore >= 70;

  if (isExactMatch) {
    reasons.unshift('⭐ Exact Match');
  }

  return {
    score: Math.round(finalScore),
    reasons,
    isExactMatch,
  };
}

/**
 * Calculate match score between a truck and a load (reverse)
 */
export function calculateTruckLoadMatch(truck: TruckMatchCriteria, load: LoadMatchCriteria): MatchResult {
  return calculateLoadTruckMatch(load, truck);
}

/**
 * Filter and sort trucks by match score for a given load
 */
export function findMatchingTrucks(load: LoadMatchCriteria, trucks: TruckMatchCriteria[], minScore: number = 50): Array<TruckMatchCriteria & { matchScore: number; matchReasons: string[]; isExactMatch: boolean }> {
  return trucks
    .map(truck => {
      const match = calculateLoadTruckMatch(load, truck);
      return {
        ...truck,
        matchScore: match.score,
        matchReasons: match.reasons,
        isExactMatch: match.isExactMatch,
      };
    })
    .filter(truck => truck.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore);
}

/**
 * Filter and sort loads by match score for a given truck
 */
export function findMatchingLoads(truck: TruckMatchCriteria, loads: LoadMatchCriteria[], minScore: number = 50): Array<LoadMatchCriteria & { matchScore: number; matchReasons: string[]; isExactMatch: boolean }> {
  return loads
    .map(load => {
      const match = calculateTruckLoadMatch(truck, load);
      return {
        ...load,
        matchScore: match.score,
        matchReasons: match.reasons,
        isExactMatch: match.isExactMatch,
      };
    })
    .filter(load => load.matchScore >= minScore)
    .sort((a, b) => b.matchScore - a.matchScore);
}

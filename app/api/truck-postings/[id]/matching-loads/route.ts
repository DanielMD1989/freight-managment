/**
 * Truck Posting Matching Loads API
 *
 * GET /api/truck-postings/[id]/matching-loads
 *
 * Finds matching loads for a truck posting using the matching engine.
 * Calculates DH-O (deadhead to origin) and DH-D (deadhead after delivery) using Haversine formula.
 *
 * Sprint 8 - Story 8.4: Truck/Load Matching Algorithm
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { findMatchingLoads } from '@/lib/matchCalculation';
import { db } from '@/lib/db';

/**
 * Calculate distance between two coordinates using Haversine formula
 * Returns distance in kilometers
 */
function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

/**
 * GET /api/truck-postings/[id]/matching-loads
 *
 * Find loads that match this truck posting.
 *
 * Query parameters:
 * - minScore: Minimum match score (default: 40, range: 0-100)
 * - limit: Max results (default: 20, max: 100)
 *
 * Returns:
 * {
 *   matches: LoadMatch[]
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require authentication
    const session = await requireAuth();

    // Get truck posting with coordinates
    const truckPosting = await db.truckPosting.findUnique({
      where: { id },
      include: {
        carrier: true,
        originCity: {
          select: {
            name: true,
            latitude: true,
            longitude: true,
          },
        },
        destinationCity: {
          select: {
            name: true,
            latitude: true,
            longitude: true,
          },
        },
        truck: {
          select: {
            truckType: true,
            capacity: true,
            lengthM: true,
          },
        },
      },
    });

    // Fetch all Ethiopian cities with coordinates for lookup
    const ethiopianCities = await db.ethiopianLocation.findMany({
      where: { isActive: true },
      select: { name: true, latitude: true, longitude: true },
    });

    // Helper to find city coordinates by name
    const getCityCoords = (cityName: string | null): { lat: number; lon: number } | null => {
      if (!cityName) return null;
      const searchName = cityName.toLowerCase().trim();

      // Try exact match first
      let city = ethiopianCities.find(c => c.name.toLowerCase().trim() === searchName);

      // Fuzzy match for spelling variations
      if (!city) {
        city = ethiopianCities.find(c => {
          const name = c.name.toLowerCase().trim();
          if (name.includes(searchName) || searchName.includes(name)) return true;
          // Handle double letters (Mekelle/Mekele, Jimma/Jima)
          const simplify = (s: string) => s.replace(/(.)\1+/g, '$1');
          return simplify(name) === simplify(searchName);
        });
      }

      if (city?.latitude && city?.longitude) {
        return { lat: Number(city.latitude), lon: Number(city.longitude) };
      }
      return null;
    };

    if (!truckPosting) {
      return NextResponse.json(
        { error: 'Truck posting not found' },
        { status: 404 }
      );
    }

    // Verify ownership or admin/carrier access
    const hasAccess =
      truckPosting.carrierId === session.organizationId ||
      session.role === 'ADMIN' ||
      session.role === 'CARRIER';

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this truck posting' },
        { status: 403 }
      );
    }

    // Only search for active postings
    if (truckPosting.status !== 'ACTIVE') {
      return NextResponse.json(
        {
          error: 'Cannot find matches for inactive truck posting',
          matches: [],
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const minScore = parseInt(searchParams.get('minScore') || '50', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '50', 10),
      100
    );

    // Fetch all posted loads
    const loads = await db.load.findMany({
      where: {
        status: 'POSTED',
      },
      include: {
        shipper: {
          select: {
            id: true,
            name: true,
            isVerified: true,
            contactPhone: true,
            contactEmail: true,
          },
        },
      },
      take: 500, // Limit initial fetch
    });

    // Prepare truck criteria
    const truckCriteria = {
      id: truckPosting.id,
      currentCity: truckPosting.originCity?.name || '',
      destinationCity: truckPosting.destinationCity?.name || null,
      availableDate: truckPosting.availableFrom,
      truckType: truckPosting.truck?.truckType || '',
      maxWeight: truckPosting.availableWeight ? Number(truckPosting.availableWeight) : null,
      lengthM: truckPosting.availableLength ? Number(truckPosting.availableLength) : null,
      fullPartial: truckPosting.fullPartial,
    };

    // Prepare loads criteria (filter out loads with missing required fields)
    const loadsCriteria = loads
      .filter(load => load.pickupCity && load.deliveryCity && load.truckType)
      .map(load => ({
        id: load.id,
        pickupCity: load.pickupCity!,
        deliveryCity: load.deliveryCity!,
        pickupDate: load.pickupDate,
        truckType: load.truckType,
        weight: load.weight ? Number(load.weight) : null,
        lengthM: load.lengthM ? Number(load.lengthM) : null,
        fullPartial: load.fullPartial,
        shipper: load.shipper,
        isAnonymous: load.isAnonymous,
        shipperContactName: load.shipperContactName,
        shipperContactPhone: load.shipperContactPhone,
        rate: load.rate,
        currency: load.currency,
        createdAt: load.createdAt,
        status: load.status,
      }));

    // Get truck coordinates
    const truckOriginCoords = truckPosting.originCity?.latitude && truckPosting.originCity?.longitude
      ? { lat: Number(truckPosting.originCity.latitude), lon: Number(truckPosting.originCity.longitude) }
      : null;
    const truckDestCoords = truckPosting.destinationCity?.latitude && truckPosting.destinationCity?.longitude
      ? { lat: Number(truckPosting.destinationCity.latitude), lon: Number(truckPosting.destinationCity.longitude) }
      : null;

    // Get declared DH limits
    const declaredDhO = truckPosting.preferredDhToOriginKm ? Number(truckPosting.preferredDhToOriginKm) : null;
    const declaredDhD = truckPosting.preferredDhAfterDeliveryKm ? Number(truckPosting.preferredDhAfterDeliveryKm) : null;

    // Find matching loads and calculate distances
    const matchedLoads = findMatchingLoads(truckCriteria, loadsCriteria, minScore)
      .slice(0, limit)
      .map((load: any) => {
        const fullLoad = loads.find(l => l.id === load.id);

        // Get load pickup/delivery coordinates
        const pickupCoords = getCityCoords(load.pickupCity);
        const deliveryCoords = getCityCoords(load.deliveryCity);

        // Calculate DH-O: distance from truck origin to load pickup
        let dhToOriginKm = 0;
        if (truckOriginCoords && pickupCoords) {
          dhToOriginKm = haversineDistance(
            truckOriginCoords.lat, truckOriginCoords.lon,
            pickupCoords.lat, pickupCoords.lon
          );
        }

        // Calculate DH-D: distance from load delivery to truck destination
        let dhAfterDeliveryKm = 0;
        if (truckDestCoords && deliveryCoords) {
          dhAfterDeliveryKm = haversineDistance(
            deliveryCoords.lat, deliveryCoords.lon,
            truckDestCoords.lat, truckDestCoords.lon
          );
        }

        // Check if within declared limits
        const withinDhOLimit = declaredDhO === null || dhToOriginKm <= declaredDhO;
        const withinDhDLimit = declaredDhD === null || dhAfterDeliveryKm <= declaredDhD;
        const withinDhLimits = withinDhOLimit && withinDhDLimit;

        return {
          load: {
            ...load,
            ...fullLoad,
            // Calculated distances
            dhToOriginKm,
            dhAfterDeliveryKm,
            withinDhLimits,
          },
          matchScore: load.matchScore,
          matchReasons: load.matchReasons,
          isExactMatch: load.isExactMatch,
          // Also include at top level for easy access
          dhToOriginKm,
          dhAfterDeliveryKm,
          withinDhLimits,
        };
      });

    // Sort: loads within DH limits first, then by DH-O, then match score
    const sortedMatches = matchedLoads.sort((a, b) => {
      // Loads within limits first
      if (a.withinDhLimits !== b.withinDhLimits) {
        return a.withinDhLimits ? -1 : 1;
      }
      // Then by DH-O (lower is better)
      if (a.dhToOriginKm !== b.dhToOriginKm) {
        return a.dhToOriginKm - b.dhToOriginKm;
      }
      // Then by match score (higher is better)
      return b.matchScore - a.matchScore;
    });

    const matches = sortedMatches;

    // Mask anonymous shipper information
    const maskedMatches = matches.map((match) => {
      const { load, matchScore } = match;

      // If load is anonymous, hide shipper details
      if (load.isAnonymous) {
        return {
          ...match,
          load: {
            ...load,
            shipperContactName: null,
            shipperContactPhone: null,
            shipper: {
              id: load.shipper?.id,
              name: 'Anonymous Shipper',
              isVerified: load.shipper?.isVerified,
            },
          },
        };
      }

      return match;
    });

    return NextResponse.json({
      truckPostingId: id,
      totalMatches: maskedMatches.length,
      matches: maskedMatches,
    });
  } catch (error: any) {
    console.error('Error finding matching loads:', error);

    return NextResponse.json(
      { error: 'Failed to find matching loads' },
      { status: 500 }
    );
  }
}

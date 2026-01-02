/**
 * Truck Posting Matching Loads API
 *
 * GET /api/truck-postings/[id]/matching-loads
 *
 * Finds matching loads for a truck posting using the matching engine.
 *
 * Sprint 8 - Story 8.4: Truck/Load Matching Algorithm
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { findMatchingLoads } from '@/lib/matchCalculation';
import { db } from '@/lib/db';

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

    // Get truck posting
    const truckPosting = await db.truckPosting.findUnique({
      where: { id },
      include: {
        carrier: true,
        originCity: {
          select: {
            name: true,
          },
        },
        destinationCity: {
          select: {
            name: true,
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

    // Find matching loads
    const matchedLoads = findMatchingLoads(truckCriteria, loadsCriteria, minScore)
      .slice(0, limit)
      .map((load: any) => ({
        load: {
          ...load,
          // Include full load object
          ...loads.find(l => l.id === load.id),
        },
        matchScore: load.matchScore,
        matchReasons: load.matchReasons,
        isExactMatch: load.isExactMatch,
      }));

    const matches = matchedLoads;

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

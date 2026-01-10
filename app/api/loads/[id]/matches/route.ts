/**
 * Load Matches API
 *
 * Find matching trucks for a specific load.
 *
 * GET /api/loads/[id]/matches
 *
 * Returns truck postings that match the load's route, timing, and requirements
 * with match scores and detailed breakdown.
 *
 * Sprint 8 - Story 8.4: Truck/Load Matching Algorithm
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { findMatchingTrucksForLoad, enhanceMatchesWithRoadDistances } from '@/lib/matchingEngine';

/**
 * GET /api/loads/[id]/matches
 *
 * Find matching truck postings for a load.
 *
 * Sprint 9: Added authentication and authorization checks
 *
 * Query parameters:
 * - minScore: Minimum match score (default: 40, range: 0-100)
 * - limit: Max results (default: 20, max: 50)
 * - useRoadDistance: Calculate accurate road distances via Google Routes API (default: false)
 *
 * Returns:
 * {
 *   loadId: string,
 *   matches: [
 *     {
 *       posting: { ...truck posting details... },
 *       matchScore: {
 *         score: number,
 *         breakdown: { routeScore, timeScore, capacityScore, deadheadScore },
 *         details: { routeMatch, timeOverlap, capacityFit, deadheadKm }
 *       }
 *     }
 *   ],
 *   total: number
 * }
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Sprint 9: Require authentication
    const session = await requireAuth();

    const { searchParams } = new URL(request.url);

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid load ID format' },
        { status: 400 }
      );
    }

    // Sprint 9: Verify load exists and check ownership/access
    const load = await db.load.findUnique({
      where: { id },
      select: {
        id: true,
        shipperId: true,
        status: true,
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Sprint 9: Authorization check - only load owner or admin can see matches
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isOwner = user?.organizationId === load.shipperId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden: You can only view matches for your own loads' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const minScoreParam = searchParams.get('minScore');
    const limitParam = searchParams.get('limit');
    const useRoadDistance = searchParams.get('useRoadDistance') === 'true';

    const minScore = minScoreParam
      ? Math.max(0, Math.min(100, parseInt(minScoreParam, 10)))
      : 40;

    const limit = limitParam
      ? Math.max(1, Math.min(50, parseInt(limitParam, 10)))
      : 20;

    // Find matching trucks (uses fast Haversine distance)
    let matches = await findMatchingTrucksForLoad(id, minScore, limit);

    // Optionally enhance with accurate road distances
    if (useRoadDistance && matches.length > 0) {
      const loadWithLocations = await db.load.findUnique({
        where: { id },
        include: {
          pickupLocation: true,
          deliveryLocation: true,
        },
      });

      if (loadWithLocations?.pickupLocation && loadWithLocations?.deliveryLocation) {
        matches = await enhanceMatchesWithRoadDistances(matches, {
          pickupLocation: loadWithLocations.pickupLocation,
          deliveryLocation: loadWithLocations.deliveryLocation,
        });
      }
    }

    return NextResponse.json({
      loadId: id,
      matches,
      total: matches.length,
      minScore,
      useRoadDistance,
    });
  } catch (error: any) {
    console.error('Error finding matching trucks:', error);

    if (error.message === 'Load not found or missing location details') {
      return NextResponse.json(
        { error: 'Load not found or missing location details' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to find matching trucks' },
      { status: 500 }
    );
  }
}

/**
 * Load Matching Trucks API
 *
 * GET /api/loads/[id]/matching-trucks
 *
 * Finds matching truck postings for a load using the matching engine.
 *
 * Sprint 8 - Story 8.4: Truck/Load Matching Algorithm
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { findMatchingTrucksForLoad } from '@/lib/matchingEngine';
import { db } from '@/lib/db';

/**
 * GET /api/loads/[id]/matching-trucks
 *
 * Find truck postings that match this load.
 *
 * Query parameters:
 * - minScore: Minimum match score (default: 40, range: 0-100)
 * - limit: Max results (default: 20, max: 100)
 *
 * Returns:
 * {
 *   matches: TruckMatch[]
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

    // Get load
    const load = await db.load.findUnique({
      where: { id },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Verify ownership or admin access
    const hasAccess =
      load.shipperId === session.organizationId ||
      session.role === 'ADMIN';

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden: You do not have access to this load' },
        { status: 403 }
      );
    }

    // Only search for posted loads
    if (load.status !== 'POSTED') {
      return NextResponse.json(
        {
          error: 'Cannot find matches for unpublished load',
          matches: [],
        },
        { status: 400 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const minScore = parseInt(searchParams.get('minScore') || '40', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );

    // Find matching trucks
    const matches = await findMatchingTrucksForLoad(id, minScore, limit);

    // Add calculated metrics
    const enrichedMatches = matches.map((match) => {
      const { posting, matchScore } = match;

      // Calculate DH-O and DH-D
      const dhToOriginKm = matchScore.details.deadheadKm || 0;
      const dhAfterDeliveryKm = 0; // Already included in deadheadKm

      return {
        ...match,
        metrics: {
          dhToOriginKm: Math.round(dhToOriginKm * 10) / 10,
          dhAfterDeliveryKm: Math.round(dhAfterDeliveryKm * 10) / 10,
          totalDeadheadKm: Math.round((matchScore.details.deadheadKm || 0) * 10) / 10,
        },
      };
    });

    return NextResponse.json({
      loadId: id,
      totalMatches: enrichedMatches.length,
      matches: enrichedMatches,
    });
  } catch (error: any) {
    console.error('Error finding matching trucks:', error);

    return NextResponse.json(
      { error: 'Failed to find matching trucks' },
      { status: 500 }
    );
  }
}

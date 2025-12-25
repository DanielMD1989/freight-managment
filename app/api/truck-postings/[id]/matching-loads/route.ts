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
import { findMatchingLoadsForTruck } from '@/lib/matchingEngine';
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
      },
    });

    if (!truckPosting) {
      return NextResponse.json(
        { error: 'Truck posting not found' },
        { status: 404 }
      );
    }

    // Verify ownership or admin access
    const hasAccess =
      truckPosting.carrierId === session.organizationId ||
      session.role === 'ADMIN';

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
    const minScore = parseInt(searchParams.get('minScore') || '40', 10);
    const limit = Math.min(
      parseInt(searchParams.get('limit') || '20', 10),
      100
    );

    // Find matching loads
    const matches = await findMatchingLoadsForTruck(id, minScore, limit);

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

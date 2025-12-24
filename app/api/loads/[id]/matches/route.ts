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
import { findMatchingTrucksForLoad } from '@/lib/matchingEngine';

/**
 * GET /api/loads/[id]/matches
 *
 * Find matching truck postings for a load.
 *
 * Query parameters:
 * - minScore: Minimum match score (default: 40, range: 0-100)
 * - limit: Max results (default: 20, max: 50)
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
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    const { searchParams } = new URL(request.url);

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid load ID format' },
        { status: 400 }
      );
    }

    // Parse query parameters
    const minScoreParam = searchParams.get('minScore');
    const limitParam = searchParams.get('limit');

    const minScore = minScoreParam
      ? Math.max(0, Math.min(100, parseInt(minScoreParam, 10)))
      : 40;

    const limit = limitParam
      ? Math.max(1, Math.min(50, parseInt(limitParam, 10)))
      : 20;

    // Find matching trucks
    const matches = await findMatchingTrucksForLoad(id, minScore, limit);

    return NextResponse.json({
      loadId: id,
      matches,
      total: matches.length,
      minScore,
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

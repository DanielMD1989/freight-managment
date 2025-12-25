/**
 * Truck Posting Matches API
 *
 * Find matching loads for a specific truck posting.
 *
 * GET /api/truck-postings/[id]/matches
 *
 * Returns loads that match the truck's route, availability, and capacity
 * with match scores and detailed breakdown.
 *
 * Sprint 8 - Story 8.4: Truck/Load Matching Algorithm
 */

import { NextRequest, NextResponse } from 'next/server';
import { findMatchingLoadsForTruck } from '@/lib/matchingEngine';

/**
 * GET /api/truck-postings/[id]/matches
 *
 * Find matching loads for a truck posting.
 *
 * Query parameters:
 * - minScore: Minimum match score (default: 40, range: 0-100)
 * - limit: Max results (default: 20, max: 50)
 *
 * Returns:
 * {
 *   truckPostingId: string,
 *   matches: [
 *     {
 *       load: { ...load details... },
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
    const { searchParams } = new URL(request.url);

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid truck posting ID format' },
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

    // Find matching loads
    const matches = await findMatchingLoadsForTruck(id, minScore, limit);

    return NextResponse.json({
      truckPostingId: id,
      matches,
      total: matches.length,
      minScore,
    });
  } catch (error: any) {
    console.error('Error finding matching loads:', error);

    if (error.message === 'Truck posting not found') {
      return NextResponse.json(
        { error: 'Truck posting not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to find matching loads' },
      { status: 500 }
    );
  }
}

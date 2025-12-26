/**
 * Saved Searches API
 *
 * GET /api/saved-searches - List user's saved searches
 * POST /api/saved-searches - Create new saved search
 * Sprint 14 - DAT-Style UI Transformation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/saved-searches
 * List all saved searches for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // LOADS or TRUCKS

    const where: any = {
      userId: user.userId,
    };

    if (type) {
      where.type = type;
    }

    const searches = await db.savedSearch.findMany({
      where,
      orderBy: {
        updatedAt: 'desc',
      },
    });

    return NextResponse.json({ searches });
  } catch (error: any) {
    console.error('Get saved searches error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch saved searches' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/saved-searches
 * Create a new saved search
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    const body = await request.json();

    const { name, type, criteria } = body;

    // Validate required fields
    if (!name || !type) {
      return NextResponse.json(
        { error: 'Name and type are required' },
        { status: 400 }
      );
    }

    // Validate type
    if (type !== 'LOADS' && type !== 'TRUCKS') {
      return NextResponse.json(
        { error: 'Type must be LOADS or TRUCKS' },
        { status: 400 }
      );
    }

    // Create saved search
    const search = await db.savedSearch.create({
      data: {
        name,
        type,
        criteria: criteria || {},
        userId: user.userId,
      },
    });

    return NextResponse.json({ search }, { status: 201 });
  } catch (error: any) {
    console.error('Create saved search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create saved search' },
      { status: 500 }
    );
  }
}

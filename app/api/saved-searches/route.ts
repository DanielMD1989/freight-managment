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
import { validateCSRFWithMobile } from '@/lib/csrf';
import { zodErrorResponse } from '@/lib/validation';
import { z } from 'zod';

const createSavedSearchSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['LOADS', 'TRUCKS'], { message: 'Type must be LOADS or TRUCKS' }),
  criteria: z.record(z.string(), z.any()).optional(),
});

/**
 * GET /api/saved-searches
 * List all saved searches for the authenticated user
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();
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
    // M4 FIX: Don't leak error details
    return NextResponse.json(
      { error: 'Failed to fetch saved searches' },
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
    // C2 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const user = await requireAuth();
    const body = await request.json();
    const result = createSavedSearchSchema.safeParse(body);
    if (!result.success) {
      return zodErrorResponse(result.error);
    }

    const { name, type, criteria } = result.data;

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
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Saved Search Detail API
 *
 * GET /api/saved-searches/[id] - Get specific saved search
 * PUT /api/saved-searches/[id] - Update saved search
 * DELETE /api/saved-searches/[id] - Delete saved search
 * Sprint 14 - DAT-Style UI Transformation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/saved-searches/[id]
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const search = await db.savedSearch.findUnique({
      where: { id },
    });

    if (!search) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (search.userId !== user.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    return NextResponse.json({ search });
  } catch (error: any) {
    console.error('Get saved search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch saved search' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/saved-searches/[id]
 * Update saved search
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    // Find existing search
    const existing = await db.savedSearch.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existing.userId !== user.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Update search
    const search = await db.savedSearch.update({
      where: { id },
      data: {
        name: body.name || existing.name,
        criteria: body.criteria !== undefined ? body.criteria : existing.criteria,
      },
    });

    return NextResponse.json({ search });
  } catch (error: any) {
    console.error('Update saved search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update saved search' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/saved-searches/[id]
 * Delete saved search
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    // Find existing search
    const existing = await db.savedSearch.findUnique({
      where: { id },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    // Verify ownership
    if (existing.userId !== user.userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Delete search
    await db.savedSearch.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Saved search deleted successfully' });
  } catch (error: any) {
    console.error('Delete saved search error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to delete saved search' },
      { status: 500 }
    );
  }
}

/**
 * Individual Saved Search API
 *
 * PUT /api/saved-searches/[id] - Update saved search
 * DELETE /api/saved-searches/[id] - Delete saved search
 *
 * Sprint 14 - DAT-Style UI Transformation
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { SearchType } from '@prisma/client';

/**
 * PUT /api/saved-searches/[id]
 *
 * Update an existing saved search.
 *
 * Body:
 * {
 *   name?: string,
 *   criteria?: object
 * }
 *
 * Returns:
 * {
 *   savedSearch: SavedSearch
 * }
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require authentication
    const session = await requireAuth();

    // Check if saved search exists and belongs to user
    const existingSearch = await db.savedSearch.findUnique({
      where: { id },
    });

    if (!existingSearch) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    if (existingSearch.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this saved search' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { name, criteria } = body;

    // Build update data
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (criteria !== undefined) updateData.criteria = criteria;

    // Update saved search
    const savedSearch = await db.savedSearch.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      savedSearch,
      message: 'Saved search updated successfully',
    });
  } catch (error: any) {
    console.error('Error updating saved search:', error);

    return NextResponse.json(
      { error: 'Failed to update saved search' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/saved-searches/[id]
 *
 * Delete a saved search.
 *
 * Returns:
 * {
 *   message: string
 * }
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Require authentication
    const session = await requireAuth();

    // Check if saved search exists and belongs to user
    const existingSearch = await db.savedSearch.findUnique({
      where: { id },
    });

    if (!existingSearch) {
      return NextResponse.json(
        { error: 'Saved search not found' },
        { status: 404 }
      );
    }

    if (existingSearch.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Forbidden: You do not own this saved search' },
        { status: 403 }
      );
    }

    // Delete saved search
    await db.savedSearch.delete({
      where: { id },
    });

    return NextResponse.json({
      message: 'Saved search deleted successfully',
    });
  } catch (error: any) {
    console.error('Error deleting saved search:', error);

    return NextResponse.json(
      { error: 'Failed to delete saved search' },
      { status: 500 }
    );
  }
}

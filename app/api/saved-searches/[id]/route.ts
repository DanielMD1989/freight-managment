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
import { validateCSRFWithMobile } from '@/lib/csrf';
import { zodErrorResponse } from '@/lib/validation';
import { db } from '@/lib/db';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

const updateSavedSearchSchema = z.object({
  name: z.string().min(1).optional(),
  criteria: z.record(z.string(), z.any()).optional(),
});

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
    // C3 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

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

    // Parse and validate request body
    const body = await request.json();
    const result = updateSavedSearchSchema.safeParse(body);
    if (!result.success) {
      return zodErrorResponse(result.error);
    }

    const { name, criteria } = result.data;

    // Build update data
    const updateData: Prisma.SavedSearchUpdateInput = {};
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
  // FIX: Use unknown type
  } catch (error: unknown) {
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
    // C3 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

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
  // FIX: Use unknown type
  } catch (error: unknown) {
    console.error('Error deleting saved search:', error);

    return NextResponse.json(
      { error: 'Failed to delete saved search' },
      { status: 500 }
    );
  }
}

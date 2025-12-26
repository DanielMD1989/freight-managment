/**
 * Duplicate Truck Posting Endpoint
 *
 * POST /api/truck-postings/[id]/duplicate
 * Creates a copy of an existing truck posting
 * Sprint 14 - DAT-Style UI Transformation (Phase 4)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await requireAuth(request);
    const { id } = await params;

    // Fetch original truck posting
    const originalPosting = await db.truckPosting.findUnique({
      where: { id },
    });

    if (!originalPosting) {
      return NextResponse.json(
        { error: 'Truck posting not found' },
        { status: 404 }
      );
    }

    // Verify ownership (carrier or admin)
    if (user.role !== 'ADMIN' && originalPosting.carrierId !== user.organizationId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }

    // Create duplicate truck posting
    const { id: _, createdAt, updatedAt, postedAt, expiresAt, ...postingData } = originalPosting;

    const duplicatePosting = await db.truckPosting.create({
      data: {
        ...postingData,
        status: 'UNPOSTED', // New posting starts as UNPOSTED
        isKept: false, // Don't copy KEPT status
        postedAt: null,
        expiresAt: null,
      },
    });

    return NextResponse.json(duplicatePosting, { status: 201 });
  } catch (error: any) {
    console.error('Duplicate truck posting error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to duplicate truck posting' },
      { status: 500 }
    );
  }
}

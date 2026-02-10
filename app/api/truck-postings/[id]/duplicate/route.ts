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
import { requireCSRF } from '@/lib/csrf';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await requireAuth();

    // CSRF protection for state-changing operation
    // Skip for mobile clients using Bearer token authentication
    const isMobileClient = request.headers.get('x-client-type') === 'mobile';
    const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');

    if (!isMobileClient && !hasBearerAuth) {
      const csrfError = await requireCSRF(request);
      if (csrfError) {
        return csrfError;
      }
    }

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

    // Verify role is CARRIER or ADMIN
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';
    const isCarrier = user.role === 'CARRIER';

    if (!isAdmin && !isCarrier) {
      return NextResponse.json(
        { error: 'Only carriers can duplicate truck postings' },
        { status: 403 }
      );
    }

    // Verify ownership (carrier must own the posting, admin can duplicate any)
    if (!isAdmin && originalPosting.carrierId !== user.organizationId) {
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
        status: 'ACTIVE', // New posting starts as ACTIVE
        postedAt: new Date(),
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

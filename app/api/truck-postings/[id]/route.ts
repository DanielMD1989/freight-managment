/**
 * Individual Truck Posting API
 *
 * GET: View posting details
 * PATCH: Update posting (owner only)
 * DELETE: Cancel posting (owner only, soft delete)
 *
 * Security:
 * - GET: Public for ACTIVE postings
 * - PATCH/DELETE: Requires authentication
 * - PATCH/DELETE: CSRF protection (double-submit cookie)
 * - PATCH/DELETE: Ownership verification
 * - DELETE: Soft delete (sets status to CANCELLED)
 *
 * Sprint 8 - Story 8.1: Truck Posting Infrastructure
 * Sprint 9 - Story 9.6: CSRF Protection
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { requireCSRF } from '@/lib/csrf';
import { hasElevatedPermissions } from '@/lib/dispatcherPermissions';
import { UserRole } from '@prisma/client';
// P1-001-B FIX: Import CacheInvalidation for update/delete operations
import { CacheInvalidation } from '@/lib/cache';

// Update schema (partial)
const UpdateTruckPostingSchema = z.object({
  availableFrom: z.string().optional(),
  availableTo: z.string().optional().nullable(),
  availableLength: z.number().positive().optional().nullable(),
  availableWeight: z.number().positive().optional().nullable(),
  preferredDhToOriginKm: z.number().nonnegative().optional().nullable(),
  preferredDhAfterDeliveryKm: z.number().nonnegative().optional().nullable(),
  contactName: z.string().min(2).optional(),
  contactPhone: z.string().min(10).optional(),
  notes: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'EXPIRED', 'CANCELLED', 'MATCHED']).optional(),
  // Additional fields from frontend
  originCityId: z.string().optional(),
  destinationCityId: z.string().optional().nullable(),
  fullPartial: z.enum(['FULL', 'PARTIAL']).optional(),
  ownerName: z.string().optional().nullable(),
});

/**
 * GET /api/truck-postings/[id]
 *
 * Get details of a specific truck posting.
 *
 * Returns posting if ACTIVE or if requester is the owner.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid posting ID format' },
        { status: 400 }
      );
    }

    // Fetch posting
    const posting = await db.truckPosting.findUnique({
      where: { id },
      include: {
        truck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
            capacity: true,
            lengthM: true,
          },
        },
        originCity: {
          select: {
            id: true,
            name: true,
            nameEthiopic: true,
            region: true,
            latitude: true,
            longitude: true,
          },
        },
        destinationCity: {
          select: {
            id: true,
            name: true,
            nameEthiopic: true,
            region: true,
            latitude: true,
            longitude: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
            isVerified: true,
            contactPhone: true,
          },
        },
      },
    });

    if (!posting) {
      return NextResponse.json(
        { error: 'Truck posting not found' },
        { status: 404 }
      );
    }

    // Show ACTIVE postings to everyone
    // Show non-ACTIVE postings only to owner or elevated roles
    if (posting.status !== 'ACTIVE') {
      const session = await requireAuth();

      // Sprint 16: Allow dispatcher, platform ops, and admin to view all postings
      const hasElevatedPerms = hasElevatedPermissions({
        role: session.role as UserRole,
        organizationId: session.organizationId,
        userId: session.userId
      });

      // Verify ownership (user's organization owns this posting)
      if (posting.carrierId !== session.organizationId && !hasElevatedPerms) {
        return NextResponse.json(
          { error: 'Truck posting not found' },
          { status: 404 }
        );
      }
    }

    // Convert Decimals to numbers for JSON
    const formattedPosting = {
      ...posting,
      availableLength: posting.availableLength
        ? Number(posting.availableLength)
        : null,
      availableWeight: posting.availableWeight
        ? Number(posting.availableWeight)
        : null,
      preferredDhToOriginKm: posting.preferredDhToOriginKm
        ? Number(posting.preferredDhToOriginKm)
        : null,
      preferredDhAfterDeliveryKm: posting.preferredDhAfterDeliveryKm
        ? Number(posting.preferredDhAfterDeliveryKm)
        : null,
      truck: {
        ...posting.truck,
        capacity: Number(posting.truck.capacity),
        lengthM: posting.truck.lengthM ? Number(posting.truck.lengthM) : null,
      },
      originCity: posting.originCity
        ? {
            ...posting.originCity,
            latitude: Number(posting.originCity.latitude),
            longitude: Number(posting.originCity.longitude),
          }
        : null,
      destinationCity: posting.destinationCity
        ? {
            ...posting.destinationCity,
            latitude: Number(posting.destinationCity.latitude),
            longitude: Number(posting.destinationCity.longitude),
          }
        : null,
    };

    return NextResponse.json(formattedPosting);
  } catch (error) {
    console.error('Error fetching truck posting:', error);

    return NextResponse.json(
      { error: 'Failed to fetch truck posting' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/truck-postings/[id]
 *
 * Update a truck posting.
 *
 * Security: Requires ownership verification
 * Cannot update MATCHED or CANCELLED postings
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid posting ID format' },
        { status: 400 }
      );
    }

    // CSRF protection for state-changing operation
    // Mobile clients MUST use Bearer token authentication (inherently CSRF-safe)
    // Web clients MUST provide CSRF token
    const isMobileClient = request.headers.get('x-client-type') === 'mobile';
    const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');

    if (isMobileClient && !hasBearerAuth) {
      return NextResponse.json(
        { error: 'Mobile clients require Bearer authentication' },
        { status: 401 }
      );
    }

    if (!isMobileClient && !hasBearerAuth) {
      const csrfError = await requireCSRF(request);
      if (csrfError) {
        return csrfError;
      }
    }

    // Require authentication
    const session = await requireAuth();

    // Fetch existing posting
    const existing = await db.truckPosting.findUnique({
      where: { id },
      select: {
        carrierId: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Truck posting not found' },
        { status: 404 }
      );
    }

    // Sprint 16: Allow dispatcher, platform ops, and admin to update any posting
    const hasElevatedPerms = hasElevatedPermissions({
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId
    });

    // Verify ownership (user's organization owns this posting)
    if (existing.carrierId !== session.organizationId && !hasElevatedPerms) {
      return NextResponse.json(
        { error: 'You can only update postings for your own organization' },
        { status: 403 }
      );
    }

    // Prevent editing MATCHED or CANCELLED postings
    if (existing.status === 'MATCHED' || existing.status === 'CANCELLED') {
      return NextResponse.json(
        {
          error: `Cannot update ${existing.status.toLowerCase()} posting`,
        },
        { status: 400 }
      );
    }

    // Validate input
    const body = await request.json();
    const validationResult = UpdateTruckPostingSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request data',
          details: validationResult.error.format(),
        },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Block manual status change to MATCHED - only system can set this
    if (data.status === 'MATCHED') {
      return NextResponse.json(
        { error: 'MATCHED status can only be set by system' },
        { status: 400 }
      );
    }

    // Validate city IDs if provided
    if (data.originCityId) {
      const originCity = await db.ethiopianLocation.findUnique({
        where: { id: data.originCityId },
        select: { id: true },
      });
      if (!originCity) {
        return NextResponse.json(
          { error: 'Invalid origin city ID' },
          { status: 400 }
        );
      }
    }
    if (data.destinationCityId) {
      const destCity = await db.ethiopianLocation.findUnique({
        where: { id: data.destinationCityId },
        select: { id: true },
      });
      if (!destCity) {
        return NextResponse.json(
          { error: 'Invalid destination city ID' },
          { status: 400 }
        );
      }
    }

    // Update postedAt when status changes to ACTIVE (posted)
    const shouldUpdatePostedAt = data.status === 'ACTIVE' && existing.status !== 'ACTIVE';

    // Update posting
    const updated = await db.truckPosting.update({
      where: { id },
      data: {
        ...(data.availableFrom && {
          availableFrom: new Date(data.availableFrom),
        }),
        ...(data.availableTo !== undefined && {
          availableTo: data.availableTo ? new Date(data.availableTo) : null,
        }),
        ...(data.availableLength !== undefined && {
          availableLength: data.availableLength,
        }),
        ...(data.availableWeight !== undefined && {
          availableWeight: data.availableWeight,
        }),
        ...(data.preferredDhToOriginKm !== undefined && {
          preferredDhToOriginKm: data.preferredDhToOriginKm,
        }),
        ...(data.preferredDhAfterDeliveryKm !== undefined && {
          preferredDhAfterDeliveryKm: data.preferredDhAfterDeliveryKm,
        }),
        ...(data.contactName && { contactName: data.contactName }),
        ...(data.contactPhone && { contactPhone: data.contactPhone }),
        ...(data.notes !== undefined && { notes: data.notes }),
        ...(data.status && { status: data.status }),
        // Update postedAt when posting (changing to ACTIVE)
        ...(shouldUpdatePostedAt && { postedAt: new Date() }),
        // Additional fields from frontend
        ...(data.originCityId && { originCityId: data.originCityId }),
        ...(data.destinationCityId !== undefined && {
          destinationCityId: data.destinationCityId,
        }),
        ...(data.fullPartial && { fullPartial: data.fullPartial }),
        ...(data.ownerName !== undefined && { ownerName: data.ownerName }),
      },
      include: {
        truck: true,
        originCity: true,
        destinationCity: true,
      },
    });

    // P1-001-B FIX: Invalidate cache after posting update to ensure fresh data
    await CacheInvalidation.truck(updated.truckId, updated.carrierId, updated.carrierId);

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating truck posting:', error);

    return NextResponse.json(
      { error: 'Failed to update truck posting' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/truck-postings/[id]
 *
 * Cancel a truck posting (soft delete).
 *
 * Security: Requires ownership verification
 * Sets status to CANCELLED instead of hard delete
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format
    if (!id || typeof id !== 'string' || id.length < 10) {
      return NextResponse.json(
        { error: 'Invalid posting ID format' },
        { status: 400 }
      );
    }

    // CSRF protection for state-changing operation
    // Mobile clients MUST use Bearer token authentication (inherently CSRF-safe)
    // Web clients MUST provide CSRF token
    const isMobileClient = request.headers.get('x-client-type') === 'mobile';
    const hasBearerAuth = request.headers.get('authorization')?.startsWith('Bearer ');

    if (isMobileClient && !hasBearerAuth) {
      return NextResponse.json(
        { error: 'Mobile clients require Bearer authentication' },
        { status: 401 }
      );
    }

    if (!isMobileClient && !hasBearerAuth) {
      const csrfError = await requireCSRF(request);
      if (csrfError) {
        return csrfError;
      }
    }

    // Require authentication
    const session = await requireAuth();

    // Fetch existing posting
    const existing = await db.truckPosting.findUnique({
      where: { id },
      select: {
        carrierId: true,
        status: true,
      },
    });

    if (!existing) {
      return NextResponse.json(
        { error: 'Truck posting not found' },
        { status: 404 }
      );
    }

    // Sprint 16: Allow dispatcher, platform ops, and admin to cancel any posting
    const hasElevatedPerms = hasElevatedPermissions({
      role: session.role as UserRole,
      organizationId: session.organizationId,
      userId: session.userId
    });

    // Verify ownership (user's organization owns this posting)
    if (existing.carrierId !== session.organizationId && !hasElevatedPerms) {
      return NextResponse.json(
        { error: 'You can only cancel postings for your own organization' },
        { status: 403 }
      );
    }

    // Soft delete: set status to CANCELLED
    const cancelled = await db.truckPosting.update({
      where: { id },
      data: { status: 'CANCELLED' },
      select: {
        id: true,
        status: true,
        truckId: true,
        carrierId: true,
      },
    });

    // P1-001-B FIX: Invalidate cache after posting cancellation to remove stale data
    await CacheInvalidation.truck(cancelled.truckId, cancelled.carrierId, cancelled.carrierId);

    return NextResponse.json({
      message: 'Truck posting cancelled successfully',
      posting: cancelled,
    });
  } catch (error) {
    console.error('Error cancelling truck posting:', error);

    return NextResponse.json(
      { error: 'Failed to cancel truck posting' },
      { status: 500 }
    );
  }
}

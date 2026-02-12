/**
 * Flagged Organizations API
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.6: Bypass Detection Review Dashboard
 *
 * Provides detailed list of organizations with bypass warnings
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, Permission } from '@/lib/rbac';
import { db } from '@/lib/db';
import { z } from 'zod';
// CSRF FIX: Add CSRF validation
import { validateCSRFWithMobile } from '@/lib/csrf';
import { Prisma } from '@prisma/client';

const updateFlagSchema = z.object({
  organizationId: z.string().min(1),
  isFlagged: z.boolean(),
  flagReason: z.string().optional(),
});

/**
 * GET /api/admin/bypass-warnings/organizations
 *
 * Get list of organizations with bypass warnings
 *
 * Query parameters:
 * - status: 'flagged' | 'suspicious' | 'all' (default: 'all')
 * - limit: number (default: 100)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_USERS);

    const { searchParams } = request.nextUrl;
    const status = searchParams.get('status') || 'all';
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build where clause
    let where: Prisma.OrganizationWhereInput = {};

    switch (status) {
      case 'flagged':
        where = {
          isFlagged: true,
        };
        break;

      case 'suspicious':
        where = {
          suspiciousCancellationCount: { gte: 1 },
          isFlagged: false,
        };
        break;

      case 'all':
      default:
        where = {
          OR: [
            { isFlagged: true },
            { suspiciousCancellationCount: { gte: 1 } },
            { bypassAttemptCount: { gte: 1 } },
          ],
        };
        break;
    }

    // Fetch organizations with warning data
    const [organizations, totalCount] = await Promise.all([
      db.organization.findMany({
        where,
        include: {
          _count: {
            select: {
              loads: true,
              trucks: true,
              disputesAgainst: true,
            },
          },
        },
        orderBy: [
          { isFlagged: 'desc' },
          { suspiciousCancellationCount: 'desc' },
          { bypassAttemptCount: 'desc' },
        ],
        take: limit,
        skip: offset,
      }),
      db.organization.count({ where }),
    ]);

    return NextResponse.json({
      organizations,
      totalCount,
      limit,
      offset,
      hasMore: offset + organizations.length < totalCount,
    });
  } catch (error) {
    console.error('Get flagged organizations error:', error);

    if (error instanceof Error && error.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/bypass-warnings/organizations/[id]
 *
 * Update organization flag status
 */
export async function PATCH(request: NextRequest) {
  try {
    // CSRF FIX: Validate CSRF token
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_USERS);

    const body = await request.json();
    const result = updateFlagSchema.safeParse(body);
    if (!result.success) {
      // FIX: Use zodErrorResponse to avoid leaking validation details
      const { zodErrorResponse } = await import('@/lib/validation');
      return zodErrorResponse(result.error);
    }

    const { organizationId, isFlagged, flagReason } = result.data;

    const updated = await db.organization.update({
      where: { id: organizationId },
      data: {
        isFlagged,
        flaggedAt: isFlagged ? new Date() : null,
        flagReason: isFlagged ? flagReason : null,
      },
    });

    return NextResponse.json({
      message: isFlagged
        ? 'Organization flagged successfully'
        : 'Flag removed successfully',
      organization: updated,
    });
  // FIX: Use unknown type with type guard
  } catch (error: unknown) {
    console.error('Update organization flag error:', error);

    if (error instanceof Error && error.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to update organization' },
      { status: 500 }
    );
  }
}

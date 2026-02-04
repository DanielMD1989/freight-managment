/**
 * Bypass Warnings API
 *
 * Sprint 16 - Story 16.6: Anti-Bypass Detection & Incentives
 *
 * Admin endpoint to manage automated bypass warnings
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, Permission } from '@/lib/rbac';
import { checkAndSendWarnings, sendBypassWarning, BypassWarningType } from '@/lib/bypassWarnings';
import { z } from 'zod';

const manualWarningSchema = z.object({
  organizationId: z.string().min(1),
  warningType: z.string().min(1),
});

/**
 * POST /api/admin/bypass-warnings
 *
 * Trigger automated warning checks or send manual warning
 *
 * Body (optional):
 * {
 *   organizationId: string, // For manual warning
 *   warningType: string,     // Warning type enum
 * }
 *
 * If no body provided, runs automated check for all organizations
 */
export async function POST(request: NextRequest) {
  try {
    await requirePermission(Permission.MANAGE_USERS);

    const body = await request.json().catch(() => null);

    if (body?.organizationId && body?.warningType) {
      // Validate manual warning body
      const result = manualWarningSchema.safeParse(body);
      if (!result.success) {
        return NextResponse.json(
          { error: 'Validation failed', details: result.error.issues },
          { status: 400 }
        );
      }

      const { organizationId, warningType } = result.data;

      if (!Object.values(BypassWarningType).includes(warningType as any)) {
        return NextResponse.json(
          { error: 'Invalid warning type' },
          { status: 400 }
        );
      }

      await sendBypassWarning(organizationId, warningType as BypassWarningType);

      return NextResponse.json({
        message: 'Warning sent successfully',
        organizationId,
        warningType,
      });
    } else {
      // Automated warning check for all organizations
      const result = await checkAndSendWarnings();

      return NextResponse.json({
        message: 'Automated warning check completed',
        ...result,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    console.error('Bypass warnings error:', error);

    if (error instanceof Error && error.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      {
        error: 'Failed to process bypass warnings',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/bypass-warnings/stats
 *
 * Get statistics about organizations needing warnings
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_USERS);

    const { db } = await import('@/lib/db');

    // Get counts of organizations in different warning states
    const [
      firstTimeOffenders,
      multipleOffenders,
      flaggedOrganizations,
      totalSuspicious,
    ] = await Promise.all([
      db.organization.count({
        where: {
          suspiciousCancellationCount: { gte: 1, lt: 3 },
          isFlagged: false,
        },
      }),
      db.organization.count({
        where: {
          suspiciousCancellationCount: { gte: 3 },
          isFlagged: false,
        },
      }),
      db.organization.count({
        where: {
          isFlagged: true,
        },
      }),
      db.organization.count({
        where: {
          suspiciousCancellationCount: { gte: 1 },
        },
      }),
    ]);

    return NextResponse.json({
      stats: {
        firstTimeOffenders,
        multipleOffenders,
        flaggedOrganizations,
        totalSuspicious,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Get warning stats error:', error);

    if (error instanceof Error && error.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

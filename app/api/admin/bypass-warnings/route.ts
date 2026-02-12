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
// M8 FIX: Add CSRF validation
import { validateCSRFWithMobile } from '@/lib/csrf';
// H10 FIX: Use zodErrorResponse instead of leaking details
import { zodErrorResponse } from '@/lib/validation';

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
    // M8 FIX: Add CSRF validation
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_USERS);

    const body = await request.json().catch(() => null);

    if (body?.organizationId && body?.warningType) {
      // Validate manual warning body
      const result = manualWarningSchema.safeParse(body);
      // H10 FIX: Use zodErrorResponse instead of leaking schema details
      if (!result.success) {
        return zodErrorResponse(result.error);
      }

      const { organizationId, warningType } = result.data;

      // H13 FIX: Validate enum properly without unsafe cast
      const validWarningTypes = Object.values(BypassWarningType) as string[];
      if (!validWarningTypes.includes(warningType)) {
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
  // H11 FIX: Use unknown type with type guard
  } catch (error: unknown) {
    console.error('Bypass warnings error:', error);

    if (error instanceof Error && error.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // H12 FIX: Don't leak error details, log them server-side only
    return NextResponse.json(
      { error: 'Failed to process bypass warnings' },
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
  // H11 FIX: Use unknown type with type guard
  } catch (error: unknown) {
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

/**
 * Bypass Report API
 *
 * Sprint 16 - Story 16.6: Anti-Bypass Detection & Incentives
 *
 * Allows users to report bypass attempts
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { validateCSRFWithMobile } from '@/lib/csrf';
import { recordBypassReport } from '@/lib/bypassDetection';
import { z } from 'zod';
import { zodErrorResponse } from '@/lib/validation';

const reportBypassSchema = z.object({
  reason: z.string().optional(),
});

/**
 * POST /api/loads/[id]/report-bypass
 *
 * Report a bypass attempt on a load
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // C11 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: loadId } = await params;
    const session = await requireAuth();

    // Parse request body
    const body = await request.json();
    const validatedData = reportBypassSchema.parse(body);

    // Record bypass report
    await recordBypassReport(loadId, session.userId, validatedData.reason);

    return NextResponse.json({
      message: 'Bypass attempt reported successfully',
      loadId,
    });
  } catch (error: any) {
    console.error('Report bypass error:', error);

    if (error.message === 'Load not found') {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    if (error.message === 'Bypass already reported for this load') {
      return NextResponse.json(
        { error: 'Bypass already reported for this load' },
        { status: 400 }
      );
    }

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * MFA Recovery Codes API
 *
 * Sprint 19 - Two-Factor Authentication
 *
 * GET: View recovery codes status (not the codes themselves)
 * POST: Regenerate recovery codes (invalidates old ones)
 *
 * Security:
 * - CSRF protection on POST
 * - Password required to regenerate
 * - Old codes invalidated when regenerating
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, verifyPassword, generateRecoveryCodes, hashRecoveryCodes } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireCSRF } from '@/lib/csrf';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';

/**
 * GET /api/user/mfa/recovery-codes
 * Get recovery codes status (count remaining, when generated)
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const mfa = await db.userMFA.findUnique({
      where: { userId: session.userId },
      select: {
        enabled: true,
        recoveryCodesGeneratedAt: true,
        recoveryCodesUsedCount: true,
        recoveryCodes: true,
      },
    });

    if (!mfa?.enabled) {
      return NextResponse.json(
        { error: 'MFA is not enabled' },
        { status: 400 }
      );
    }

    const totalCodes = mfa.recoveryCodes?.length || 0;
    const usedCodes = mfa.recoveryCodesUsedCount || 0;
    const remainingCodes = Math.max(0, totalCodes - usedCodes);

    return NextResponse.json({
      totalCodes,
      usedCodes,
      remainingCodes,
      generatedAt: mfa.recoveryCodesGeneratedAt,
      warning: remainingCodes <= 2 ? 'You have few recovery codes left. Consider regenerating.' : null,
    });
  } catch (error) {
    console.error('Get recovery codes error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to get recovery codes status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/mfa/recovery-codes
 * Regenerate recovery codes (requires password)
 */
export async function POST(request: NextRequest) {
  try {
    // Validate CSRF
    const csrfError = requireCSRF(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to regenerate recovery codes' },
        { status: 400 }
      );
    }

    // Check if MFA is enabled
    const mfa = await db.userMFA.findUnique({
      where: { userId: session.userId },
    });

    if (!mfa?.enabled) {
      return NextResponse.json(
        { error: 'MFA is not enabled' },
        { status: 400 }
      );
    }

    // Verify password
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      await logSecurityEvent({
        userId: session.userId,
        eventType: SecurityEventType.RECOVERY_CODES_REGENERATED,
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'Invalid password' },
      });

      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 400 }
      );
    }

    // Generate new recovery codes
    const recoveryCodes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(recoveryCodes);

    // Update MFA with new codes
    await db.userMFA.update({
      where: { userId: session.userId },
      data: {
        recoveryCodes: hashedCodes,
        recoveryCodesGeneratedAt: new Date(),
        recoveryCodesUsedCount: 0,
      },
    });

    // Log regeneration
    await logSecurityEvent({
      userId: session.userId,
      eventType: SecurityEventType.RECOVERY_CODES_REGENERATED,
      ipAddress,
      userAgent,
      success: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Recovery codes regenerated successfully',
      recoveryCodes: recoveryCodes, // Only returned once!
      warning: 'Save these new recovery codes. Your old codes are now invalid.',
    });
  } catch (error) {
    console.error('Regenerate recovery codes error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to regenerate recovery codes' },
      { status: 500 }
    );
  }
}

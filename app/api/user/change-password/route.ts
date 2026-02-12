/**
 * Change Password API
 *
 * Sprint 19 - Security Settings
 *
 * Allows users to change their password.
 * Requires current password verification.
 * Enforces password policy.
 * Revokes all other sessions after password change.
 *
 * Security Features:
 * - CSRF protection (double-submit cookie pattern)
 * - Current password verification required
 * - Password policy enforcement
 * - Session revocation (excludes current session)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, validatePasswordPolicy, verifyPassword, hashPassword, revokeAllSessions } from '@/lib/auth';
import { db } from '@/lib/db';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';
import { requireCSRF } from '@/lib/csrf';

// Request body schema
const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters'),
  logoutOtherSessions: z.boolean().optional().default(true),
});

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF token for state-changing operation
    const csrfError = requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    const session = await requireAuth();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    const body = await request.json();

    // Validate request body with Zod
    const parseResult = changePasswordSchema.safeParse(body);
    if (!parseResult.success) {
      // FIX: Use zodErrorResponse to avoid schema leak
      const { zodErrorResponse } = await import('@/lib/validation');
      return zodErrorResponse(parseResult.error);
    }

    const { currentPassword, newPassword, logoutOtherSessions } = parseResult.data;

    // Get user with password hash
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        passwordHash: true,
      },
    });

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash);

    if (!isCurrentPasswordValid) {
      // Log failed attempt
      await logSecurityEvent({
        userId: session.userId,
        eventType: SecurityEventType.PASSWORD_CHANGE,
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'Invalid current password' },
      });

      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    // Validate new password policy
    const validation = validatePasswordPolicy(newPassword);
    if (!validation.valid) {
      return NextResponse.json(
        { error: 'Password does not meet requirements', details: validation.errors },
        { status: 400 }
      );
    }

    // Check if new password is same as current
    const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      );
    }

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password in database
    await db.user.update({
      where: { id: session.userId },
      data: {
        passwordHash: hashedPassword,
        updatedAt: new Date(),
      },
    });

    // Revoke other sessions if requested (excludes current session so user stays logged in)
    let revokedSessionCount = 0;
    if (logoutOtherSessions) {
      // Exclude current session from revocation so user doesn't get logged out
      revokedSessionCount = await revokeAllSessions(session.userId, session.sessionId);
    }

    // Log successful password change
    await logSecurityEvent({
      userId: session.userId,
      eventType: SecurityEventType.PASSWORD_CHANGE,
      ipAddress,
      userAgent,
      success: true,
      metadata: { revokedSessions: revokedSessionCount },
    });

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully',
      revokedSessions: revokedSessionCount,
    });
  } catch (error) {
    console.error('Failed to change password:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    );
  }
}

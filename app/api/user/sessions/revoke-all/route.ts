/**
 * Revoke All Sessions API
 *
 * Sprint 19 - Session Management
 *
 * Allows users to revoke all their sessions (logout all devices).
 *
 * Security Features:
 * - CSRF protection (double-submit cookie pattern)
 * - Authentication required
 * - Security event logging
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, revokeAllSessions } from '@/lib/auth';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';
import { requireCSRF } from '@/lib/csrf';

/**
 * POST /api/user/sessions/revoke-all
 * Revoke all sessions for the current user
 */
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

    // Revoke all sessions
    const revokedCount = await revokeAllSessions(session.userId);

    // Log the session revocation
    await logSecurityEvent({
      userId: session.userId,
      eventType: SecurityEventType.SESSION_REVOKE_ALL,
      ipAddress,
      userAgent,
      success: true,
      metadata: {
        revokedSessionCount: revokedCount,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'All sessions revoked successfully',
      revokedCount,
    });
  } catch (error) {
    console.error('Failed to revoke all sessions:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to revoke sessions' },
      { status: 500 }
    );
  }
}

/**
 * User Session Management API
 *
 * Sprint 19 - Session Management
 *
 * Allows users to revoke a specific session.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, revokeSession } from '@/lib/auth';
import { db } from '@/lib/db';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';

/**
 * DELETE /api/user/sessions/[id]
 * Revoke a specific session
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: sessionId } = await params;
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Verify the session belongs to the user
    const targetSession = await db.session.findUnique({
      where: { id: sessionId },
      select: {
        id: true,
        userId: true,
        deviceInfo: true,
        revokedAt: true,
      },
    });

    if (!targetSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    if (targetSession.userId !== session.userId) {
      return NextResponse.json(
        { error: 'Unauthorized to revoke this session' },
        { status: 403 }
      );
    }

    if (targetSession.revokedAt) {
      return NextResponse.json(
        { error: 'Session already revoked' },
        { status: 400 }
      );
    }

    // Revoke the session
    await revokeSession(sessionId);

    // Log the session revocation
    await logSecurityEvent({
      userId: session.userId,
      eventType: SecurityEventType.SESSION_REVOKE,
      ipAddress,
      userAgent,
      success: true,
      metadata: {
        revokedSessionId: sessionId,
        revokedDeviceInfo: targetSession.deviceInfo,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Session revoked successfully',
    });
  } catch (error) {
    console.error('Failed to revoke session:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to revoke session' },
      { status: 500 }
    );
  }
}

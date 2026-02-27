/**
 * MFA Disable API
 *
 * Sprint 19 - Two-Factor Authentication
 *
 * Disables MFA for a user account.
 * Requires password verification for security.
 *
 * Security:
 * - CSRF protection required
 * - Password verification required
 * - All sessions revoked after disable
 * - Security event logged
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth, verifyPassword, revokeAllSessions } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireCSRF } from "@/lib/csrf";
import { logSecurityEvent, SecurityEventType } from "@/lib/security-events";

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF
    const csrfError = requireCSRF(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const body = await request.json();
    const { password } = body;

    if (!password) {
      return NextResponse.json(
        { error: "Password is required to disable MFA" },
        { status: 400 }
      );
    }

    // Check if MFA is enabled
    const mfa = await db.userMFA.findUnique({
      where: { userId: session.userId },
    });

    if (!mfa?.enabled) {
      return NextResponse.json(
        { error: "MFA is not enabled" },
        { status: 400 }
      );
    }

    // Verify password
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { passwordHash: true },
    });

    if (!user?.passwordHash) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const isValidPassword = await verifyPassword(password, user.passwordHash);

    if (!isValidPassword) {
      // Log failed attempt
      await logSecurityEvent({
        userId: session.userId,
        eventType: SecurityEventType.MFA_DISABLE,
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: "Invalid password" },
      });

      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 400 }
      );
    }

    // Disable MFA
    await db.userMFA.update({
      where: { userId: session.userId },
      data: {
        enabled: false,
        recoveryCodes: [],
        recoveryCodesGeneratedAt: null,
        recoveryCodesUsedCount: 0,
      },
    });

    // Revoke all sessions except current (security measure)
    const revokedCount = await revokeAllSessions(
      session.userId,
      session.sessionId
    );

    // Log successful MFA disable
    await logSecurityEvent({
      userId: session.userId,
      eventType: SecurityEventType.MFA_DISABLE,
      ipAddress,
      userAgent,
      success: true,
      metadata: { revokedSessions: revokedCount },
    });

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication has been disabled",
      revokedSessions: revokedCount,
    });
  } catch (error) {
    console.error("MFA disable error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to disable MFA" },
      { status: 500 }
    );
  }
}

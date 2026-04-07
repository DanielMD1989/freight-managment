export const dynamic = "force-dynamic";
/**
 * MFA Verify API
 *
 * Sprint 19 - Two-Factor Authentication
 *
 * Completes MFA enrollment by verifying OTP.
 * On success, generates recovery codes and enables MFA.
 *
 * Security:
 * - CSRF protection required
 * - OTP verified using bcrypt
 * - Recovery codes generated and hashed
 * - Max 5 verification attempts
 */

import { NextRequest, NextResponse } from "next/server";
import {
  requireAuth,
  verifyPassword,
  generateRecoveryCodes,
  hashRecoveryCodes,
} from "@/lib/auth";
import { db } from "@/lib/db";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { logSecurityEvent, SecurityEventType } from "@/lib/security-events";

const MAX_VERIFY_ATTEMPTS = 5;

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const ipAddress =
      request.headers.get("x-forwarded-for") ||
      request.headers.get("x-real-ip");
    const userAgent = request.headers.get("user-agent");

    const body = await request.json();
    const { otp } = body;

    if (!otp || typeof otp !== "string" || otp.length !== 6) {
      return NextResponse.json(
        { error: "Invalid OTP format. Must be 6 digits." },
        { status: 400 }
      );
    }

    // Check if MFA is already enabled
    const existingMFA = await db.userMFA.findUnique({
      where: { userId: session.userId },
    });

    if (existingMFA?.enabled) {
      return NextResponse.json(
        { error: "MFA is already enabled" },
        { status: 400 }
      );
    }

    // Find pending MFA verification event
    const pendingEvent = await db.securityEvent.findFirst({
      where: {
        userId: session.userId,
        eventType: SecurityEventType.MFA_ENABLE,
        success: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!pendingEvent) {
      return NextResponse.json(
        {
          error:
            "No pending MFA setup found. Please start the setup process again.",
        },
        { status: 400 }
      );
    }

    const metadata = pendingEvent.metadata as {
      otpHash?: string;
      expiresAt?: string;
      stage?: string;
      attempts?: number;
    } | null;

    if (!metadata?.otpHash || metadata.stage !== "pending_verification") {
      return NextResponse.json(
        {
          error:
            "Invalid MFA setup state. Please start the setup process again.",
        },
        { status: 400 }
      );
    }

    // Check if OTP is expired
    if (metadata.expiresAt && new Date() > new Date(metadata.expiresAt)) {
      return NextResponse.json(
        { error: "Verification code has expired. Please request a new one." },
        { status: 400 }
      );
    }

    // Check attempts
    const attempts = metadata.attempts || 0;
    if (attempts >= MAX_VERIFY_ATTEMPTS) {
      return NextResponse.json(
        {
          error:
            "Too many failed attempts. Please request a new verification code.",
        },
        { status: 429 }
      );
    }

    // Verify OTP. Test-only bypass: if MFA_TEST_BYPASS_OTP is set
    // (only in dev/test environments — never in production) AND the
    // submitted OTP equals the bypass value, accept it. This lets
    // Playwright e2e tests drive the 2FA enable/disable flow without
    // a real SMS gateway. Triple safety check:
    //   1. NODE_ENV must NOT be "production"
    //   2. The bypass env var must be set (defaults to undefined)
    //   3. The submitted OTP must exactly match
    const isTestBypass =
      process.env.NODE_ENV !== "production" &&
      process.env.MFA_TEST_BYPASS_OTP &&
      otp === process.env.MFA_TEST_BYPASS_OTP;
    const isValid =
      isTestBypass || (await verifyPassword(otp, metadata.otpHash));

    if (!isValid) {
      // Increment attempts
      await db.securityEvent.update({
        where: { id: pendingEvent.id },
        data: {
          metadata: {
            ...metadata,
            attempts: attempts + 1,
          },
        },
      });

      // Log failed attempt
      await logSecurityEvent({
        userId: session.userId,
        eventType: SecurityEventType.MFA_VERIFY_FAILURE,
        ipAddress,
        userAgent,
        success: false,
        metadata: { remainingAttempts: MAX_VERIFY_ATTEMPTS - attempts - 1 },
      });

      return NextResponse.json(
        {
          error: "Invalid verification code",
          remainingAttempts: MAX_VERIFY_ATTEMPTS - attempts - 1,
        },
        { status: 400 }
      );
    }

    // OTP is valid - generate recovery codes
    const recoveryCodes = generateRecoveryCodes();
    const hashedCodes = await hashRecoveryCodes(recoveryCodes);

    // Enable MFA
    await db.userMFA.update({
      where: { userId: session.userId },
      data: {
        enabled: true,
        recoveryCodes: hashedCodes,
        recoveryCodesGeneratedAt: new Date(),
        recoveryCodesUsedCount: 0,
        lastMfaVerifiedAt: new Date(),
      },
    });

    // Mark pending event as completed
    await db.securityEvent.update({
      where: { id: pendingEvent.id },
      data: {
        metadata: {
          ...metadata,
          stage: "completed",
          completedAt: new Date().toISOString(),
        },
      },
    });

    // Log successful MFA enable
    await logSecurityEvent({
      userId: session.userId,
      eventType: SecurityEventType.MFA_VERIFY_SUCCESS,
      ipAddress,
      userAgent,
      success: true,
    });

    return NextResponse.json({
      success: true,
      message: "Two-factor authentication enabled successfully",
      recoveryCodes: recoveryCodes, // Only returned once, user must save them!
      warning:
        "Save these recovery codes in a safe place. They will not be shown again.",
    });
  } catch (error) {
    return handleApiError(error, "MFA verify error");
  }
}

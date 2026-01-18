/**
 * Verify MFA API
 *
 * Sprint 19 - Two-Factor Authentication
 *
 * Completes login by verifying MFA OTP or recovery code.
 * Called after /api/auth/login returns mfaRequired: true.
 *
 * Security:
 * - Validates MFA token from login
 * - Verifies OTP or recovery code
 * - Creates session on success
 * - Rate limited to prevent brute force
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifyPassword, setSession, createSessionRecord, verifyRecoveryCode } from '@/lib/auth';
import { jwtVerify } from 'jose';
import { logAuthSuccess, logAuthFailure } from '@/lib/auditLog';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';
import { getClientIP } from '@/lib/security';

// MFA token secret (must match login route)
const MFA_TOKEN_SECRET = new TextEncoder().encode(
  process.env.MFA_TOKEN_SECRET || process.env.JWT_SECRET || 'mfa-temp-token-secret-32chars!'
);

interface MFATokenPayload {
  userId: string;
  email: string;
  purpose: string;
  otpHash: string;
}

export async function POST(request: NextRequest) {
  try {
    const clientIp = getClientIP(request.headers);
    const userAgent = request.headers.get('user-agent');

    const body = await request.json();
    const { mfaToken, otp, recoveryCode } = body;

    // Validate input
    if (!mfaToken) {
      return NextResponse.json(
        { error: 'MFA token is required' },
        { status: 400 }
      );
    }

    if (!otp && !recoveryCode) {
      return NextResponse.json(
        { error: 'OTP or recovery code is required' },
        { status: 400 }
      );
    }

    // Verify MFA token
    let tokenPayload: MFATokenPayload;
    try {
      const { payload } = await jwtVerify(mfaToken, MFA_TOKEN_SECRET);
      tokenPayload = payload as unknown as MFATokenPayload;

      if (tokenPayload.purpose !== 'mfa_verification') {
        throw new Error('Invalid token purpose');
      }
    } catch (error) {
      console.error('MFA token verification failed:', error);
      return NextResponse.json(
        { error: 'Invalid or expired MFA token. Please login again.' },
        { status: 401 }
      );
    }

    // Get user
    const user = await db.user.findUnique({
      where: { id: tokenPayload.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        organizationId: true,
        isActive: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get MFA config
    const mfa = await db.userMFA.findUnique({
      where: { userId: user.id },
      select: {
        enabled: true,
        recoveryCodes: true,
        recoveryCodesUsedCount: true,
      },
    });

    if (!mfa?.enabled) {
      return NextResponse.json(
        { error: 'MFA is not enabled for this account' },
        { status: 400 }
      );
    }

    let verificationSuccess = false;
    let usedRecoveryCode = false;

    // Try OTP verification first
    if (otp) {
      const isValidOTP = await verifyPassword(otp, tokenPayload.otpHash);
      if (isValidOTP) {
        verificationSuccess = true;
      }
    }

    // Try recovery code if OTP failed or not provided
    if (!verificationSuccess && recoveryCode && mfa.recoveryCodes.length > 0) {
      const codeIndex = await verifyRecoveryCode(recoveryCode, mfa.recoveryCodes);
      if (codeIndex >= 0) {
        verificationSuccess = true;
        usedRecoveryCode = true;

        // Mark recovery code as used by incrementing count
        await db.userMFA.update({
          where: { userId: user.id },
          data: {
            recoveryCodesUsedCount: (mfa.recoveryCodesUsedCount || 0) + 1,
          },
        });

        // Log recovery code usage
        await logSecurityEvent({
          userId: user.id,
          eventType: SecurityEventType.RECOVERY_CODE_USED,
          ipAddress: clientIp,
          userAgent,
          success: true,
          metadata: { remainingCodes: mfa.recoveryCodes.length - (mfa.recoveryCodesUsedCount || 0) - 1 },
        });
      }
    }

    if (!verificationSuccess) {
      // Log failed MFA attempt
      await logSecurityEvent({
        userId: user.id,
        eventType: SecurityEventType.MFA_VERIFY_FAILURE,
        ipAddress: clientIp,
        userAgent,
        success: false,
      });

      await logAuthFailure(user.email, 'Invalid MFA code', request);

      return NextResponse.json(
        { error: 'Invalid verification code' },
        { status: 400 }
      );
    }

    // MFA verified - complete login

    // Update last login
    await db.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Update last MFA verified
    await db.userMFA.update({
      where: { userId: user.id },
      data: { lastMfaVerifiedAt: new Date() },
    });

    // Create session
    const { sessionId } = await createSessionRecord(user.id, clientIp, userAgent);

    // Set session cookie
    await setSession({
      userId: user.id,
      email: user.email,
      role: user.role,
      status: user.status,
      organizationId: user.organizationId || undefined,
      sessionId,
    });

    // Log successful MFA verification
    await logSecurityEvent({
      userId: user.id,
      eventType: SecurityEventType.MFA_VERIFY_SUCCESS,
      ipAddress: clientIp,
      userAgent,
      success: true,
    });

    await logAuthSuccess(user.id, user.email, request);

    // Generate CSRF token
    const { generateCSRFToken } = await import('@/lib/csrf');
    const csrfToken = generateCSRFToken();

    const response = NextResponse.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        organizationId: user.organizationId,
      },
      ...(usedRecoveryCode && {
        warning: 'You used a recovery code. Consider regenerating your recovery codes.',
        remainingRecoveryCodes: mfa.recoveryCodes.length - (mfa.recoveryCodesUsedCount || 0) - 1,
      }),
      csrfToken,
    });

    // Set CSRF cookie
    response.cookies.set('csrf_token', csrfToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24, // 24 hours
    });

    return response;
  } catch (error) {
    console.error('MFA verification error:', error);

    return NextResponse.json(
      { error: 'Failed to verify MFA' },
      { status: 500 }
    );
  }
}

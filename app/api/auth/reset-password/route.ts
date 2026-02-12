/**
 * Reset Password API
 *
 * Sprint 19 - Password Reset Flow
 *
 * Allows users to reset their password using an OTP.
 *
 * Security Features:
 * - OTP verified using bcrypt comparison (hashed storage)
 * - Brute force protection (max 5 attempts per token)
 * - Token invalidated after successful use
 * - All sessions revoked after password reset
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword, validatePasswordPolicy, revokeAllSessions, verifyPassword } from '@/lib/auth';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';
import { emailSchema } from '@/lib/validation';

// Request body schema
const resetPasswordSchema = z.object({
  email: emailSchema,
  otp: z.string().min(1, 'OTP is required').max(10, 'OTP is too long'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

// Max OTP verification attempts per token
const MAX_OTP_ATTEMPTS = 5;

/**
 * POST /api/auth/reset-password
 * Reset password using OTP
 */
export async function POST(request: NextRequest) {
  try {
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    const body = await request.json();

    // Validate request body with Zod
    const parseResult = resetPasswordSchema.safeParse(body);
    if (!parseResult.success) {
      // FIX: Use zodErrorResponse to avoid schema leak
      const { zodErrorResponse } = await import('@/lib/validation');
      return zodErrorResponse(parseResult.error);
    }

    const { email, otp, newPassword } = parseResult.data;

    // Normalize inputs (email already lowercase from schema)
    const normalizedEmail = email.trim();
    const normalizedOTP = otp.trim();

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        status: true,
      },
    });

    if (!user) {
      // Add delay to prevent timing attacks
      await new Promise(resolve => setTimeout(resolve, 100));
      return NextResponse.json(
        { error: 'Invalid or expired reset code' },
        { status: 400 }
      );
    }

    // Check if user account is active enough for password reset
    if (user.status === 'SUSPENDED' || user.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Account is not eligible for password reset. Please contact support.' },
        { status: 403 }
      );
    }

    // Find valid (non-expired, unused) reset tokens for this user
    const validTokens = await db.passwordResetToken.findMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
      take: 5, // Only check recent tokens
    });

    if (validTokens.length === 0) {
      // Log failed attempt
      await logSecurityEvent({
        userId: user.id,
        eventType: SecurityEventType.PASSWORD_RESET,
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'No valid tokens found' },
      });

      return NextResponse.json(
        { error: 'Invalid or expired reset code' },
        { status: 400 }
      );
    }

    // Try to match OTP against valid tokens (bcrypt comparison)
    let matchedToken = null;
    for (const token of validTokens) {
      // Check if token has too many failed attempts
      if (token.attempts >= MAX_OTP_ATTEMPTS) {
        continue; // Skip locked tokens
      }

      // Compare OTP using bcrypt
      const isMatch = await verifyPassword(normalizedOTP, token.token);
      if (isMatch) {
        matchedToken = token;
        break;
      }
    }

    // If no match found, increment attempts on the most recent token
    if (!matchedToken) {
      const mostRecentToken = validTokens.find(t => t.attempts < MAX_OTP_ATTEMPTS);

      if (mostRecentToken) {
        // Increment attempt counter
        await db.passwordResetToken.update({
          where: { id: mostRecentToken.id },
          data: { attempts: { increment: 1 } },
        });

        const remainingAttempts = MAX_OTP_ATTEMPTS - mostRecentToken.attempts - 1;

        // Log failed attempt
        await logSecurityEvent({
          userId: user.id,
          eventType: SecurityEventType.PASSWORD_RESET,
          ipAddress,
          userAgent,
          success: false,
          metadata: {
            reason: 'Invalid OTP',
            attemptsUsed: mostRecentToken.attempts + 1,
            remainingAttempts,
          },
        });

        if (remainingAttempts <= 0) {
          return NextResponse.json(
            { error: 'Too many failed attempts. Please request a new reset code.' },
            { status: 429 }
          );
        }

        return NextResponse.json(
          {
            error: 'Invalid reset code',
            remainingAttempts,
          },
          { status: 400 }
        );
      }

      return NextResponse.json(
        { error: 'Invalid or expired reset code. Please request a new one.' },
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

    // Hash new password
    const hashedPassword = await hashPassword(newPassword);

    // Update password and mark token as used in a transaction
    await db.$transaction([
      // Update user password
      db.user.update({
        where: { id: user.id },
        data: {
          passwordHash: hashedPassword,
          updatedAt: new Date(),
        },
      }),
      // Mark token as used
      db.passwordResetToken.update({
        where: { id: matchedToken.id },
        data: { usedAt: new Date() },
      }),
    ]);

    // Revoke all sessions (security best practice after password reset)
    const revokedCount = await revokeAllSessions(user.id);

    // Log successful password reset
    await logSecurityEvent({
      userId: user.id,
      eventType: SecurityEventType.PASSWORD_RESET,
      ipAddress,
      userAgent,
      success: true,
      metadata: { revokedSessions: revokedCount },
    });

    return NextResponse.json({
      success: true,
      message: 'Password reset successfully. Please log in with your new password.',
    });
  } catch (error) {
    console.error('Failed to reset password:', error);

    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    );
  }
}

/**
 * Forgot Password API
 *
 * Sprint 19 - Password Reset Flow
 *
 * Allows users to request a password reset OTP.
 * OTP is sent to their registered email.
 *
 * Security Features:
 * - OTP is hashed before storage (bcrypt)
 * - Rate limiting per email (3 requests/hour)
 * - Timing-attack resistant (rate limit checked before user lookup)
 * - No email enumeration (same response for all cases)
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { generateOTP, hashPassword } from '@/lib/auth';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';
import { emailSchema } from '@/lib/validation';
import { sendEmail, createEmailHTML } from '@/lib/email';

// Request body schema
const forgotPasswordSchema = z.object({
  email: emailSchema,
});

// Rate limiting: Max 3 requests per email per hour
const RATE_LIMIT_WINDOW_HOURS = 1;
const RATE_LIMIT_MAX_REQUESTS = 3;

// OTP expiry: 10 minutes
const OTP_EXPIRY_MINUTES = 10;

// Max OTP verification attempts per token
export const MAX_OTP_ATTEMPTS = 5;

/**
 * POST /api/auth/forgot-password
 * Request a password reset OTP
 */
export async function POST(request: NextRequest) {
  try {
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    const body = await request.json();

    // Validate request body with Zod
    const validation = forgotPasswordSchema.safeParse(body);
    if (!validation.success) {
      // FIX: Use zodErrorResponse to avoid schema leak
      const { zodErrorResponse } = await import('@/lib/validation');
      return zodErrorResponse(validation.error);
    }

    // Email is already normalized (lowercase) by the schema
    const normalizedEmail = validation.data.email.trim();

    // Rate limiting FIRST (before user lookup to prevent timing attacks)
    const rateLimitWindowStart = new Date();
    rateLimitWindowStart.setHours(rateLimitWindowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);

    const recentRequests = await db.passwordResetToken.count({
      where: {
        user: { email: normalizedEmail },
        createdAt: { gte: rateLimitWindowStart },
      },
    });

    if (recentRequests >= RATE_LIMIT_MAX_REQUESTS) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please try again later.' },
        { status: 429 }
      );
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        firstName: true,
        status: true,
      },
    });

    // Always return success even if user not found (security best practice)
    // This prevents email enumeration attacks
    if (!user) {
      // Add artificial delay to match successful request timing
      await new Promise(resolve => setTimeout(resolve, 100));
      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset code.',
        expiresIn: OTP_EXPIRY_MINUTES * 60,
      });
    }

    // Check if user account is active
    if (user.status === 'SUSPENDED' || user.status === 'REJECTED') {
      // Log attempt but don't reveal account status
      await logSecurityEvent({
        userId: user.id,
        eventType: SecurityEventType.PASSWORD_RESET_REQUEST,
        ipAddress,
        userAgent,
        success: false,
        metadata: { reason: 'Account not active', status: user.status },
      });

      return NextResponse.json({
        success: true,
        message: 'If an account exists with this email, you will receive a password reset code.',
        expiresIn: OTP_EXPIRY_MINUTES * 60,
      });
    }

    // Invalidate any existing unused tokens
    await db.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(), // Mark as used
      },
    });

    // Generate OTP
    const otp = generateOTP();

    // Hash OTP before storage (SECURITY: prevents DB breach from compromising all OTPs)
    const hashedOTP = await hashPassword(otp);

    // Set expiry time
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    // Store HASHED OTP token
    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        token: hashedOTP, // Stored as bcrypt hash
        expiresAt,
      },
    });

    // Log the password reset request
    await logSecurityEvent({
      userId: user.id,
      eventType: SecurityEventType.PASSWORD_RESET_REQUEST,
      ipAddress,
      userAgent,
      success: true,
    });

    // Send email with OTP via configured email provider
    // SECURITY: OTP is ONLY delivered via email, never in API response
    const recipientName = user.firstName || 'User';
    const otpEmailContent = `
      <h1>Password Reset Code</h1>
      <p>Dear ${recipientName},</p>
      <p>You requested a password reset for your FreightET account.</p>
      <div class="info-section">
        <p>Your verification code is:</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; text-align: center; color: #1f2937; margin: 16px 0;">${otp}</p>
      </div>
      <p>This code expires in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
      <div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
        <p style="margin: 0; color: #856404;">
          <strong>Didn't request this?</strong><br>
          If you didn't request a password reset, you can safely ignore this email.
        </p>
      </div>
    `;

    await sendEmail({
      to: user.email,
      subject: 'Password Reset Code - FreightET',
      html: createEmailHTML(otpEmailContent),
      text: `Your password reset code is: ${otp}\n\nThis code expires in ${OTP_EXPIRY_MINUTES} minutes.\n\nIf you didn't request this, ignore this email.`,
    }).catch((err) => {
      // Log but don't fail the request — user should still get success response
      console.error('Failed to send password reset email:', err);
    });

    return NextResponse.json({
      success: true,
      message: 'If an account exists with this email, you will receive a password reset code.',
      expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
    });
  } catch (error) {
    console.error('Failed to process forgot password request:', error);

    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

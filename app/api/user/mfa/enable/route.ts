/**
 * MFA Enable API
 *
 * Sprint 19 - Two-Factor Authentication
 *
 * Initiates MFA setup by sending OTP to user's phone.
 * User must verify OTP to complete MFA enrollment.
 *
 * Flow:
 * 1. User provides phone number
 * 2. Server generates OTP and sends via SMS
 * 3. Server stores hashed OTP in pending state
 * 4. User verifies OTP via /api/user/mfa/verify
 *
 * Security:
 * - CSRF protection required
 * - Rate limited to 3 attempts per hour
 * - OTP hashed before storage
 * - OTP expires in 5 minutes
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, generateOTP, hashPassword } from '@/lib/auth';
import { db } from '@/lib/db';
import { requireCSRF } from '@/lib/csrf';
import { sendMFAOTP, isValidEthiopianPhone, isAfroMessageConfigured } from '@/lib/sms/afromessage';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';

// OTP expires in 5 minutes
const OTP_EXPIRY_MINUTES = 5;

// Rate limit: 3 MFA setup attempts per hour
const RATE_LIMIT_WINDOW_HOURS = 1;
const RATE_LIMIT_MAX_ATTEMPTS = 3;

export async function POST(request: NextRequest) {
  try {
    // Validate CSRF
    const csrfError = requireCSRF(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    const body = await request.json();
    const { phone } = body;

    // Validate phone number
    if (!phone) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    if (!isValidEthiopianPhone(phone)) {
      return NextResponse.json(
        { error: 'Invalid Ethiopian phone number format' },
        { status: 400 }
      );
    }

    // Check if MFA is already enabled
    const existingMFA = await db.userMFA.findUnique({
      where: { userId: session.userId },
    });

    if (existingMFA?.enabled) {
      return NextResponse.json(
        { error: 'MFA is already enabled. Disable it first to change phone number.' },
        { status: 400 }
      );
    }

    // Rate limiting: Check recent MFA setup attempts
    const rateLimitWindowStart = new Date();
    rateLimitWindowStart.setHours(rateLimitWindowStart.getHours() - RATE_LIMIT_WINDOW_HOURS);

    const recentAttempts = await db.securityEvent.count({
      where: {
        userId: session.userId,
        eventType: SecurityEventType.MFA_ENABLE,
        createdAt: { gte: rateLimitWindowStart },
      },
    });

    if (recentAttempts >= RATE_LIMIT_MAX_ATTEMPTS) {
      return NextResponse.json(
        { error: 'Too many MFA setup attempts. Please try again later.' },
        { status: 429 }
      );
    }

    // Generate OTP
    const otp = generateOTP();
    const hashedOTP = await hashPassword(otp);

    // Set expiry
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + OTP_EXPIRY_MINUTES);

    // Store pending MFA setup (upsert)
    await db.userMFA.upsert({
      where: { userId: session.userId },
      create: {
        userId: session.userId,
        enabled: false,
        phone: phone,
        // Store pending OTP data in a way we can verify later
        // We'll use recoveryCodesGeneratedAt as a timestamp for pending verification
      },
      update: {
        phone: phone,
        enabled: false,
      },
    });

    // Store OTP for verification (using a temporary approach)
    // In production, you might want a dedicated MFAVerificationToken table
    // For now, we'll store in SecurityEvent metadata
    await logSecurityEvent({
      userId: session.userId,
      eventType: SecurityEventType.MFA_ENABLE,
      ipAddress,
      userAgent,
      success: true, // Attempt initiated
      metadata: {
        phone: phone.slice(-4), // Last 4 digits for logging
        otpHash: hashedOTP,
        expiresAt: expiresAt.toISOString(),
        stage: 'pending_verification',
      },
    });

    // Send OTP via SMS
    if (isAfroMessageConfigured()) {
      const result = await sendMFAOTP(phone, otp);
      if (!result.success) {
        console.error('[MFA] Failed to send OTP:', result.error);
        return NextResponse.json(
          { error: 'Failed to send verification code. Please try again.' },
          { status: 500 }
        );
      }
    }
    // SECURITY: OTP is never logged - use SMS service for delivery

    return NextResponse.json({
      success: true,
      message: 'Verification code sent to your phone',
      expiresIn: OTP_EXPIRY_MINUTES * 60, // seconds
      phoneLastFour: phone.slice(-4),
    });
  } catch (error) {
    console.error('MFA enable error:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    return NextResponse.json(
      { error: 'Failed to initiate MFA setup' },
      { status: 500 }
    );
  }
}

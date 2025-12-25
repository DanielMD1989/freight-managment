/**
 * Forgot Password API
 *
 * POST /api/auth/forgot-password
 *
 * Initiates password reset flow by generating a reset token and sending
 * it via email to the user.
 *
 * Sprint 1 - Story 1.2: User Authentication
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sendEmail, createPasswordResetEmail } from '@/lib/email';
import crypto from 'crypto';

/**
 * POST /api/auth/forgot-password
 *
 * Request body:
 * {
 *   email: string
 * }
 *
 * Returns:
 * {
 *   message: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const user = await db.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    // Always return success message to prevent email enumeration
    const successMessage = {
      message: 'If an account exists with this email, a password reset link has been sent.',
    };

    if (!user) {
      // Don't reveal that user doesn't exist
      return NextResponse.json(successMessage);
    }

    if (!user.isActive) {
      // Don't reveal that account is inactive
      return NextResponse.json(successMessage);
    }

    // Generate secure random token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing reset tokens for this user
    await db.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        expiresAt: new Date(), // Expire immediately
      },
    });

    // Create new reset token
    await db.passwordResetToken.create({
      data: {
        token: resetToken,
        userId: user.id,
        expiresAt,
      },
    });

    // Generate reset URL
    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}`;

    // Send password reset email
    try {
      await sendEmail(
        createPasswordResetEmail({
          recipientEmail: user.email,
          recipientName: user.firstName || 'User',
          resetUrl,
          expiresInMinutes: 60,
        })
      );
    } catch (emailError) {
      console.error('Failed to send password reset email:', emailError);
      // Still return success to prevent email enumeration
      // In production, you might want to log this for monitoring
    }

    return NextResponse.json(successMessage);
  } catch (error: any) {
    console.error('Error in forgot-password:', error);

    return NextResponse.json(
      { error: 'An error occurred while processing your request' },
      { status: 500 }
    );
  }
}

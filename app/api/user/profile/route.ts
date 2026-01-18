/**
 * User Profile API
 *
 * Sprint 19 - Profile Settings
 *
 * Allows users to view and update their profile information.
 *
 * Security Features:
 * - CSRF protection on PATCH (state-changing operation)
 * - Authentication required for all operations
 * - Security event logging for profile changes
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';
import { requireCSRF } from '@/lib/csrf';

/**
 * GET /api/user/profile
 * Retrieve user's profile information
 */
export async function GET() {
  try {
    const session = await requireAuth();

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    console.error('Failed to get user profile:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve profile' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/user/profile
 * Update user's profile information
 */
export async function PATCH(request: NextRequest) {
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
    const { firstName, lastName, phone } = body;

    // Validate inputs
    if (!firstName && !lastName && phone === undefined) {
      return NextResponse.json(
        { error: 'No fields to update' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, string | null> = {};
    const changes: string[] = [];

    if (firstName !== undefined) {
      if (typeof firstName !== 'string' || firstName.trim().length === 0) {
        return NextResponse.json(
          { error: 'First name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.firstName = firstName.trim();
      changes.push('firstName');
    }

    if (lastName !== undefined) {
      if (typeof lastName !== 'string' || lastName.trim().length === 0) {
        return NextResponse.json(
          { error: 'Last name cannot be empty' },
          { status: 400 }
        );
      }
      updateData.lastName = lastName.trim();
      changes.push('lastName');
    }

    if (phone !== undefined) {
      // Phone can be null to remove it
      if (phone !== null && typeof phone !== 'string') {
        return NextResponse.json(
          { error: 'Invalid phone number format' },
          { status: 400 }
        );
      }
      updateData.phone = phone ? phone.trim() : null;
      changes.push('phone');
    }

    // Update user profile
    const updatedUser = await db.user.update({
      where: { id: session.userId },
      data: {
        ...updateData,
        updatedAt: new Date(),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        role: true,
        status: true,
        updatedAt: true,
      },
    });

    // Log profile update
    await logSecurityEvent({
      userId: session.userId,
      eventType: SecurityEventType.PROFILE_UPDATE,
      ipAddress,
      userAgent,
      success: true,
      metadata: { updatedFields: changes },
    });

    // If phone was changed, log it separately for security purposes
    if (changes.includes('phone')) {
      await logSecurityEvent({
        userId: session.userId,
        eventType: SecurityEventType.PHONE_CHANGE,
        ipAddress,
        userAgent,
        success: true,
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    console.error('Failed to update profile:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    );
  }
}

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
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { logSecurityEvent, SecurityEventType } from '@/lib/security-events';
import { requireCSRF } from '@/lib/csrf';
import { phoneSchema } from '@/lib/validation';

// Request body schema for profile update
const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name cannot be empty').max(100, 'First name is too long').optional(),
  lastName: z.string().min(1, 'Last name cannot be empty').max(100, 'Last name is too long').optional(),
  phone: z.union([phoneSchema, z.null()]).optional(),
}).refine(
  (data) => data.firstName !== undefined || data.lastName !== undefined || data.phone !== undefined,
  { message: 'No fields to update' }
);

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

    // Validate request body with Zod
    const validation = updateProfileSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { firstName, lastName, phone } = validation.data;

    // Build update data
    const updateData: Record<string, string | null> = {};
    const changes: string[] = [];

    if (firstName !== undefined) {
      updateData.firstName = firstName.trim();
      changes.push('firstName');
    }

    if (lastName !== undefined) {
      updateData.lastName = lastName.trim();
      changes.push('lastName');
    }

    if (phone !== undefined) {
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

/**
 * User Notification Preferences API
 *
 * Phase 2 - Story 15.13: Real-time Notifications
 *
 * Manages user notification preferences
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/user/notification-preferences
 * Retrieve user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get user preferences
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        notificationPreferences: true,
      },
    });

    return NextResponse.json({
      preferences: user?.notificationPreferences || {},
    });
  } catch (error) {
    console.error('Failed to get notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve preferences' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/notification-preferences
 * Update user's notification preferences
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { preferences } = body;

    if (!preferences || !Array.isArray(preferences)) {
      return NextResponse.json(
        { error: 'Invalid preferences format' },
        { status: 400 }
      );
    }

    // Convert preferences array to object
    const preferencesObj = preferences.reduce((acc, pref) => {
      acc[pref.type] = pref.enabled;
      return acc;
    }, {} as Record<string, boolean>);

    // Update user preferences
    await db.user.update({
      where: { id: session.user.id },
      data: {
        notificationPreferences: preferencesObj,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Preferences updated successfully',
    });
  } catch (error) {
    console.error('Failed to update notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update preferences' },
      { status: 500 }
    );
  }
}

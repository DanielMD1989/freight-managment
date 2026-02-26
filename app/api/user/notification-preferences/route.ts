/**
 * User Notification Preferences API
 *
 * Phase 2 - Story 15.13: Real-time Notifications
 *
 * Manages user notification preferences
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { db } from "@/lib/db";

/**
 * GET /api/user/notification-preferences
 * Retrieve user's notification preferences
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Get user preferences
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        notificationPreferences: true,
      },
    });

    return NextResponse.json({
      preferences: user?.notificationPreferences || {},
    });
  } catch (error) {
    console.error("Failed to get notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to retrieve preferences" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/user/notification-preferences
 * Update user's notification preferences
 *
 * Accepts two formats:
 * 1. Array format: { preferences: [{ type: 'LOAD_ASSIGNED', enabled: true }, ...] }
 * 2. Object format: { preferences: { LOAD_ASSIGNED: true, ... } }
 */
export async function POST(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();

    const body = await request.json();
    const { preferences } = body;

    if (!preferences) {
      return NextResponse.json(
        { error: "Preferences are required" },
        { status: 400 }
      );
    }

    let preferencesObj: Record<string, boolean>;

    // Handle array format (legacy)
    if (Array.isArray(preferences)) {
      preferencesObj = preferences.reduce(
        (
          acc: Record<string, boolean>,
          pref: { type: string; enabled: boolean }
        ) => {
          acc[pref.type] = pref.enabled;
          return acc;
        },
        {} as Record<string, boolean>
      );
    }
    // Handle object format (new settings page)
    else if (typeof preferences === "object") {
      preferencesObj = preferences;
    } else {
      return NextResponse.json(
        { error: "Invalid preferences format" },
        { status: 400 }
      );
    }

    // Update user preferences
    await db.user.update({
      where: { id: session.userId },
      data: {
        notificationPreferences: preferencesObj,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Preferences updated successfully",
    });
  } catch (error) {
    console.error("Failed to update notification preferences:", error);
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }
}

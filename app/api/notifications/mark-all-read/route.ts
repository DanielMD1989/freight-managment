/**
 * Mark All Notifications as Read - Sprint 16 Story 16.10
 * PUT /api/notifications/mark-all-read
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionAny } from "@/lib/auth";
import { markAllAsRead } from "@/lib/notifications";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";

export async function PUT(request: NextRequest) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await getSessionAny();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    await markAllAsRead(session.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Failed to mark all notifications as read");
  }
}

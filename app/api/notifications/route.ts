/**
 * Notifications API - Sprint 16 Story 16.10
 * GET /api/notifications - Get user notifications with unread count
 */

import { NextRequest, NextResponse } from "next/server";
import { requireActiveUser } from "@/lib/auth";
import { getRecentNotifications, getUnreadCount } from "@/lib/notifications";
import { handleApiError } from "@/lib/apiErrors";

export async function GET(request: NextRequest) {
  try {
    const session = await requireActiveUser();

    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 100) : 20;

    const notifications = await getRecentNotifications(session.userId, limit);
    const unreadCount = await getUnreadCount(session.userId);

    return NextResponse.json({
      notifications,
      unreadCount,
      userRole: session.role,
    });
  } catch (error) {
    return handleApiError(error, "Failed to fetch notifications");
  }
}

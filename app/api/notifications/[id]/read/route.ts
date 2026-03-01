/**
 * Mark Notification as Read - Sprint 16 Story 16.10
 * PUT /api/notifications/[id]/read
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { markAsRead } from "@/lib/notifications";
import { db } from "@/lib/db";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "notifications",
      ip,
      RPS_CONFIGS.notifications.rps,
      RPS_CONFIGS.notifications.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();

    // Await params (Next.js 15+)
    const { id } = await params;

    // Verify notification belongs to user before marking as read
    const notification = await db.notification.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!notification || notification.userId !== session.userId) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 }
      );
    }

    await markAsRead(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleApiError(error, "Failed to mark notification as read");
  }
}

/**
 * Mark Notification as Read - Sprint 16 Story 16.10
 * PUT /api/notifications/[id]/read
 */

import { NextRequest, NextResponse } from "next/server";
import { getSessionAny } from "@/lib/auth";
import { markAsRead } from "@/lib/notifications";
import { db } from "@/lib/db";
import { validateCSRFWithMobile } from "@/lib/csrf";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await getSessionAny();

    if (!session?.userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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
    console.error("Failed to mark notification as read:", error);
    return NextResponse.json(
      { error: "Failed to update notification" },
      { status: 500 }
    );
  }
}

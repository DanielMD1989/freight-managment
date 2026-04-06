export const dynamic = "force-dynamic";
/**
 * Organization Member Management API
 *
 * Phase 2 - Story 16.9B: Company Admin Tools
 * Task 16.9B.1: Company User Management
 *
 * DELETE /api/organizations/members/[id] - Remove member
 * PATCH /api/organizations/members/[id] - Update member role
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, revokeAllSessions } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { CacheInvalidation } from "@/lib/cache";
import { createNotification } from "@/lib/notifications";
import { writeAuditLog, AuditEventType, AuditSeverity } from "@/lib/auditLog";

/**
 * DELETE /api/organizations/members/[id]
 * Remove a member from the organization
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // H24 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const { id: memberId } = await params;

    // Prevent self-removal
    if (memberId === session.userId) {
      return NextResponse.json(
        { error: "You cannot remove yourself from the organization" },
        { status: 400 }
      );
    }

    // Get current user's organization
    const currentUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!currentUser?.organizationId) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Verify member belongs to same organization
    const member = await db.user.findUnique({
      where: { id: memberId },
      select: {
        organizationId: true,
        firstName: true,
        lastName: true,
        email: true,
      },
    });

    if (!member) {
      return NextResponse.json({ error: "Member not found" }, { status: 404 });
    }

    if (member.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: "You can only remove members from your organization" },
        { status: 403 }
      );
    }

    // Remove member by setting organizationId to null
    await db.user.update({
      where: { id: memberId },
      data: { organizationId: null },
    });

    // G13-1 (CRITICAL): Revoke all active sessions for the removed member.
    // Without this, the user keeps a live JWT and continues accessing the
    // org until their session naturally expires. Mirrors the pattern in
    // app/api/admin/users/[id]/revoke/route.ts.
    await revokeAllSessions(memberId);

    // Clear requireActiveUser() cache so the next API call sees the new
    // (org-less) state immediately.
    await CacheInvalidation.user(memberId);

    const memberName =
      [member.firstName, member.lastName].filter(Boolean).join(" ") ||
      member.email;

    // G13-3: Notify the removed user so they understand why they suddenly
    // lost access. Fire-and-forget.
    createNotification({
      userId: memberId,
      type: "USER_STATUS_CHANGED",
      title: "Removed from organization",
      message:
        "You have been removed from your organization. Contact your team admin if this was unexpected.",
      metadata: {
        organizationId: currentUser.organizationId,
        removedById: session.userId,
        removedAt: new Date().toISOString(),
      },
      skipPreferenceCheck: true,
    }).catch((err) =>
      console.error("Member-removal notification failed:", err)
    );

    // G13-2: Audit log so admins can trace who removed whom and when.
    writeAuditLog({
      eventType: AuditEventType.ACCOUNT_UPDATED,
      severity: AuditSeverity.WARNING,
      userId: session.userId,
      resource: "user",
      resourceId: memberId,
      action: "MEMBER_REMOVED",
      result: "SUCCESS",
      message: `User ${session.userId} removed member ${memberId} from organization ${currentUser.organizationId}`,
      metadata: {
        organizationId: currentUser.organizationId,
        memberEmail: member.email,
      },
      timestamp: new Date(),
    }).catch((err) => console.error("Member-removal audit log failed:", err));

    return NextResponse.json({
      message: `${memberName} has been removed from the organization`,
    });
  } catch (error) {
    return handleApiError(error, "Remove member error");
  }
}

/**
 * PATCH /api/organizations/members/[id]
 * Update a member's role (future enhancement)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // H25 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const { id: memberId } = await params;

    // Get current user's organization
    const currentUser = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!currentUser?.organizationId) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Verify member belongs to same organization
    const member = await db.user.findUnique({
      where: { id: memberId },
      select: { organizationId: true },
    });

    if (!member || member.organizationId !== currentUser.organizationId) {
      return NextResponse.json(
        { error: "Member not found in your organization" },
        { status: 404 }
      );
    }

    await request.json();

    // For now, we don't allow role changes within an organization
    // This could be extended to support team roles (admin, member, viewer)
    return NextResponse.json({
      message: "Member role updates are not currently supported",
    });
  } catch (error) {
    return handleApiError(error, "Update member error");
  }
}

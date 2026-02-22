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
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";

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

    const memberName =
      [member.firstName, member.lastName].filter(Boolean).join(" ") ||
      member.email;
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

    const body = await request.json();

    // For now, we don't allow role changes within an organization
    // This could be extended to support team roles (admin, member, viewer)
    return NextResponse.json({
      message: "Member role updates are not currently supported",
    });
  } catch (error) {
    return handleApiError(error, "Update member error");
  }
}

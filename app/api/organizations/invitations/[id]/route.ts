/**
 * Individual Invitation API
 *
 * Phase 2 - Story 16.9B: Company Admin Tools
 *
 * DELETE /api/organizations/invitations/[id] - Cancel invitation
 * GET /api/organizations/invitations/[id] - Get invitation details
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { handleApiError } from "@/lib/apiErrors";

/**
 * GET /api/organizations/invitations/[id]
 * Get invitation details (for accept flow)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const invitation = await db.invitation.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
      },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    // Check if expired
    if (invitation.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "Invitation has expired" },
        { status: 410 }
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: `Invitation is ${invitation.status.toLowerCase()}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      invitation: {
        id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        organization: invitation.organization,
      },
    });
  } catch (error) {
    return handleApiError(error, "Get invitation error");
  }
}

/**
 * DELETE /api/organizations/invitations/[id]
 * Cancel a pending invitation
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id } = await params;

    // Get user's organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: "User not associated with an organization" },
        { status: 400 }
      );
    }

    // Find and verify invitation belongs to user's organization
    const invitation = await db.invitation.findUnique({
      where: { id },
    });

    if (!invitation) {
      return NextResponse.json(
        { error: "Invitation not found" },
        { status: 404 }
      );
    }

    if (invitation.organizationId !== user.organizationId) {
      return NextResponse.json(
        { error: "You can only cancel invitations from your organization" },
        { status: 403 }
      );
    }

    if (invitation.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending invitations can be cancelled" },
        { status: 400 }
      );
    }

    // Cancel the invitation
    await db.invitation.update({
      where: { id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({
      message: "Invitation cancelled successfully",
    });
  } catch (error) {
    return handleApiError(error, "Cancel invitation error");
  }
}

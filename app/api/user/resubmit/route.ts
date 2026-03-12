/**
 * User Registration Resubmit API (G-A1-3)
 *
 * POST /api/user/resubmit
 *
 * Allows a user whose organization was REJECTED to resubmit for admin review.
 * Resets org verificationStatus to PENDING so it re-appears in the admin queue.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireRegistrationAccess } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import {
  createNotificationForRole,
  NotificationType,
} from "@/lib/notifications";

/**
 * POST /api/user/resubmit
 */
export async function POST(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // G-M4-5: Use requireRegistrationAccess — blocks SUSPENDED at guard level
    // (allows REGISTERED, PENDING_VERIFICATION, ACTIVE, REJECTED)
    const session = await requireRegistrationAccess();

    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        status: true,
        organization: {
          select: { id: true, verificationStatus: true },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.organization) {
      return NextResponse.json(
        { error: "No organization associated with your account" },
        { status: 400 }
      );
    }

    if (user.organization.verificationStatus !== "REJECTED") {
      return NextResponse.json(
        { error: "Your organization is not in a rejected state" },
        { status: 400 }
      );
    }

    // Reset org to PENDING so it re-appears in the admin verification queue
    const updatedOrg = await db.organization.update({
      where: { id: user.organization.id },
      data: {
        verificationStatus: "PENDING",
        rejectionReason: null,
        rejectedAt: null,
      },
    });

    createNotificationForRole({
      role: "ADMIN",
      type: NotificationType.REGISTRATION_RESUBMITTED,
      title: "Registration Resubmitted",
      message: `Organization ${user.organization.id} has been resubmitted for review.`,
      metadata: {
        orgId: user.organization.id,
        resubmittedById: session.userId,
      },
    }).catch((err) =>
      console.error("Failed to notify admins of resubmit:", err)
    );

    // G-M6-5: Cascade PENDING_VERIFICATION to ALL org members with REJECTED status
    // Mirrors the cascade pattern in admin/organizations/[id]/reject which sets
    // all org members to REJECTED. Resubmit must reverse this for all members.
    await db.user.updateMany({
      where: {
        organizationId: user.organization.id,
        status: { in: ["REJECTED", "REGISTERED"] },
      },
      data: { status: "PENDING_VERIFICATION" },
    });

    return NextResponse.json({
      message: "Resubmitted for review",
      organization: {
        id: updatedOrg.id,
        verificationStatus: "PENDING",
      },
    });
  } catch (error) {
    if (error instanceof Error) {
      if (
        error.message === "Unauthorized" ||
        error.message === "Unauthorized: User not found"
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.message.startsWith("Forbidden")) {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }
    return handleApiError(error, "Resubmit error");
  }
}

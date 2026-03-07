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
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";

/**
 * POST /api/user/resubmit
 */
export async function POST(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();

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

    if (user.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "Suspended accounts cannot resubmit" },
        { status: 403 }
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

    // Transition REGISTERED user to PENDING_VERIFICATION
    if (user.status === "REGISTERED") {
      await db.user.update({
        where: { id: session.userId },
        data: { status: "PENDING_VERIFICATION" },
      });
    }

    return NextResponse.json({
      message: "Resubmitted for review",
      organization: {
        id: updatedOrg.id,
        verificationStatus: "PENDING",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return handleApiError(error, "Resubmit error");
  }
}

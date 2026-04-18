export const dynamic = "force-dynamic";
/**
 * Driver Revoke-Invite API
 *
 * POST /api/drivers/[id]/revoke-invite
 *
 * Carrier-only. Cancels a pending invitation by:
 *   1. Setting the INVITED user's status to REJECTED
 *   2. Marking the corresponding Invitation row as CANCELLED
 *
 * Use cases:
 *   - Invited the wrong person
 *   - Driver didn't accept in time but hasn't expired yet
 *   - Changed hiring plans
 *
 * Big fleet platforms (Samsara, Lytx, Motive) show a "Cancel Invite"
 * or "Revoke" button alongside every pending invitation.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { id } = await params;

    if (session.role !== "CARRIER") {
      return NextResponse.json(
        { error: "Only carriers can revoke invitations" },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "You must belong to a carrier organization" },
        { status: 400 }
      );
    }

    const driver = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        organizationId: true,
        status: true,
        phone: true,
      },
    });

    if (
      !driver ||
      driver.role !== "DRIVER" ||
      driver.organizationId !== session.organizationId
    ) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    if (driver.status !== "INVITED") {
      return NextResponse.json(
        {
          error: `Cannot revoke invitation for a driver with status ${driver.status}. Only INVITED drivers can be revoked.`,
        },
        { status: 400 }
      );
    }

    await db.$transaction(async (tx) => {
      // Mark the user as REJECTED (soft-delete — preserves audit trail)
      await tx.user.update({
        where: { id },
        data: { status: "REJECTED" },
      });

      // Cancel the corresponding invitation row so the invite code
      // can't be used anymore.
      if (driver.phone) {
        await tx.invitation.updateMany({
          where: {
            phone: driver.phone,
            organizationId: session.organizationId!,
            role: "DRIVER",
            status: "PENDING",
          },
          data: { status: "CANCELLED" },
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: "Invitation revoked",
    });
  } catch (error) {
    return handleApiError(error, "Revoke invite error");
  }
}

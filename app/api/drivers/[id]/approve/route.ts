export const dynamic = "force-dynamic";
/**
 * Driver Approval API — Task 14
 *
 * POST /api/drivers/[id]/approve
 *
 * Carrier-only. Promotes a PENDING_VERIFICATION driver (who came in via
 * accept-invite) to ACTIVE and notifies them.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { createNotification } from "@/lib/notifications";
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
        { error: "Only carriers can approve drivers" },
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
      },
    });

    if (
      !driver ||
      driver.role !== "DRIVER" ||
      driver.organizationId !== session.organizationId
    ) {
      return NextResponse.json({ error: "Driver not found" }, { status: 404 });
    }

    if (driver.status !== "PENDING_VERIFICATION") {
      return NextResponse.json(
        {
          error: `Driver cannot be approved from status ${driver.status}`,
        },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    // Fire-and-forget — suspending on notification failure would abort an
    // otherwise valid approval.
    createNotification({
      userId: id,
      type: "DRIVER_APPROVED",
      title: "Your account has been approved",
      message: "You can now receive trip assignments.",
      metadata: {
        approvedBy: session.userId,
        organizationId: session.organizationId,
      },
    }).catch((err) =>
      console.warn("DRIVER_APPROVED notification failed:", err?.message)
    );

    return NextResponse.json({
      success: true,
      message: "Driver approved",
    });
  } catch (error) {
    return handleApiError(error, "Approve driver error");
  }
}

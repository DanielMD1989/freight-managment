export const dynamic = "force-dynamic";
/**
 * Driver Rejection API — Task 14
 *
 * POST /api/drivers/[id]/reject
 *
 * Carrier-only. Rejects a PENDING_VERIFICATION driver with a required reason,
 * sets status=REJECTED, and notifies the driver with the reason attached.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { createNotification } from "@/lib/notifications";
import { handleApiError } from "@/lib/apiErrors";
import { zodErrorResponse } from "@/lib/validation";

const rejectSchema = z.object({
  reason: z.string().min(1, "Reason is required").max(500),
});

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
        { error: "Only carriers can reject drivers" },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "You must belong to a carrier organization" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = rejectSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }
    const { reason } = parsed.data;

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
          error: `Driver cannot be rejected from status ${driver.status}`,
        },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id },
      data: { status: "REJECTED" },
    });

    createNotification({
      userId: id,
      type: "DRIVER_REJECTED",
      title: "Your account was not approved",
      message: `Your driver account was not approved. Reason: ${reason}`,
      metadata: {
        rejectedBy: session.userId,
        organizationId: session.organizationId,
        reason,
      },
    }).catch((err) =>
      console.warn("DRIVER_REJECTED notification failed:", err?.message)
    );

    return NextResponse.json({
      success: true,
      message: "Driver rejected",
    });
  } catch (error) {
    return handleApiError(error, "Reject driver error");
  }
}

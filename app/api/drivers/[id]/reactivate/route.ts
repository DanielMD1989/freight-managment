export const dynamic = "force-dynamic";
/**
 * Driver Reactivate API
 *
 * POST /api/drivers/[id]/reactivate
 *
 * Carrier-only. Promotes a SUSPENDED driver back to ACTIVE and
 * restores their isAvailable flag. This is the undo path for
 * accidental suspensions — big fleet platforms (Uber Fleet, Samsara,
 * KeepTruckin) all provide this as a first-class action next to
 * the suspend button.
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
        { error: "Only carriers can reactivate drivers" },
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

    if (driver.status !== "SUSPENDED") {
      return NextResponse.json(
        {
          error: `Driver cannot be reactivated from status ${driver.status}. Only SUSPENDED drivers can be reactivated.`,
        },
        { status: 400 }
      );
    }

    await db.user.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    // Restore availability — driver was set to unavailable on suspend.
    try {
      await db.driverProfile.update({
        where: { userId: id },
        data: { isAvailable: true },
      });
    } catch {
      // driverProfile may not exist — safe to ignore
    }

    createNotification({
      userId: id,
      type: "DRIVER_APPROVED",
      title: "Your account has been reactivated",
      message:
        "Your carrier has reactivated your account. You can now receive trip assignments again.",
      metadata: {
        reactivatedBy: session.userId,
        organizationId: session.organizationId,
      },
    }).catch((err) =>
      console.warn("DRIVER_REACTIVATED notification failed:", err?.message)
    );

    return NextResponse.json({
      success: true,
      message: "Driver reactivated",
    });
  } catch (error) {
    return handleApiError(error, "Reactivate driver error");
  }
}

/**
 * Truck Resubmit API
 *
 * G-A2-2: Allows a carrier to resubmit a rejected truck for admin review.
 * Resets approvalStatus from REJECTED → PENDING so the admin can approve again.
 *
 * POST /api/trucks/[id]/resubmit
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

    const { id: truckId } = await params;
    const session = await requireActiveUser();

    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: {
        id: true,
        approvalStatus: true,
        carrierId: true,
        licensePlate: true,
      },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Only the carrier that owns this truck may resubmit
    if (
      session.role !== "CARRIER" ||
      session.organizationId !== truck.carrierId
    ) {
      return NextResponse.json(
        { error: "Forbidden: you do not own this truck" },
        { status: 403 }
      );
    }

    // Only REJECTED trucks can be resubmitted
    if (truck.approvalStatus !== "REJECTED") {
      return NextResponse.json(
        { error: "Truck is not in a rejected state" },
        { status: 400 }
      );
    }

    await db.truck.update({
      where: { id: truckId },
      data: {
        approvalStatus: "PENDING",
        rejectionReason: null,
        rejectedAt: null,
      },
    });

    return NextResponse.json({
      message: "Truck resubmitted for review",
      truck: { id: truckId, approvalStatus: "PENDING" },
    });
  } catch (error) {
    return handleApiError(error, "Error resubmitting truck");
  }
}

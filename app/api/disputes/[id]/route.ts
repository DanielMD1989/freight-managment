/**
 * Dispute Detail API
 * Sprint 6 - Story 6.4: Dispute Management
 *
 * Get and update individual disputes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";

const updateDisputeSchema = z.object({
  status: z.enum(["OPEN", "UNDER_REVIEW", "RESOLVED", "CLOSED"]).optional(),
  resolution: z.string().optional(),
});

// H19 FIX: Valid dispute status transitions
const VALID_DISPUTE_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["UNDER_REVIEW", "CLOSED"],
  UNDER_REVIEW: ["RESOLVED", "CLOSED"],
  RESOLVED: ["CLOSED"],
  CLOSED: [], // terminal state
};

/**
 * GET /api/disputes/[id]
 * Get dispute details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: disputeId } = await params;

    const dispute = await db.dispute.findUnique({
      where: { id: disputeId },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            status: true,
            shipper: { select: { id: true, name: true } },
            assignedTruck: {
              select: {
                id: true,
                licensePlate: true,
                carrier: { select: { id: true, name: true } },
              },
            },
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        disputedOrg: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // Check access
    const isShipper = dispute.load.shipper?.id === session.organizationId;
    const isCarrier =
      dispute.load.assignedTruck?.carrier?.id === session.organizationId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isShipper && !isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: You do not have access to this dispute" },
        { status: 403 }
      );
    }

    return NextResponse.json({ dispute });
    // FIX: Use unknown type with type guard
  } catch (error: unknown) {
    console.error("Error fetching dispute:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json(
      { error: "Failed to fetch dispute" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/disputes/[id]
 * Update dispute status (admin/ops only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_DISPUTES);

    const { id: disputeId } = await params;
    const body = await request.json();
    const validatedData = updateDisputeSchema.parse(body);

    const dispute = await db.dispute.findUnique({
      where: { id: disputeId },
    });

    if (!dispute) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    // H19 FIX: Validate status transition
    if (validatedData.status) {
      const allowed = VALID_DISPUTE_TRANSITIONS[dispute.status] || [];
      if (!allowed.includes(validatedData.status)) {
        return NextResponse.json(
          {
            error: `Cannot transition from ${dispute.status} to ${validatedData.status}`,
            allowedTransitions: allowed,
          },
          { status: 400 }
        );
      }
    }

    // Update dispute
    const updatedDispute = await db.dispute.update({
      where: { id: disputeId },
      data: {
        ...validatedData,
        // Mark resolution time if status is resolved or closed
        ...(validatedData.status === "RESOLVED" ||
        validatedData.status === "CLOSED"
          ? { resolvedAt: new Date() }
          : {}),
      },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        disputedOrg: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({
      message: "Dispute updated successfully",
      dispute: updatedDispute,
    });
    // FIX: Use unknown type with type guards
  } catch (error: unknown) {
    console.error("Error updating dispute:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (
      error instanceof Error &&
      error.message?.includes("Permission denied")
    ) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    return NextResponse.json(
      { error: "Failed to update dispute" },
      { status: 500 }
    );
  }
}

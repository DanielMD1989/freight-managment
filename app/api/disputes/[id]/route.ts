export const dynamic = "force-dynamic";
/**
 * Dispute Detail API
 * Sprint 6 - Story 6.4: Dispute Management
 *
 * Get and update individual disputes
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { handleApiError } from "@/lib/apiErrors";
import {
  notifyOrganization,
  createNotification,
  NotificationType,
} from "@/lib/notifications";

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
    const session = await requireActiveUser();
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

    // Check access — role check prevents DISPATCHER bypass (BUG-R3-3)
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isShipper =
      session.role === "SHIPPER" &&
      dispute.load.shipper?.id === session.organizationId;
    const isCarrier =
      session.role === "CARRIER" &&
      dispute.load.assignedTruck?.carrier?.id === session.organizationId;

    if (!isShipper && !isCarrier && !isAdmin) {
      return NextResponse.json({ error: "Dispute not found" }, { status: 404 });
    }

    return NextResponse.json({ dispute });
  } catch (error: unknown) {
    return handleApiError(error, "Error fetching dispute");
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

    // Notify both parties (creator + disputed org) when status actually
    // changed. Fire-and-forget. The creator gets a personal notification;
    // the disputed org gets an org-wide notification.
    if (validatedData.status && validatedData.status !== dispute.status) {
      const route =
        updatedDispute.load?.pickupCity && updatedDispute.load?.deliveryCity
          ? `${updatedDispute.load.pickupCity} → ${updatedDispute.load.deliveryCity}`
          : "your load";
      const isResolved =
        validatedData.status === "RESOLVED" ||
        validatedData.status === "CLOSED";
      const notifType = isResolved
        ? NotificationType.DISPUTE_RESOLVED
        : NotificationType.DISPUTE_STATUS_CHANGED;
      const title = isResolved
        ? `Dispute ${validatedData.status.toLowerCase()}`
        : `Dispute updated`;
      const baseMessage = isResolved
        ? `Admin marked your dispute about ${route} as ${validatedData.status.toLowerCase()}.`
        : `Admin moved your dispute about ${route} to ${validatedData.status.toLowerCase().replace(/_/g, " ")}.`;

      // Notify the creator (personal)
      createNotification({
        userId: updatedDispute.createdById,
        type: notifType,
        title,
        message: baseMessage,
        metadata: {
          disputeId: updatedDispute.id,
          loadId: updatedDispute.loadId,
          status: validatedData.status,
          resolution: validatedData.resolution || null,
        },
      }).catch((err) =>
        console.warn("Dispute creator notification failed:", err?.message)
      );

      // Notify the disputed org
      notifyOrganization({
        organizationId: updatedDispute.disputedOrgId,
        type: notifType,
        title,
        message: baseMessage,
        metadata: {
          disputeId: updatedDispute.id,
          loadId: updatedDispute.loadId,
          status: validatedData.status,
        },
      }).catch((err) =>
        console.warn("Dispute respondent notification failed:", err?.message)
      );
    }

    return NextResponse.json({
      message: "Dispute updated successfully",
      dispute: updatedDispute,
    });
  } catch (error: unknown) {
    return handleApiError(error, "Error updating dispute");
  }
}

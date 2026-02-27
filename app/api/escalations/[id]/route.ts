/**
 * Sprint 4: Dispatcher Escalation System
 * API endpoints for individual escalation management
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { z } from "zod";
import { createNotification } from "@/lib/notifications";
import { zodErrorResponse } from "@/lib/validation";
import { Prisma } from "@prisma/client";

const updateEscalationSchema = z.object({
  status: z
    .enum([
      "OPEN",
      "ASSIGNED",
      "IN_PROGRESS",
      "RESOLVED",
      "CLOSED",
      "ESCALATED",
    ])
    .optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  notes: z.string().optional(),
  resolution: z.string().optional(),
  assignedTo: z.string().optional(),
});

// GET /api/escalations/[id] - Get escalation details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: escalationId } = await params;

    const escalation = await db.loadEscalation.findUnique({
      where: { id: escalationId },
      include: {
        load: {
          select: {
            id: true,
            status: true,
            pickupCity: true,
            deliveryCity: true,
            shipperId: true,
            assignedTruck: {
              select: {
                carrierId: true,
                licensePlate: true,
              },
            },
            shipper: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });

    if (!escalation) {
      return NextResponse.json(
        { error: "Escalation not found" },
        { status: 404 }
      );
    }

    // H18 FIX: Get user's organizationId for proper ownership check
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    // Permission check - compare organizationId (not userId) with shipperId/carrierId
    const isShipper =
      session.role === "SHIPPER" &&
      escalation.load.shipperId === user?.organizationId;
    const isCarrier =
      session.role === "CARRIER" &&
      escalation.load.assignedTruck?.carrierId === user?.organizationId;
    const isDispatcher = session.role === "DISPATCHER";
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isShipper && !isCarrier && !isDispatcher && !isAdmin) {
      return NextResponse.json(
        { error: "You do not have permission to view this escalation" },
        { status: 403 }
      );
    }

    return NextResponse.json({ escalation });
  } catch (error) {
    console.error("Escalation fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch escalation" },
      { status: 500 }
    );
  }
}

// PATCH /api/escalations/[id] - Update escalation
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // H19 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const { id: escalationId } = await params;

    const body = await request.json();
    const validatedData = updateEscalationSchema.parse(body);

    // Get escalation
    const escalation = await db.loadEscalation.findUnique({
      where: { id: escalationId },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            shipperId: true,
            assignedTruck: {
              select: {
                carrierId: true,
              },
            },
          },
        },
      },
    });

    if (!escalation) {
      return NextResponse.json(
        { error: "Escalation not found" },
        { status: 404 }
      );
    }

    // Permission check: Only dispatchers and admins can update escalations
    const isDispatcher = session.role === "DISPATCHER";
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isDispatcher && !isAdmin) {
      return NextResponse.json(
        { error: "Only dispatchers and admins can update escalations" },
        { status: 403 }
      );
    }

    // Build update data
    const updateData: Prisma.LoadEscalationUpdateInput = {};

    if (validatedData.status !== undefined) {
      updateData.status = validatedData.status;

      // Auto-set resolvedBy and resolvedAt when status is RESOLVED
      if (
        validatedData.status === "RESOLVED" ||
        validatedData.status === "CLOSED"
      ) {
        updateData.resolvedBy = session.userId;
        updateData.resolvedAt = new Date();
      }
    }

    if (validatedData.priority !== undefined) {
      updateData.priority = validatedData.priority;
    }

    if (validatedData.notes !== undefined) {
      updateData.notes = validatedData.notes;
    }

    if (validatedData.resolution !== undefined) {
      updateData.resolution = validatedData.resolution;
    }

    if (validatedData.assignedTo !== undefined) {
      updateData.assignedTo = validatedData.assignedTo;
      updateData.assignedAt = new Date();

      // Change status to ASSIGNED if it was OPEN
      if (escalation.status === "OPEN") {
        updateData.status = "ASSIGNED";
      }
    }

    // Update escalation
    const updatedEscalation = await db.loadEscalation.update({
      where: { id: escalationId },
      data: updateData,
      include: {
        load: {
          select: {
            id: true,
            status: true,
            pickupCity: true,
            deliveryCity: true,
          },
        },
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId: escalation.load.id,
        eventType: "ESCALATION_UPDATED",
        description: `Escalation updated: ${escalation.title}`,
        userId: session.userId,
        metadata: {
          escalationId,
          changes: validatedData,
        },
      },
    });

    // Send notification to assigned dispatcher
    if (validatedData.assignedTo) {
      await createNotification({
        userId: validatedData.assignedTo,
        type: "ESCALATION_ASSIGNED",
        title: `Escalation Assigned: ${escalation.title}`,
        message: `You have been assigned an escalation for load ${escalation.load.pickupCity} → ${escalation.load.deliveryCity}`,
        metadata: {
          escalationId,
          loadId: escalation.load.id,
          priority: updatedEscalation.priority,
        },
      });
    }

    // Send notification to involved parties if resolved
    if (
      validatedData.status === "RESOLVED" ||
      validatedData.status === "CLOSED"
    ) {
      const notifyUsers: string[] = [];

      // Notify shipper
      if (escalation.load.shipperId) {
        const shipperUsers = await db.user.findMany({
          where: { organizationId: escalation.load.shipperId, isActive: true },
          select: { id: true },
        });
        notifyUsers.push(...shipperUsers.map((u) => u.id));
      }

      // Notify carrier if truck was assigned
      if (escalation.load.assignedTruck?.carrierId) {
        const carrierUsers = await db.user.findMany({
          where: {
            organizationId: escalation.load.assignedTruck.carrierId,
            isActive: true,
          },
          select: { id: true },
        });
        notifyUsers.push(...carrierUsers.map((u) => u.id));
      }

      await Promise.all(
        notifyUsers.map((userId) =>
          createNotification({
            userId,
            type: "ESCALATION_RESOLVED",
            title: `Escalation Resolved: ${escalation.title}`,
            message:
              validatedData.resolution || "The escalation has been resolved.",
            metadata: {
              escalationId,
              loadId: escalation.load.id,
            },
          })
        )
      );
    }

    return NextResponse.json({
      message: "Escalation updated successfully",
      escalation: updatedEscalation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    console.error("Escalation update error:", error);
    return NextResponse.json(
      { error: "Failed to update escalation" },
      { status: 500 }
    );
  }
}

// DELETE /api/escalations/[id] - Delete escalation (admin only)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // H20 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();
    const { id: escalationId } = await params;

    // Only admins can delete escalations
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Only admins can delete escalations" },
        { status: 403 }
      );
    }

    const escalation = await db.loadEscalation.findUnique({
      where: { id: escalationId },
      select: { id: true, loadId: true, title: true },
    });

    if (!escalation) {
      return NextResponse.json(
        { error: "Escalation not found" },
        { status: 404 }
      );
    }

    await db.loadEscalation.delete({
      where: { id: escalationId },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId: escalation.loadId,
        eventType: "ESCALATION_DELETED",
        description: `Escalation deleted: ${escalation.title}`,
        userId: session.userId,
      },
    });

    return NextResponse.json({
      message: "Escalation deleted successfully",
    });
  } catch (error) {
    console.error("Escalation delete error:", error);
    return NextResponse.json(
      { error: "Failed to delete escalation" },
      { status: 500 }
    );
  }
}

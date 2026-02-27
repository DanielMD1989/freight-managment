/**
 * Manual Settlement Approval API
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.4: Manual Settlement Approval
 *
 * Allows admins to manually approve and process settlements
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, Permission } from "@/lib/rbac";
import { db } from "@/lib/db";
// M5 FIX: Add CSRF validation
import { validateCSRFWithMobile } from "@/lib/csrf";

/**
 * POST /api/admin/settlements/[id]/approve
 *
 * Manually approve and process a settlement for a delivered load
 *
 * Requirements:
 * - Load must be in DELIVERED status
 * - POD must be verified
 * - Settlement must be PENDING
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // M5 FIX: Add CSRF validation
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    await requirePermission(Permission.MANAGE_SETTLEMENTS);

    const { id: loadId } = await params;

    // Verify load exists and is in correct state
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        podVerified: true,
        settlementStatus: true,
        pickupCity: true,
        deliveryCity: true,
        serviceFeeEtb: true,
        shipper: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTruck: {
          include: {
            carrier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    if (load.status !== "DELIVERED") {
      return NextResponse.json(
        { error: "Load must be in DELIVERED status to settle" },
        { status: 400 }
      );
    }

    if (!load.podVerified) {
      return NextResponse.json(
        { error: "POD must be verified before settlement" },
        { status: 400 }
      );
    }

    if (load.settlementStatus === "PAID") {
      return NextResponse.json(
        { error: "Settlement has already been processed" },
        { status: 400 }
      );
    }

    // Mark settlement as complete
    // Service fees are handled separately by serviceFeeManagement.ts
    await db.load.update({
      where: { id: loadId },
      data: {
        settlementStatus: "PAID",
        settledAt: new Date(),
      },
    });

    // Fetch updated load data
    const updatedLoad = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        settlementStatus: true,
        settledAt: true,
        serviceFeeEtb: true,
      },
    });

    // Create audit log entry
    await db.loadEvent.create({
      data: {
        loadId,
        eventType: "SETTLEMENT_APPROVED",
        description: "Settlement manually approved by administrator",
      },
    });

    return NextResponse.json({
      success: true,
      message: "Settlement approved and processed successfully",
      settlement: {
        loadId: updatedLoad?.id,
        status: updatedLoad?.settlementStatus,
        settledAt: updatedLoad?.settledAt,
        serviceFee: Number(updatedLoad?.serviceFeeEtb || 0),
      },
    });
  } catch (error) {
    console.error("Settlement approval error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    // Handle specific settlement errors
    if (error instanceof Error) {
      if (error.message.includes("Insufficient balance")) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes("Wallet not found")) {
        return NextResponse.json(
          { error: "Financial account not configured for organization" },
          { status: 400 }
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to process settlement. Please try again." },
      { status: 500 }
    );
  }
}

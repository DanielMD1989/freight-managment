/**
 * Load Settlement API
 *
 * Processes settlement after POD verification using corridor-based service fees.
 *
 * SECURITY: Uses atomic update pattern to prevent double-settlement race conditions
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { requireCSRF } from "@/lib/csrf";

/**
 * POST /api/loads/[id]/settle
 *
 * Trigger settlement for a load
 *
 * Requirements:
 * - Load status must be DELIVERED
 * - POD must be verified
 * - Settlement not already processed
 *
 * Security:
 * - CSRF protection
 * - Atomic update pattern to prevent double-settlement
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loadId } = await params;
    const session = await requireAuth();

    // CSRF protection for state-changing operation
    const csrfError = await requireCSRF(request);
    if (csrfError) {
      return csrfError;
    }

    // Only admins can trigger settlement
    // In production, this might be automated after POD verification
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Unauthorized - Admin access required" },
        { status: 403 }
      );
    }

    // Get load details
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        podSubmitted: true,
        podVerified: true,
        settlementStatus: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Validate settlement requirements
    const errors: string[] = [];

    if (load.status !== "DELIVERED" && load.status !== "COMPLETED") {
      errors.push("Load must be DELIVERED or COMPLETED");
    }

    if (!load.podSubmitted) {
      errors.push("POD must be submitted");
    }

    if (!load.podVerified) {
      errors.push("POD must be verified");
    }

    if (load.settlementStatus === "PAID") {
      errors.push("Settlement already processed");
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Settlement requirements not met", details: errors },
        { status: 400 }
      );
    }

    // HIGH FIX #9: Use transaction with fresh re-fetch for atomic lock acquisition
    // This prevents race conditions where two requests could both succeed in updateMany
    let lockAcquired = false;
    try {
      await db.$transaction(async (tx) => {
        // Fresh re-fetch inside transaction to get current state
        const freshLoad = await tx.load.findUnique({
          where: { id: loadId },
          select: { settlementStatus: true, status: true, podVerified: true },
        });

        if (!freshLoad) {
          throw new Error("LOAD_NOT_FOUND");
        }

        // Check if already processing or completed
        if (freshLoad.settlementStatus === "IN_PROGRESS") {
          throw new Error("SETTLEMENT_IN_PROGRESS");
        }
        if (freshLoad.settlementStatus === "PAID") {
          throw new Error("SETTLEMENT_COMPLETED");
        }
        if (
          (freshLoad.status !== "DELIVERED" &&
            freshLoad.status !== "COMPLETED") ||
          !freshLoad.podVerified
        ) {
          throw new Error("SETTLEMENT_REQUIREMENTS_NOT_MET");
        }

        // Atomically acquire lock
        await tx.load.update({
          where: { id: loadId },
          data: { settlementStatus: "IN_PROGRESS" },
        });

        lockAcquired = true;
      });
      // FIX: Use unknown type with type guard
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : "";
      if (errorMessage === "LOAD_NOT_FOUND") {
        return NextResponse.json({ error: "Load not found" }, { status: 404 });
      }
      if (errorMessage === "SETTLEMENT_IN_PROGRESS") {
        return NextResponse.json(
          {
            error: "Settlement already in progress",
            code: "IDEMPOTENCY_CONFLICT",
          },
          { status: 409 }
        );
      }
      if (errorMessage === "SETTLEMENT_COMPLETED") {
        return NextResponse.json(
          {
            error: "Settlement already completed",
            code: "IDEMPOTENCY_CONFLICT",
          },
          { status: 409 }
        );
      }
      if (errorMessage === "SETTLEMENT_REQUIREMENTS_NOT_MET") {
        return NextResponse.json(
          {
            error: "Settlement requirements not met",
            code: "REQUIREMENTS_NOT_MET",
          },
          { status: 400 }
        );
      }
      throw error;
    }

    if (!lockAcquired) {
      return NextResponse.json(
        { error: "Failed to acquire settlement lock", code: "LOCK_FAILED" },
        { status: 409 }
      );
    }

    // Process settlement - mark as settled and service fees are handled separately
    try {
      await db.load.update({
        where: { id: loadId },
        data: {
          settlementStatus: "PAID",
          settledAt: new Date(),
        },
      });

      // Create load event
      await db.loadEvent.create({
        data: {
          loadId,
          eventType: "SETTLEMENT_COMPLETED",
          description: "Settlement processed successfully",
          userId: session.userId,
        },
      });

      // Get updated load
      const updatedLoad = await db.load.findUnique({
        where: { id: loadId },
        select: {
          id: true,
          settlementStatus: true,
          settledAt: true,
        },
      });

      return NextResponse.json({
        message: "Settlement processed successfully",
        settlement: {
          loadId: updatedLoad?.id,
          status: updatedLoad?.settlementStatus,
          settledAt: updatedLoad?.settledAt,
        },
      });
      // FIX: Use unknown type with type guard
    } catch (settlementError: unknown) {
      console.error("Settlement processing error:", settlementError);

      // IDEMPOTENCY: Reset status on failure so it can be retried
      await db.load.update({
        where: { id: loadId },
        data: { settlementStatus: "PENDING" },
      });

      return NextResponse.json(
        {
          error: "Settlement failed",
          details:
            settlementError instanceof Error
              ? settlementError.message
              : "Unknown error",
          retryable: true, // Client can retry since we reset status
        },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error("Settlement API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/loads/[id]/settle
 *
 * Get settlement status and details
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loadId } = await params;
    const session = await requireAuth();

    // Get load with settlement details
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        status: true,
        podSubmitted: true,
        podSubmittedAt: true,
        podVerified: true,
        podVerifiedAt: true,
        podUrl: true,
        settlementStatus: true,
        settledAt: true,
        shipperId: true,
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check if user has permission to view settlement details
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isShipper = user?.organizationId === load.shipperId;
    const isCarrier = user?.organizationId === load.assignedTruck?.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isShipper && !isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: "Unauthorized to view settlement details" },
        { status: 403 }
      );
    }

    // Calculate settlement readiness
    const canSettle =
      load.status === "DELIVERED" &&
      load.podSubmitted &&
      load.podVerified &&
      load.settlementStatus !== "PAID";

    return NextResponse.json({
      loadId: load.id,
      status: load.status,
      pod: {
        submitted: load.podSubmitted,
        submittedAt: load.podSubmittedAt,
        verified: load.podVerified,
        verifiedAt: load.podVerifiedAt,
        url: load.podUrl,
      },
      settlement: {
        status: load.settlementStatus,
        settledAt: load.settledAt,
        canSettle,
      },
    });
  } catch (error) {
    console.error("Get settlement status error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

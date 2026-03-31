export const dynamic = "force-dynamic";
/**
 * Truck Request Cancel API
 *
 * POST /api/truck-requests/[id]/cancel
 *
 * Allows shipper to cancel their pending truck request.
 * Mobile app uses POST for cancel action.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";
import { Prisma } from "@prisma/client";
import { z } from "zod";

// Validation schema for cancel request
const CancelRequestSchema = z.object({
  cancellationReason: z.string().max(500).optional(),
});

/**
 * POST /api/truck-requests/[id]/cancel
 *
 * Cancel a pending truck request.
 * Only the shipper who created the request can cancel it.
 * Request must still be PENDING.
 *
 * Request body (optional):
 * - cancellationReason: string (max 500 chars)
 *
 * Returns: Updated request with status CANCELLED
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: requestId } = await params;
    // Fix 39: requireActiveUser for ACTIVE status check
    const session = await requireActiveUser();

    // Get the request
    const truckRequest = await db.truckRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        requestedById: true,
        loadId: true,
        truckId: true,
      },
    });

    if (!truckRequest) {
      return NextResponse.json(
        { error: "Truck request not found" },
        { status: 404 }
      );
    }

    // Parse optional cancellation reason
    let cancellationReason: string | undefined;
    try {
      const body = await request.json();
      const validationResult = CancelRequestSchema.safeParse(body);
      if (validationResult.success) {
        cancellationReason = validationResult.data.cancellationReason;
      }
    } catch {
      // Body parsing failed, continue without reason
    }

    // Only the shipper who created the request can cancel it
    const isShipper = truckRequest.shipperId === session.organizationId;
    const isRequester = truckRequest.requestedById === session.userId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";

    if (!isShipper && !isRequester && !isAdmin) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Check if request is still pending - handle idempotency
    if (truckRequest.status === "CANCELLED") {
      // Idempotent: Already cancelled, return success
      const existingRequest = await db.truckRequest.findUnique({
        where: { id: requestId },
        include: {
          load: {
            select: {
              id: true,
              pickupCity: true,
              deliveryCity: true,
            },
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
            },
          },
        },
      });

      return NextResponse.json({
        request: existingRequest,
        message: "Request was already cancelled",
        idempotent: true,
      });
    }

    // Can only cancel PENDING requests
    if (truckRequest.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Cannot cancel a ${truckRequest.status.toLowerCase()} request`,
          currentStatus: truckRequest.status,
        },
        { status: 400 }
      );
    }

    // Fix 38: Atomic update with status guard to prevent race condition
    // If two requests arrive simultaneously, only one can succeed; the other gets 409
    let updatedRequest;
    try {
      updatedRequest = await db.truckRequest.update({
        where: { id: requestId, status: "PENDING" },
        data: {
          status: "CANCELLED",
        },
        include: {
          load: {
            select: {
              id: true,
              pickupCity: true,
              deliveryCity: true,
            },
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
            },
          },
        },
      });
    } catch (updateError) {
      if (
        updateError instanceof Prisma.PrismaClientKnownRequestError &&
        updateError.code === "P2025"
      ) {
        return NextResponse.json(
          {
            error:
              "Request was modified concurrently. Please refresh and try again.",
          },
          { status: 409 }
        );
      }
      throw updateError;
    }

    // M3 FIX: Cache invalidation after truck request cancellation
    await CacheInvalidation.load(truckRequest.loadId);

    // Create load event for cancellation
    await db.loadEvent.create({
      data: {
        loadId: truckRequest.loadId,
        eventType: "REQUEST_CANCELLED",
        description: `Truck request cancelled by shipper${cancellationReason ? `: ${cancellationReason}` : ""}`,
        userId: session.userId,
        metadata: {
          requestId: requestId,
          cancellationReason,
        },
      },
    });

    return NextResponse.json({
      request: updatedRequest,
      message: "Truck request cancelled successfully",
    });
  } catch (error) {
    return handleApiError(error, "Error cancelling truck request");
  }
}

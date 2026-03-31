export const dynamic = "force-dynamic";
/**
 * Truck Request Individual API
 *
 * GET: Get a specific truck request
 * DELETE: Cancel a truck request (requester only, while PENDING)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";
import { Prisma } from "@prisma/client";
import { CacheInvalidation } from "@/lib/cache";

/**
 * GET /api/truck-requests/[id]
 *
 * Get a specific truck request by ID.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await requireActiveUser();

    const truckRequest = await db.truckRequest.findUnique({
      where: { id },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            pickupDate: true,
            truckType: true,
            status: true,
          },
        },
        truck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
            carrierId: true,
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
          },
        },
        carrier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!truckRequest) {
      return NextResponse.json(
        { error: "Truck request not found" },
        { status: 404 }
      );
    }

    // Check if user has access (shipper who created, carrier who received,
    // admin override, or dispatcher — who has full platform visibility per blueprint §5)
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isDispatcher = session.role === "DISPATCHER"; // G-A8-5: Dispatcher full visibility
    const isShipper =
      session.role === "SHIPPER" &&
      truckRequest.shipperId === session.organizationId;
    const isCarrier =
      session.role === "CARRIER" &&
      truckRequest.carrierId === session.organizationId;

    if (!isShipper && !isCarrier && !isAdmin && !isDispatcher) {
      return NextResponse.json(
        { error: "Truck request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ request: truckRequest });
  } catch (error) {
    return handleApiError(error, "Error fetching truck request");
  }
}

/**
 * DELETE /api/truck-requests/[id]
 *
 * Cancel a truck request.
 * Only the shipper who created the request can cancel it.
 * Request must still be PENDING.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();

    // Get the request
    const truckRequest = await db.truckRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        shipperId: true,
        requestedById: true,
        loadId: true, // G-A8-4: needed for cache invalidation and LoadEvent
      },
    });

    if (!truckRequest) {
      return NextResponse.json(
        { error: "Truck request not found" },
        { status: 404 }
      );
    }

    // Only the shipper who created the request can cancel it
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isShipper =
      session.role === "SHIPPER" &&
      truckRequest.shipperId === session.organizationId;
    const isRequester = truckRequest.requestedById === session.userId;

    if (!isShipper && !isRequester && !isAdmin) {
      return NextResponse.json(
        { error: "Truck request not found" },
        { status: 404 }
      );
    }

    // Can only cancel PENDING requests
    if (truckRequest.status !== "PENDING") {
      return NextResponse.json(
        {
          error: `Cannot cancel a ${truckRequest.status.toLowerCase()} request`,
        },
        { status: 400 }
      );
    }

    // Update status to CANCELLED — include status guard to prevent race condition
    // If concurrent approve changes status from PENDING, P2025 will fire
    let updatedRequest;
    try {
      updatedRequest = await db.truckRequest.update({
        where: { id, status: "PENDING" },
        data: {
          status: "CANCELLED",
        },
      });
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return NextResponse.json(
          {
            error: "Request status was modified concurrently. Please refresh.",
          },
          { status: 409 }
        );
      }
      throw err;
    }

    // G-A8-4: Cache invalidation — parity with POST /cancel route
    await CacheInvalidation.load(truckRequest.loadId);

    // G-A8-4: Audit trail — parity with POST /cancel route
    await db.loadEvent.create({
      data: {
        loadId: truckRequest.loadId,
        eventType: "REQUEST_CANCELLED",
        description: "Truck request cancelled by shipper",
        userId: session.userId,
        metadata: { requestId: id },
      },
    });

    return NextResponse.json({
      success: true,
      message: "Truck request cancelled successfully",
      request: updatedRequest,
    });
  } catch (error) {
    return handleApiError(error, "Error cancelling truck request");
  }
}

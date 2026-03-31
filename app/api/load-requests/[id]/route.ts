export const dynamic = "force-dynamic";
/**
 * Load Request Detail API
 *
 * G-A9-6: GET /api/load-requests/[id]  — retrieve individual request
 * G-A9-7: DELETE /api/load-requests/[id] — carrier withdraws pending/approved request
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { CacheInvalidation } from "@/lib/cache";
import { handleApiError } from "@/lib/apiErrors";

/**
 * GET /api/load-requests/[id]
 *
 * Returns full load request detail including carrier, shipper, truck, and confirmedBy.
 * Unauthorized parties receive 404 (no information leakage).
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await params;
    const session = await requireActiveUser();

    const loadRequest = await db.loadRequest.findUnique({
      where: { id: requestId },
      include: {
        load: {
          select: {
            id: true,
            pickupCity: true,
            deliveryCity: true,
            pickupDate: true,
            truckType: true,
            status: true,
            shipperId: true,
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
        carrier: {
          select: { id: true, name: true },
        },
        shipper: {
          select: { id: true, name: true },
        },
        requestedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        respondedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
        confirmedBy: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });

    if (!loadRequest) {
      return NextResponse.json(
        { error: "Load request not found" },
        { status: 404 }
      );
    }

    // Access control — 404 on unauthorized (no info leakage)
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isDispatcher = session.role === "DISPATCHER";
    const isCarrier =
      session.role === "CARRIER" &&
      session.organizationId === loadRequest.carrierId;
    const isShipper =
      session.role === "SHIPPER" &&
      session.organizationId === loadRequest.load.shipperId;

    if (!isAdmin && !isDispatcher && !isCarrier && !isShipper) {
      return NextResponse.json(
        { error: "Load request not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(loadRequest);
  } catch (error) {
    return handleApiError(error, "Error fetching load request");
  }
}

/**
 * DELETE /api/load-requests/[id]
 *
 * Carrier withdraws a PENDING or SHIPPER_APPROVED load request.
 * G-A9-3: Reverts load SEARCHING → POSTED if no other active requests remain.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: requestId } = await params;
    const session = await requireActiveUser();

    const loadRequest = await db.loadRequest.findUnique({
      where: { id: requestId },
      include: {
        load: {
          select: {
            id: true,
            shipperId: true,
            status: true,
          },
        },
        truck: {
          select: { carrierId: true },
        },
      },
    });

    if (!loadRequest) {
      return NextResponse.json(
        { error: "Load request not found" },
        { status: 404 }
      );
    }

    // Only CARRIER who made the request (or ADMIN) can cancel
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isCarrierOwner =
      session.role === "CARRIER" &&
      session.organizationId === loadRequest.carrierId;

    if (!isCarrierOwner && !isAdmin) {
      return NextResponse.json(
        { error: "Load request not found" },
        { status: 404 }
      );
    }

    // Only PENDING or SHIPPER_APPROVED can be cancelled
    if (!["PENDING", "SHIPPER_APPROVED"].includes(loadRequest.status)) {
      return NextResponse.json(
        {
          error: `Cannot cancel a request with status: ${loadRequest.status}`,
          currentStatus: loadRequest.status,
        },
        { status: 400 }
      );
    }

    // Atomic update with status guard (P2025 → 409 if concurrent confirm races)
    let updatedRequest: { id: string; status: string; loadId: string };
    try {
      updatedRequest = await db.loadRequest.update({
        where: {
          id: requestId,
          status: { in: ["PENDING", "SHIPPER_APPROVED"] },
        },
        data: { status: "CANCELLED" },
      });
    } catch (err: unknown) {
      const prismaErr = err as { code?: string };
      if (prismaErr?.code === "P2025") {
        return NextResponse.json(
          { error: "Request was already processed by another action" },
          { status: 409 }
        );
      }
      throw err;
    }

    await db.loadEvent.create({
      data: {
        loadId: loadRequest.loadId,
        eventType: "REQUEST_CANCELLED",
        description: `Carrier withdrew load request`,
        userId: session.userId,
        metadata: {
          loadRequestId: requestId,
          carrierId: loadRequest.carrierId,
        },
      },
    });

    // G-A9-3: Revert load SEARCHING → POSTED if no other active requests remain
    const remaining = await db.loadRequest.count({
      where: {
        loadId: loadRequest.loadId,
        status: { in: ["PENDING", "SHIPPER_APPROVED"] },
        id: { not: requestId },
      },
    });
    if (remaining === 0) {
      await db.load.update({
        where: {
          id: loadRequest.loadId,
          status: { in: ["SEARCHING", "OFFERED"] },
        },
        data: { status: "POSTED" },
      });
    }

    await CacheInvalidation.load(loadRequest.loadId);

    return NextResponse.json({
      success: true,
      message: "Load request cancelled",
      request: updatedRequest,
    });
  } catch (error) {
    return handleApiError(error, "Error cancelling load request");
  }
}

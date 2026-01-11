/**
 * Truck Request Individual API
 *
 * GET: Get a specific truck request
 * DELETE: Cancel a truck request (requester only, while PENDING)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

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
    const session = await requireAuth();

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
        { error: 'Truck request not found' },
        { status: 404 }
      );
    }

    // Check if user has access (shipper who created or carrier who received)
    const isShipper = truckRequest.shipperId === session.organizationId;
    const isCarrier = truckRequest.carrierId === session.organizationId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isShipper && !isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: 'Not authorized to view this request' },
        { status: 403 }
      );
    }

    return NextResponse.json({ request: truckRequest });
  } catch (error) {
    console.error('Error fetching truck request:', error);
    return NextResponse.json(
      { error: 'Failed to fetch truck request' },
      { status: 500 }
    );
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
    const session = await requireAuth();

    // Get the request
    const truckRequest = await db.truckRequest.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        shipperId: true,
        requestedById: true,
      },
    });

    if (!truckRequest) {
      return NextResponse.json(
        { error: 'Truck request not found' },
        { status: 404 }
      );
    }

    // Only the shipper who created the request can cancel it
    const isShipper = truckRequest.shipperId === session.organizationId;
    const isRequester = truckRequest.requestedById === session.userId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'SUPER_ADMIN';

    if (!isShipper && !isRequester && !isAdmin) {
      return NextResponse.json(
        { error: 'Only the shipper who created this request can cancel it' },
        { status: 403 }
      );
    }

    // Can only cancel PENDING requests
    if (truckRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Cannot cancel a ${truckRequest.status.toLowerCase()} request` },
        { status: 400 }
      );
    }

    // Update status to CANCELLED
    const updatedRequest = await db.truckRequest.update({
      where: { id },
      data: {
        status: 'CANCELLED',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Truck request cancelled successfully',
      request: updatedRequest,
    });
  } catch (error) {
    console.error('Error cancelling truck request:', error);
    return NextResponse.json(
      { error: 'Failed to cancel truck request' },
      { status: 500 }
    );
  }
}

export const dynamic = "force-dynamic";
/**
 * Mark Message as Read — §13 In-App Messaging
 *
 * PUT /api/trips/[tripId]/messages/[messageId]/read
 *
 * Sets readAt on a message. Only the recipient (not the sender) can mark as read.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { handleApiError } from "@/lib/apiErrors";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string; messageId: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { tripId, messageId } = await params;

    // Fetch trip for access control
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: { shipperId: true, carrierId: true, driverId: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Only shipper, carrier, and the assigned driver can mark messages as read
    const isShipper = session.organizationId === trip.shipperId;
    const isCarrier = session.organizationId === trip.carrierId;
    // Task 8: assigned driver can mark their trip's messages as read
    const isDriver =
      session.role === "DRIVER" && trip.driverId === session.userId;

    if (!isShipper && !isCarrier && !isDriver) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Dispatcher explicitly blocked
    if (session.role === "DISPATCHER") {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Fetch the message
    const message = await db.message.findUnique({
      where: { id: messageId },
    });

    if (!message || message.tripId !== tripId) {
      return NextResponse.json({ error: "Message not found" }, { status: 404 });
    }

    // Only the recipient can mark as read (not the sender)
    if (message.senderId === session.userId) {
      return NextResponse.json(
        { error: "Cannot mark your own message as read" },
        { status: 400 }
      );
    }

    // Already read — idempotent
    if (message.readAt) {
      return NextResponse.json({ message });
    }

    const updated = await db.message.update({
      where: { id: messageId },
      data: { readAt: new Date() },
    });

    return NextResponse.json({ message: updated });
  } catch (error) {
    return handleApiError(
      error,
      "PUT /api/trips/[tripId]/messages/[messageId]/read"
    );
  }
}

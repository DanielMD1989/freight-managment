export const dynamic = "force-dynamic";
/**
 * Unread Message Count — §13 In-App Messaging
 *
 * GET /api/trips/[tripId]/messages/unread-count
 *
 * Returns the count of unread messages for the current user in this trip.
 * Used for notification badges on trip cards and chat icons.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { handleApiError } from "@/lib/apiErrors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await requireActiveUser();
    const { tripId } = await params;

    // Fetch trip for access control
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: { shipperId: true, carrierId: true, driverId: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Only shipper, carrier, and the assigned driver can see unread counts
    const isShipper = session.organizationId === trip.shipperId;
    const isCarrier = session.organizationId === trip.carrierId;
    // Task 8: assigned driver can see unread count for their trip's chat
    const isDriver =
      session.role === "DRIVER" && trip.driverId === session.userId;

    if (!isShipper && !isCarrier && !isDriver) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Dispatcher explicitly blocked
    if (session.role === "DISPATCHER") {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Count messages in this trip NOT sent by the current user AND not yet read
    const unreadCount = await db.message.count({
      where: {
        tripId,
        senderId: { not: session.userId },
        readAt: null,
      },
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    return handleApiError(
      error,
      "GET /api/trips/[tripId]/messages/unread-count"
    );
  }
}

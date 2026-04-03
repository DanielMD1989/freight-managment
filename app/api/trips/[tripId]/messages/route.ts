export const dynamic = "force-dynamic";
/**
 * Trip Messages API — §13 In-App Messaging
 *
 * POST: Send a message in the trip conversation
 * GET:  List messages for this trip (paginated, newest at bottom)
 *
 * Access: Shipper (trip owner) + Carrier (assigned) can read/write.
 *         Admin/SuperAdmin can read-only (dispute resolution).
 *         Dispatcher has NO access.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { createNotification, NotificationType } from "@/lib/notifications";
import { handleApiError } from "@/lib/apiErrors";

// §13: Text 1-2000 chars required, optional attachment URL
const sendMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message cannot be empty")
    .max(2000, "Message cannot exceed 2000 characters"),
  attachmentUrl: z.string().url().optional(),
});

// Chat is active during these trip statuses (ASSIGNED through DELIVERED)
const CHAT_ACTIVE_STATUSES = [
  "ASSIGNED",
  "PICKUP_PENDING",
  "IN_TRANSIT",
  "DELIVERED",
];
// Chat is read-only during these (history viewable but no new messages)
const CHAT_READONLY_STATUSES = ["COMPLETED", "CANCELLED"];
// All statuses where chat is visible
const CHAT_VISIBLE_STATUSES = [
  ...CHAT_ACTIVE_STATUSES,
  ...CHAT_READONLY_STATUSES,
];

/**
 * POST /api/trips/[tripId]/messages — Send a message
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { tripId } = await params;

    const body = await request.json();
    const parsed = sendMessageSchema.safeParse(body);
    if (!parsed.success) {
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(parsed.error);
    }
    const { content, attachmentUrl } = parsed.data;

    // Fetch trip with org references
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        carrierId: true,
        shipper: { select: { name: true } },
        carrier: { select: { name: true } },
        load: { select: { pickupCity: true, deliveryCity: true } },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Dispatcher has NO message access (§13)
    if (session.role === "DISPATCHER") {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Admin/SuperAdmin can view but cannot send (read-only for dispute resolution)
    if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Admins can view messages but cannot send them" },
        { status: 403 }
      );
    }

    // Only shipper and carrier of THIS trip can send messages
    let senderRole: string;
    let recipientOrgId: string;

    if (session.organizationId === trip.shipperId) {
      senderRole = "SHIPPER";
      recipientOrgId = trip.carrierId;
    } else if (session.organizationId === trip.carrierId) {
      senderRole = "CARRIER";
      recipientOrgId = trip.shipperId;
    } else {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Chat must be active (ASSIGNED through DELIVERED)
    if (!CHAT_ACTIVE_STATUSES.includes(trip.status)) {
      if (CHAT_READONLY_STATUSES.includes(trip.status)) {
        return NextResponse.json(
          { error: "This conversation is now read-only" },
          { status: 403 }
        );
      }
      return NextResponse.json(
        { error: "Chat is not available for this trip status" },
        { status: 400 }
      );
    }

    // Create message
    const message = await db.message.create({
      data: {
        content,
        attachmentUrl: attachmentUrl || null,
        senderId: session.userId,
        senderRole,
        tripId,
      },
      include: {
        sender: { select: { firstName: true, lastName: true } },
      },
    });

    // Fire-and-forget: notify the other party
    const senderName = session.firstName
      ? `${session.firstName} ${session.lastName || ""}`.trim()
      : senderRole === "SHIPPER"
        ? trip.shipper?.name || "Shipper"
        : trip.carrier?.name || "Carrier";

    const route =
      trip.load?.pickupCity && trip.load?.deliveryCity
        ? `${trip.load.pickupCity} → ${trip.load.deliveryCity}`
        : "your trip";

    // Notify all users in the recipient organization
    const recipientUsers = await db.user.findMany({
      where: { organizationId: recipientOrgId, isActive: true },
      select: { id: true },
    });

    for (const user of recipientUsers) {
      createNotification({
        userId: user.id,
        type: NotificationType.NEW_MESSAGE,
        title: `New message from ${senderName}`,
        message:
          content.length > 100 ? content.substring(0, 97) + "..." : content,
        metadata: { tripId, messageId: message.id, senderRole, route },
      }).catch(() => {});
    }

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/trips/[tripId]/messages");
  }
}

/**
 * GET /api/trips/[tripId]/messages — List messages
 *
 * Query params:
 *   ?limit=50 (default 50, max 100)
 *   ?before=<messageId> (cursor-based pagination for loading older messages)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await requireActiveUser();
    const { tripId } = await params;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "50", 10) || 50,
      100
    );
    const before = searchParams.get("before") || undefined;

    // Fetch trip
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        carrierId: true,
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Access control: shipper, carrier, admin (read-only). Dispatcher blocked.
    const isShipper = session.organizationId === trip.shipperId;
    const isCarrier = session.organizationId === trip.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isDispatcher = session.role === "DISPATCHER";

    if (isDispatcher) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    if (!isShipper && !isCarrier && !isAdmin) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Chat must be in a visible status
    if (!CHAT_VISIBLE_STATUSES.includes(trip.status)) {
      return NextResponse.json(
        { error: "Chat is not available for this trip status" },
        { status: 400 }
      );
    }

    // Build query
    const where: Record<string, unknown> = { tripId };
    if (before) {
      // Cursor-based: get messages created before the cursor message
      const cursorMsg = await db.message.findUnique({
        where: { id: before },
        select: { createdAt: true },
      });
      if (cursorMsg) {
        where.createdAt = { lt: cursorMsg.createdAt };
      }
    }

    const messages = await db.message.findMany({
      where,
      include: {
        sender: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "asc" },
      take: limit,
    });

    // Determine if chat is read-only
    const readOnly = CHAT_READONLY_STATUSES.includes(trip.status);

    return NextResponse.json({
      messages,
      readOnly,
      tripStatus: trip.status,
    });
  } catch (error) {
    return handleApiError(error, "GET /api/trips/[tripId]/messages");
  }
}

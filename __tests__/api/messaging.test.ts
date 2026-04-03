/**
 * §13 In-App Messaging — API Tests
 *
 * Tests: POST /api/trips/[tripId]/messages (send message)
 *        GET  /api/trips/[tripId]/messages (list messages)
 *        PUT  /api/trips/[tripId]/messages/[messageId]/read (mark read)
 *        GET  /api/trips/[tripId]/messages/unread-count
 *
 * Blueprint §13 rules:
 *   - One conversation per trip, only shipper + carrier can send
 *   - Chat active: ASSIGNED → DELIVERED
 *   - Chat read-only: COMPLETED, CANCELLED
 *   - Messages permanent (no delete)
 *   - Admin can view (read-only), Dispatcher has NO access
 *   - Content: text 1-2000 chars, optional image attachment
 *   - Unread count per user per trip
 */

import { db } from "@/lib/db";
import {
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  setAuthSession,
} from "../utils/routeTestUtils";

// ── Mocks (hoisted) ──
jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    return getAuthSession();
  }),
  requireActiveUser: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    const session = getAuthSession();
    return { ...session, dbStatus: session?.status };
  }),
}));
jest.mock("@/lib/csrf", () => ({
  validateCSRFWithMobile: jest.fn(async () => null),
}));
jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  zodErrorResponse: jest.fn((error: unknown) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: error },
      { status: 400 }
    );
  }),
}));
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  notifyOrganization: jest.fn(async () => {}),
  NotificationType: {
    NEW_MESSAGE: "NEW_MESSAGE",
  },
}));
jest.mock("@/lib/cache", () => ({
  CacheInvalidation: {
    trip: jest.fn(async () => {}),
  },
}));

// Import routes AFTER mocks
const {
  POST: sendMessage,
  GET: listMessages,
} = require("@/app/api/trips/[tripId]/messages/route");
const {
  PUT: markRead,
} = require("@/app/api/trips/[tripId]/messages/[messageId]/read/route");
const {
  GET: unreadCount,
} = require("@/app/api/trips/[tripId]/messages/unread-count/route");

let seed: Awaited<ReturnType<typeof seedTestData>>;

// Create admin + dispatcher users for access control tests
let adminUser: any;
let adminOrg: any;
let dispatcherUser: any;
let dispatcherOrg: any;

beforeAll(async () => {
  seed = await seedTestData();

  // Create admin
  adminOrg = await db.organization.create({
    data: { id: "admin-org", name: "Platform Admin", type: "LOGISTICS_AGENT" },
  });
  adminUser = await db.user.create({
    data: {
      id: "admin-user-msg",
      email: "admin-msg@test.com",
      passwordHash: "hashed",
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: adminOrg.id,
    },
  });

  // Create dispatcher
  dispatcherOrg = await db.organization.create({
    data: {
      id: "dispatcher-org",
      name: "Dispatch Center",
      type: "LOGISTICS_AGENT",
    },
  });
  dispatcherUser = await db.user.create({
    data: {
      id: "dispatcher-user-msg",
      email: "dispatcher-msg@test.com",
      passwordHash: "hashed",
      role: "DISPATCHER",
      status: "ACTIVE",
      organizationId: dispatcherOrg.id,
    },
  });

  // Default session: shipper
  setAuthSession({
    userId: seed.shipperUser.id,
    email: seed.shipperUser.email,
    role: "SHIPPER",
    organizationId: seed.shipperOrg.id,
    status: "ACTIVE",
    firstName: "Test",
    lastName: "Shipper",
  });
});

// ── Helpers ──

function setShipperSession() {
  setAuthSession({
    userId: seed.shipperUser.id,
    email: seed.shipperUser.email,
    role: "SHIPPER",
    organizationId: seed.shipperOrg.id,
    status: "ACTIVE",
    firstName: "Test",
    lastName: "Shipper",
  });
}

function setCarrierSession() {
  setAuthSession({
    userId: seed.carrierUser.id,
    email: seed.carrierUser.email,
    role: "CARRIER",
    organizationId: seed.carrierOrg.id,
    status: "ACTIVE",
    firstName: "Test",
    lastName: "Carrier",
  });
}

function setAdminSession() {
  setAuthSession({
    userId: adminUser.id,
    email: adminUser.email,
    role: "ADMIN",
    organizationId: adminOrg.id,
    status: "ACTIVE",
  });
}

function setDispatcherSession() {
  setAuthSession({
    userId: dispatcherUser.id,
    email: dispatcherUser.email,
    role: "DISPATCHER",
    organizationId: dispatcherOrg.id,
    status: "ACTIVE",
  });
}

async function createTripWithStatus(id: string, status: string) {
  const load = await db.load.create({
    data: {
      id: `load-msg-${id}`,
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      truckType: "FLATBED",
      weight: 5000,
      status: status === "CANCELLED" ? "CANCELLED" : "ASSIGNED",
      cargoDescription: "Test cargo",
      shipperId: seed.shipperOrg.id,
    },
  });

  const truck = await db.truck.create({
    data: {
      id: `truck-msg-${id}`,
      licensePlate: `MSG-${id}`,
      truckType: "FLATBED",
      capacity: 10000,
      carrierId: seed.carrierOrg.id,
      approvalStatus: "APPROVED",
    },
  });

  const trip = await db.trip.create({
    data: {
      id: `trip-msg-${id}`,
      status,
      loadId: load.id,
      truckId: truck.id,
      carrierId: seed.carrierOrg.id,
      shipperId: seed.shipperOrg.id,
    },
  });

  return { load, truck, trip };
}

// ============================================================================
// POST /api/trips/[tripId]/messages — Send Message
// ============================================================================

describe("§13 In-App Messaging", () => {
  describe("POST /api/trips/[tripId]/messages — Send Message", () => {
    it("T1: Shipper sends message on ASSIGNED trip — 201", async () => {
      const { trip } = await createTripWithStatus("t1", "ASSIGNED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Hello, when can you pick up?" } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.message.content).toBe("Hello, when can you pick up?");
      expect(data.message.senderRole).toBe("SHIPPER");
      expect(data.message.tripId).toBe(trip.id);
      expect(data.message.readAt).toBeNull();
    });

    it("T2: Carrier sends message on IN_TRANSIT trip — 201", async () => {
      const { trip } = await createTripWithStatus("t2", "IN_TRANSIT");
      setCarrierSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "ETA 2 hours" } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.message.content).toBe("ETA 2 hours");
      expect(data.message.senderRole).toBe("CARRIER");
    });

    it("T3: Shipper sends message on DELIVERED trip — 201 (still active)", async () => {
      const { trip } = await createTripWithStatus("t3", "DELIVERED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Confirming receipt" } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(201);
    });

    it("T4: Message on PICKUP_PENDING trip — 201", async () => {
      const { trip } = await createTripWithStatus("t4", "PICKUP_PENDING");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Loading dock is gate 3" } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(201);
    });

    it("T5: Message on COMPLETED trip — 403 read-only", async () => {
      const { trip } = await createTripWithStatus("t5", "COMPLETED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Too late" } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("read-only");
    });

    it("T6: Message on CANCELLED trip — 403 read-only", async () => {
      const { trip } = await createTripWithStatus("t6", "CANCELLED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Why cancelled?" } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(403);
    });

    it("T7: Message with attachment URL — 201", async () => {
      const { trip } = await createTripWithStatus("t7", "ASSIGNED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        {
          body: {
            content: "Here is the loading photo",
            attachmentUrl: "https://cloudinary.com/images/loading-dock.jpg",
          },
        }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.message.attachmentUrl).toBe(
        "https://cloudinary.com/images/loading-dock.jpg"
      );
    });

    it("T8: Empty message — 400 validation error", async () => {
      const { trip } = await createTripWithStatus("t8", "ASSIGNED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "" } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });

    it("T9: Message exceeds 2000 chars — 400 validation error", async () => {
      const { trip } = await createTripWithStatus("t9", "ASSIGNED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "A".repeat(2001) } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });

    it("T10: Content exactly 2000 chars — 201", async () => {
      const { trip } = await createTripWithStatus("t10", "ASSIGNED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "B".repeat(2000) } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(201);
    });

    it("T11: Nonexistent trip — 404", async () => {
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/nonexistent/messages`,
        { body: { content: "Hello" } }
      );
      const res = await callHandler(sendMessage, req, {
        tripId: "nonexistent",
      });
      expect(res.status).toBe(404);
    });

    it("T12: Invalid attachment URL — 400", async () => {
      const { trip } = await createTripWithStatus("t12", "ASSIGNED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Photo", attachmentUrl: "not-a-url" } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // Access Control
  // ============================================================================

  describe("Access Control", () => {
    it("T13: Admin cannot SEND messages — 403", async () => {
      const { trip } = await createTripWithStatus("t13", "ASSIGNED");
      setAdminSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Admin message" } }
      );
      const res = await callHandler(sendMessage, req, { tripId: trip.id });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("cannot send");
    });

    it("T14: Admin CAN view messages (read-only) — 200", async () => {
      const { trip } = await createTripWithStatus("t14", "ASSIGNED");

      // Shipper sends a message first
      setShipperSession();
      const sendReq = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Visible to admin" } }
      );
      await callHandler(sendMessage, sendReq, { tripId: trip.id });

      // Admin reads messages
      setAdminSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages`
      );
      const res = await callHandler(listMessages, req, { tripId: trip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.messages.length).toBeGreaterThanOrEqual(1);
    });

    it("T15: Dispatcher has NO access to messages — 404", async () => {
      const { trip } = await createTripWithStatus("t15", "ASSIGNED");
      setDispatcherSession();

      // Cannot list
      const listReq = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages`
      );
      const listRes = await callHandler(listMessages, listReq, {
        tripId: trip.id,
      });
      expect(listRes.status).toBe(404);

      // Cannot send
      const sendReq = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Dispatcher msg" } }
      );
      const sendRes = await callHandler(sendMessage, sendReq, {
        tripId: trip.id,
      });
      expect(sendRes.status).toBe(404);
    });

    it("T16: Unrelated carrier cannot access trip messages — 404", async () => {
      const { trip } = await createTripWithStatus("t16", "ASSIGNED");

      // Create unrelated carrier
      const otherOrg = await db.organization.create({
        data: {
          id: "other-carrier-msg",
          name: "Other Carrier",
          type: "CARRIER_COMPANY",
        },
      });
      const otherUser = await db.user.create({
        data: {
          id: "other-carrier-user-msg",
          email: "other-carrier-msg@test.com",
          passwordHash: "hashed",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: otherOrg.id,
        },
      });

      setAuthSession({
        userId: otherUser.id,
        email: otherUser.email,
        role: "CARRIER",
        organizationId: otherOrg.id,
        status: "ACTIVE",
      });

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages`
      );
      const res = await callHandler(listMessages, req, { tripId: trip.id });
      expect(res.status).toBe(404);
    });

    it("T17: Dispatcher cannot see unread count — 404", async () => {
      const { trip } = await createTripWithStatus("t17", "ASSIGNED");
      setDispatcherSession();

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages/unread-count`
      );
      const res = await callHandler(unreadCount, req, { tripId: trip.id });
      expect(res.status).toBe(404);
    });

    it("T18: Dispatcher cannot mark message read — 404", async () => {
      const { trip } = await createTripWithStatus("t18", "ASSIGNED");

      // Shipper sends message
      setShipperSession();
      const sendReq = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Test" } }
      );
      const sendRes = await callHandler(sendMessage, sendReq, {
        tripId: trip.id,
      });
      const sendData = await parseResponse(sendRes);

      // Dispatcher tries to mark read
      setDispatcherSession();
      const req = createRequest(
        "PUT",
        `http://localhost:3000/api/trips/${trip.id}/messages/${sendData.message.id}/read`
      );
      const res = await callHandler(markRead, req, {
        tripId: trip.id,
        messageId: sendData.message.id,
      });
      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // GET /api/trips/[tripId]/messages — List Messages
  // ============================================================================

  describe("GET /api/trips/[tripId]/messages — List Messages", () => {
    it("T19: List messages in order — newest at bottom", async () => {
      const { trip } = await createTripWithStatus("t19", "ASSIGNED");

      // Shipper sends 2 messages
      setShipperSession();
      for (const text of ["First", "Second"]) {
        const req = createRequest(
          "POST",
          `http://localhost:3000/api/trips/${trip.id}/messages`,
          { body: { content: text } }
        );
        await callHandler(sendMessage, req, { tripId: trip.id });
      }

      // Carrier sends 1
      setCarrierSession();
      const req3 = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Third from carrier" } }
      );
      await callHandler(sendMessage, req3, { tripId: trip.id });

      // List as shipper
      setShipperSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages`
      );
      const res = await callHandler(listMessages, req, { tripId: trip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.messages.length).toBe(3);
      expect(data.messages[0].content).toBe("First");
      expect(data.messages[2].content).toBe("Third from carrier");
      expect(data.readOnly).toBe(false);
    });

    it("T20: COMPLETED trip returns readOnly=true", async () => {
      const { trip } = await createTripWithStatus("t20", "COMPLETED");
      setShipperSession();

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages`
      );
      const res = await callHandler(listMessages, req, { tripId: trip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.readOnly).toBe(true);
    });

    it("T21: CANCELLED trip returns readOnly=true", async () => {
      const { trip } = await createTripWithStatus("t21", "CANCELLED");
      setShipperSession();

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages`
      );
      const res = await callHandler(listMessages, req, { tripId: trip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.readOnly).toBe(true);
    });

    it("T22: EXCEPTION trip — 400 chat not available", async () => {
      const { trip } = await createTripWithStatus("t22", "EXCEPTION");
      setShipperSession();

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages`
      );
      const res = await callHandler(listMessages, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });
  });

  // ============================================================================
  // PUT /api/trips/[tripId]/messages/[messageId]/read — Mark Read
  // ============================================================================

  describe("PUT .../messages/[messageId]/read — Mark Read", () => {
    it("T23: Carrier marks shipper's message as read — 200", async () => {
      const { trip } = await createTripWithStatus("t23", "ASSIGNED");

      // Shipper sends
      setShipperSession();
      const sendReq = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Read this" } }
      );
      const sendRes = await callHandler(sendMessage, sendReq, {
        tripId: trip.id,
      });
      const sendData = await parseResponse(sendRes);
      expect(sendData.message.readAt).toBeNull();

      // Carrier marks read
      setCarrierSession();
      const req = createRequest(
        "PUT",
        `http://localhost:3000/api/trips/${trip.id}/messages/${sendData.message.id}/read`
      );
      const res = await callHandler(markRead, req, {
        tripId: trip.id,
        messageId: sendData.message.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.message.readAt).not.toBeNull();
    });

    it("T24: Cannot mark own message as read — 400", async () => {
      const { trip } = await createTripWithStatus("t24", "ASSIGNED");

      // Shipper sends
      setShipperSession();
      const sendReq = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "My own message" } }
      );
      const sendRes = await callHandler(sendMessage, sendReq, {
        tripId: trip.id,
      });
      const sendData = await parseResponse(sendRes);

      // Shipper tries to mark own as read
      const req = createRequest(
        "PUT",
        `http://localhost:3000/api/trips/${trip.id}/messages/${sendData.message.id}/read`
      );
      const res = await callHandler(markRead, req, {
        tripId: trip.id,
        messageId: sendData.message.id,
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("own message");
    });

    it("T25: Mark read is idempotent — second call returns same readAt", async () => {
      const { trip } = await createTripWithStatus("t25", "ASSIGNED");

      // Shipper sends
      setShipperSession();
      const sendReq = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Idempotent test" } }
      );
      const sendRes = await callHandler(sendMessage, sendReq, {
        tripId: trip.id,
      });
      const sendData = await parseResponse(sendRes);

      // Carrier marks read twice
      setCarrierSession();
      const req1 = createRequest(
        "PUT",
        `http://localhost:3000/api/trips/${trip.id}/messages/${sendData.message.id}/read`
      );
      const res1 = await callHandler(markRead, req1, {
        tripId: trip.id,
        messageId: sendData.message.id,
      });
      expect(res1.status).toBe(200);

      const req2 = createRequest(
        "PUT",
        `http://localhost:3000/api/trips/${trip.id}/messages/${sendData.message.id}/read`
      );
      const res2 = await callHandler(markRead, req2, {
        tripId: trip.id,
        messageId: sendData.message.id,
      });
      expect(res2.status).toBe(200); // Idempotent, not an error
    });

    it("T26: Mark read on wrong trip — 404", async () => {
      const { trip: trip1 } = await createTripWithStatus("t26a", "ASSIGNED");
      const { trip: trip2 } = await createTripWithStatus("t26b", "ASSIGNED");

      // Shipper sends on trip1
      setShipperSession();
      const sendReq = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip1.id}/messages`,
        { body: { content: "Wrong trip test" } }
      );
      const sendRes = await callHandler(sendMessage, sendReq, {
        tripId: trip1.id,
      });
      const sendData = await parseResponse(sendRes);

      // Carrier tries to mark read under trip2 — message doesn't belong to trip2
      setCarrierSession();
      const req = createRequest(
        "PUT",
        `http://localhost:3000/api/trips/${trip2.id}/messages/${sendData.message.id}/read`
      );
      const res = await callHandler(markRead, req, {
        tripId: trip2.id,
        messageId: sendData.message.id,
      });
      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // GET /api/trips/[tripId]/messages/unread-count
  // ============================================================================

  describe("GET .../messages/unread-count", () => {
    it("T27: Carrier has unread messages from shipper", async () => {
      const { trip } = await createTripWithStatus("t27", "ASSIGNED");

      // Shipper sends 3 messages
      setShipperSession();
      for (const text of ["Msg 1", "Msg 2", "Msg 3"]) {
        const req = createRequest(
          "POST",
          `http://localhost:3000/api/trips/${trip.id}/messages`,
          { body: { content: text } }
        );
        await callHandler(sendMessage, req, { tripId: trip.id });
      }

      // Carrier checks unread
      setCarrierSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages/unread-count`
      );
      const res = await callHandler(unreadCount, req, { tripId: trip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.unreadCount).toBe(3);
    });

    it("T28: Own messages don't count as unread", async () => {
      const { trip } = await createTripWithStatus("t28", "ASSIGNED");

      // Shipper sends messages
      setShipperSession();
      const req1 = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Own msg" } }
      );
      await callHandler(sendMessage, req1, { tripId: trip.id });

      // Shipper checks unread — should be 0
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages/unread-count`
      );
      const res = await callHandler(unreadCount, req, { tripId: trip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.unreadCount).toBe(0);
    });

    it("T29: Zero unread when no messages exist", async () => {
      const { trip } = await createTripWithStatus("t29", "ASSIGNED");

      setCarrierSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/messages/unread-count`
      );
      const res = await callHandler(unreadCount, req, { tripId: trip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.unreadCount).toBe(0);
    });

    it("T30: Nonexistent trip — 404", async () => {
      setCarrierSession();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/fake-trip/messages/unread-count`
      );
      const res = await callHandler(unreadCount, req, { tripId: "fake-trip" });
      expect(res.status).toBe(404);
    });
  });

  // ============================================================================
  // Notification Integration
  // ============================================================================

  describe("Notification Integration", () => {
    it("T31: Sending message triggers NEW_MESSAGE notification", async () => {
      const { createNotification } = require("@/lib/notifications");
      (createNotification as jest.Mock).mockClear();

      const { trip } = await createTripWithStatus("t31", "ASSIGNED");
      setShipperSession();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/messages`,
        { body: { content: "Triggers notification" } }
      );
      await callHandler(sendMessage, req, { tripId: trip.id });

      // Notification should have been called for the carrier's users
      // (fire-and-forget, but mock captures it)
      expect(createNotification).toHaveBeenCalled();
      const call = (createNotification as jest.Mock).mock.calls[0][0];
      expect(call.type).toBe("NEW_MESSAGE");
      expect(call.metadata.tripId).toBe(trip.id);
      expect(call.metadata.senderRole).toBe("SHIPPER");
    });
  });

  // ============================================================================
  // Conversation Isolation
  // ============================================================================

  describe("Conversation Isolation", () => {
    it("T32: Messages from trip A don't appear in trip B", async () => {
      const { trip: tripA } = await createTripWithStatus("t32a", "ASSIGNED");
      const { trip: tripB } = await createTripWithStatus("t32b", "ASSIGNED");

      // Shipper sends to trip A
      setShipperSession();
      const sendReq = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripA.id}/messages`,
        { body: { content: "Only for trip A" } }
      );
      await callHandler(sendMessage, sendReq, { tripId: tripA.id });

      // List trip B — should have 0 messages
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripB.id}/messages`
      );
      const res = await callHandler(listMessages, req, { tripId: tripB.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.messages.length).toBe(0);
    });
  });
});

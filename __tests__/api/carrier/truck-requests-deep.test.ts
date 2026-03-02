/**
 * Truck Requests — Deep Edge Case Tests
 *
 * Routes tested:
 * - POST /api/truck-requests/[id]/respond → expiration, races, load-assigned, truck-busy
 * - POST /api/truck-requests/[id]/cancel  → idempotent, non-PENDING, admin cancel
 *
 * These tests cover edge cases NOT covered by the existing
 * carrier-truck-requests.test.ts which handles basic approve/reject/cancel.
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  clearAllStores,
  mockAuth,
  mockCsrf,
  mockRateLimit,
  mockSecurity,
  mockCache,
  mockNotifications,
  mockCors,
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks BEFORE requiring route handlers
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockCors();
mockAuditLog();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();

// Custom notifications mock to include notifyTruckRequestResponse
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  notifyTruckRequest: jest.fn(async () => {}),
  notifyTruckRequestResponse: jest.fn(async () => {}),
  getRecentNotifications: jest.fn(async () => []),
  getUnreadCount: jest.fn(async () => 0),
  markAsRead: jest.fn(async () => {}),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Import handlers AFTER mocks
const {
  POST: respondToTruckRequest,
} = require("@/app/api/truck-requests/[id]/respond/route");
const {
  POST: cancelTruckRequest,
} = require("@/app/api/truck-requests/[id]/cancel/route");

describe("Truck Requests — Deep Edge Cases", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  // ─── Respond edge cases ───────────────────────────────────────────

  describe("Respond — edge cases", () => {
    it("should return 400 for expired request", async () => {
      const expiredRequest = await db.truckRequest.create({
        data: {
          id: "tr-expired-deep",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() - 86400000), // Yesterday
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${expiredRequest.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondToTruckRequest, req, {
        id: expiredRequest.id,
      });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("expired");
    });

    it("should return 409 when load already assigned", async () => {
      // Create a fresh load and assign it
      const assignedLoad = await db.load.create({
        data: {
          id: "load-assigned-deep",
          status: "ASSIGNED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Already assigned cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: "some-other-truck",
        },
      });

      const requestForAssigned = await db.truckRequest.create({
        data: {
          id: "tr-assigned-deep",
          loadId: assignedLoad.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${requestForAssigned.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondToTruckRequest, req, {
        id: requestForAssigned.id,
      });

      expect(res.status).toBe(409);
      const body = await parseResponse(res);
      expect(body.error).toContain("assigned");
    });

    it("should return 400 when truck busy on another active load", async () => {
      // Create a load that the truck is actively assigned to
      const activeLoad = await db.load.create({
        data: {
          id: "load-active-truck-busy",
          status: "IN_TRANSIT",
          pickupCity: "Hawassa",
          deliveryCity: "Mekelle",
          pickupDate: new Date(),
          deliveryDate: new Date(Date.now() + 86400000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Active load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
        },
      });

      // Create a new POSTED load and request for it
      const newLoad = await db.load.create({
        data: {
          id: "load-new-for-busy-truck",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Jimma",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "New request cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const busyRequest = await db.truckRequest.create({
        data: {
          id: "tr-busy-deep",
          loadId: newLoad.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${busyRequest.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondToTruckRequest, req, {
        id: busyRequest.id,
      });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("already assigned");

      // Clean up
      await db.load.update({
        where: { id: activeLoad.id },
        data: { assignedTruckId: null },
      });
    });

    it("should return 400 when load not in requestable status", async () => {
      const cancelledLoad = await db.load.create({
        data: {
          id: "load-cancelled-deep",
          status: "CANCELLED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(Date.now() + 86400000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Cancelled load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const cancelledReq = await db.truckRequest.create({
        data: {
          id: "tr-cancelled-load-deep",
          loadId: cancelledLoad.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${cancelledReq.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondToTruckRequest, req, {
        id: cancelledReq.id,
      });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("no longer available");
    });

    it("should handle idempotent re-approve → 200", async () => {
      const approvedRequest = await db.truckRequest.create({
        data: {
          id: "tr-already-approved-deep",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "APPROVED",
          expiresAt: new Date(Date.now() + 86400000),
          respondedAt: new Date(),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${approvedRequest.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondToTruckRequest, req, {
        id: approvedRequest.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.idempotent).toBe(true);
      expect(body.message).toContain("already");
    });

    it("should create trip with correct fields on APPROVE", async () => {
      // Create a fresh load and truck for this test
      const freshLoad = await db.load.create({
        data: {
          id: "load-trip-fields-deep",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupAddress: "Merkato",
          deliveryCity: "Dire Dawa",
          deliveryAddress: "Station St",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Trip fields test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          originLat: 9.02,
          originLon: 38.75,
          destinationLat: 9.6,
          destinationLon: 41.85,
          tripKm: 450,
        },
      });

      const freshTruck = await db.truck.create({
        data: {
          id: "truck-trip-fields-deep",
          truckType: "DRY_VAN",
          licensePlate: "TRK-DEEP-1",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const tripRequest = await db.truckRequest.create({
        data: {
          id: "tr-trip-fields-deep",
          loadId: freshLoad.id,
          truckId: freshTruck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${tripRequest.id}/respond`,
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondToTruckRequest, req, {
        id: tripRequest.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.trip).toBeDefined();
      expect(body.trip.status).toBe("ASSIGNED");
      expect(body.trip.loadId).toBe(freshLoad.id);
      expect(body.trip.truckId).toBe(freshTruck.id);
      expect(body.trip.trackingEnabled).toBe(true);
    });
  });

  // ─── Cancel edge cases ────────────────────────────────────────────

  describe("Cancel — edge cases", () => {
    it("should handle idempotent cancel of already-cancelled request → 200", async () => {
      const cancelledRequest = await db.truckRequest.create({
        data: {
          id: "tr-already-cancelled-deep",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "CANCELLED",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${cancelledRequest.id}/cancel`,
        { body: {} }
      );
      const res = await callHandler(cancelTruckRequest, req, {
        id: cancelledRequest.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.idempotent).toBe(true);
      expect(body.message).toContain("already cancelled");
    });

    it("should return 400 when cancelling APPROVED request", async () => {
      const approvedRequest = await db.truckRequest.create({
        data: {
          id: "tr-approved-cancel-deep",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "APPROVED",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${approvedRequest.id}/cancel`,
        { body: {} }
      );
      const res = await callHandler(cancelTruckRequest, req, {
        id: approvedRequest.id,
      });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("approved");
    });

    it("should allow admin to cancel → 200", async () => {
      const pendingRequest = await db.truckRequest.create({
        data: {
          id: "tr-admin-cancel-deep",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      setAuthSession(adminSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${pendingRequest.id}/cancel`,
        { body: { cancellationReason: "Admin override" } }
      );
      const res = await callHandler(cancelTruckRequest, req, {
        id: pendingRequest.id,
      });

      expect(res.status).toBe(200);
      const body = await parseResponse(res);
      expect(body.request.status).toBe("CANCELLED");
    });

    it("should save cancellation reason", async () => {
      // Use a unique load so events are isolated
      const reasonLoad = await db.load.create({
        data: {
          id: "load-cancel-reason-deep",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Reason test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const pendingReqWithReason = await db.truckRequest.create({
        data: {
          id: "tr-reason-cancel-deep",
          loadId: reasonLoad.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/truck-requests/${pendingReqWithReason.id}/cancel`,
        { body: { cancellationReason: "Found better carrier" } }
      );
      const res = await callHandler(cancelTruckRequest, req, {
        id: pendingReqWithReason.id,
      });

      expect(res.status).toBe(200);

      // Verify the load event was created with the reason
      const events = await db.loadEvent.findMany({
        where: { loadId: reasonLoad.id, eventType: "REQUEST_CANCELLED" },
      });

      expect(events.length).toBe(1);
      expect((events[0].metadata as any)?.cancellationReason).toBe(
        "Found better carrier"
      );
    });
  });
});

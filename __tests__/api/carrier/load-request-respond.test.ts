/**
 * Load Request Respond API Tests
 *
 * Tests for POST /api/load-requests/[id]/respond
 *
 * Business rules:
 * - Only the shipper who owns the load (or admin) can respond
 * - Actions: APPROVE or REJECT
 * - APPROVE: assigns load to truck, creates trip, cancels competing requests
 * - REJECT: marks request rejected, creates load event, notifies carrier
 * - Race conditions: load already assigned, load cancelled, truck busy
 * - Idempotency: re-approving already approved returns success with idempotent:true
 * - Expired requests are auto-marked EXPIRED
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
  mockLoadUtils,
  mockStorage,
  mockServiceFee,
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockNotifications();
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
mockLoadUtils();
mockStorage();
mockServiceFee();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

// Import handler AFTER mocks
const { POST } = require("@/app/api/load-requests/[id]/respond/route");

describe("Load Request Respond", () => {
  let seed: SeedData;

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const otherShipperSession = createMockSession({
    userId: "other-shipper-user-1",
    email: "other-shipper@test.com",
    role: "SHIPPER",
    organizationId: "other-shipper-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  // Helper to create a load request
  async function createLoadRequest(overrides: Record<string, unknown> = {}) {
    return db.loadRequest.create({
      data: {
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        requestedById: seed.carrierUser.id,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        status: "PENDING",
        ...overrides,
      },
    });
  }

  // ─── Auth & Access ──────────────────────────────────────────────────────────

  describe("Auth & Access", () => {
    it("unauthenticated → 401 or 500", async () => {
      setAuthSession(null);
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect([401, 500]).toContain(res.status);
    });

    it("wrong shipper org → 403", async () => {
      setAuthSession(otherShipperSession);
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(403);
    });

    it("carrier cannot respond to load requests → 403", async () => {
      setAuthSession(carrierSession);
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(403);
    });

    it("admin can respond", async () => {
      setAuthSession(adminSession);
      const lr = await createLoadRequest();

      // Ensure load is in POSTED status
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "REJECT" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);
    });
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe("Validation", () => {
    it("invalid action value → 400", async () => {
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "INVALID" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(400);
    });

    it("missing action field → 400", async () => {
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: {} }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(400);
    });

    it("load request not found → 404", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests/nonexistent/respond",
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: "nonexistent" });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("not found");
    });
  });

  // ─── APPROVE happy path ─────────────────────────────────────────────────────

  describe("APPROVE happy path", () => {
    it("200 with request, load, and trip in response", async () => {
      // Reset load to available state
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: true },
      });
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.request).toBeDefined();
      expect(data.load).toBeDefined();
      expect(data.trip).toBeDefined();
      expect(data.message).toContain("approved");
    });

    it("load status becomes ASSIGNED after approval", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: true },
      });
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      await callHandler(POST, req, { id: lr.id });

      const updatedLoad = await db.load.findUnique({
        where: { id: seed.load.id },
      });
      expect(updatedLoad.status).toBe("ASSIGNED");
      expect(updatedLoad.assignedTruckId).toBe(seed.truck.id);
    });

    it("trip created with correct fields", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: true },
      });
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      const data = await parseResponse(res);

      expect(data.trip.loadId).toBe(seed.load.id);
      expect(data.trip.truckId).toBe(seed.truck.id);
      expect(data.trip.carrierId).toBe(seed.carrierOrg.id);
      expect(data.trip.status).toBe("ASSIGNED");
    });
  });

  // ─── APPROVE race conditions ────────────────────────────────────────────────

  describe("APPROVE race conditions", () => {
    it("409 when load already has assignedTruckId", async () => {
      // Load already assigned to another truck
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: "other-truck-id" },
      });
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(409);

      const data = await parseResponse(res);
      expect(data.error).toContain("already been assigned");
    });

    it("400 when load status is CANCELLED", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "CANCELLED", assignedTruckId: null },
      });
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("no longer available");
    });

    it("400 when truck is busy with active load", async () => {
      // Reset load to available state
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });

      // Create another load assigned to the same truck
      await db.load.create({
        data: {
          id: "busy-load",
          status: "IN_TRANSIT",
          pickupCity: "Mekelle",
          deliveryCity: "Bahir Dar",
          pickupDate: new Date(),
          deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Active load blocking truck",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
        },
      });

      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("already assigned to an active load");

      // Cleanup busy load
      await db.load.delete({ where: { id: "busy-load" } });
    });
  });

  // ─── APPROVE side effects ──────────────────────────────────────────────────

  describe("APPROVE side effects", () => {
    it("competing PENDING loadRequests are cancelled", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: true },
      });

      // Create the request to approve
      const lr = await createLoadRequest();

      // Create a competing request for the same load
      const competing = await db.loadRequest.create({
        data: {
          id: "competing-lr",
          loadId: seed.load.id,
          truckId: "some-other-truck",
          carrierId: "some-other-carrier",
          shipperId: seed.shipperOrg.id,
          requestedById: seed.carrierUser.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      await callHandler(POST, req, { id: lr.id });

      // Check competing request was cancelled
      const updatedCompeting = await db.loadRequest.findUnique({
        where: { id: competing.id },
      });
      expect(updatedCompeting.status).toBe("CANCELLED");
    });

    it("truck posting marked MATCHED and truck.isAvailable set to false", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: true },
      });

      // Create active truck posting for this truck
      await db.truckPosting.update({
        where: { id: seed.truckPosting.id },
        data: { status: "ACTIVE", truckId: seed.truck.id },
      });

      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      await callHandler(POST, req, { id: lr.id });

      const updatedPosting = await db.truckPosting.findUnique({
        where: { id: seed.truckPosting.id },
      });
      expect(updatedPosting.status).toBe("MATCHED");

      const updatedTruck = await db.truck.findUnique({
        where: { id: seed.truck.id },
      });
      expect(updatedTruck.isAvailable).toBe(false);
    });

    it("load event ASSIGNED is created", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: true },
      });
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      await callHandler(POST, req, { id: lr.id });

      // Check that a load event was created
      const events = await db.loadEvent.findMany({
        where: { loadId: seed.load.id, eventType: "ASSIGNED" },
      });
      expect(events.length).toBeGreaterThan(0);
    });
  });

  // ─── Idempotency ────────────────────────────────────────────────────────────

  describe("Idempotency", () => {
    it("already APPROVED + action APPROVE → 200 with idempotent:true", async () => {
      const lr = await createLoadRequest({ status: "APPROVED" });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.idempotent).toBe(true);
    });

    it("already APPROVED + action REJECT → 400", async () => {
      const lr = await createLoadRequest({ status: "APPROVED" });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "REJECT" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("already been approved");
    });
  });

  // ─── Expiry ─────────────────────────────────────────────────────────────────

  describe("Expiry", () => {
    it("past expiresAt → loadRequest marked EXPIRED → 400", async () => {
      const lr = await createLoadRequest({
        expiresAt: new Date(Date.now() - 60 * 1000), // expired 1 minute ago
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("expired");

      // Verify the request was marked as EXPIRED in DB
      const updated = await db.loadRequest.findUnique({
        where: { id: lr.id },
      });
      expect(updated.status).toBe("EXPIRED");
    });
  });

  // ─── REJECT path ────────────────────────────────────────────────────────────

  describe("REJECT path", () => {
    it("200 status → REJECTED and loadEvent created", async () => {
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "REJECT" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.request.status).toBe("REJECTED");
      expect(data.message).toContain("rejected");

      // Check load event was created
      const events = await db.loadEvent.findMany({
        where: { loadId: seed.load.id, eventType: "LOAD_REQUEST_REJECTED" },
      });
      expect(events.length).toBeGreaterThan(0);
    });

    it("responseNotes are stored", async () => {
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        {
          body: {
            action: "REJECT",
            responseNotes: "Load requirements do not match our needs",
          },
        }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.request.responseNotes).toBe(
        "Load requirements do not match our needs"
      );
    });

    it("respondedAt and respondedById are set", async () => {
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "REJECT" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.request.respondedAt).toBeDefined();
      expect(data.request.respondedById).toBe(shipperSession.userId);
    });
  });

  // ─── Non-PENDING status ─────────────────────────────────────────────────────

  describe("Non-PENDING status", () => {
    it("already REJECTED + APPROVE → 400", async () => {
      const lr = await createLoadRequest({ status: "REJECTED" });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("already been rejected");
    });

    it("already EXPIRED + APPROVE → 400", async () => {
      const lr = await createLoadRequest({ status: "EXPIRED" });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("already been expired");
    });
  });
});

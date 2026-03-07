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

    it("wrong shipper org → 404", async () => {
      setAuthSession(otherShipperSession);
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(404);
    });

    it("carrier cannot respond to load requests → 404", async () => {
      setAuthSession(carrierSession);
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(404);
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

  // ─── APPROVE happy path (G-A9-2: now sets SHIPPER_APPROVED only) ─────────────

  describe("APPROVE happy path", () => {
    it("200 with request in response — no trip created (G-A9-2)", async () => {
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
      // G-A9-2: No trip on APPROVE — trip is created only after Carrier CONFIRM
      expect(data.trip).toBeUndefined();
      expect(data.message).toContain("accepted");
    });

    it("request status becomes SHIPPER_APPROVED (G-A9-2)", async () => {
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
      expect(data.request.status).toBe("SHIPPER_APPROVED");
    });

    it("load stays SEARCHING after APPROVE — not yet ASSIGNED (G-A9-2)", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "SEARCHING", assignedTruckId: null },
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
      // Load must still be SEARCHING (not ASSIGNED) until Carrier confirms
      expect(updatedLoad.status).toBe("SEARCHING");
      expect(updatedLoad.assignedTruckId).toBeNull();
    });
  });

  // ─── APPROVE concurrency (G-A9-2: race conditions now belong to CONFIRM route) ──

  describe("APPROVE concurrency", () => {
    it("409 when request already processed (concurrent approve)", async () => {
      // Pre-set request to SHIPPER_APPROVED (simulates concurrent first approve)
      const lr = await createLoadRequest({ status: "SHIPPER_APPROVED" });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      // Idempotent: SHIPPER_APPROVED + APPROVE → 200 with idempotent:true
      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.idempotent).toBe(true);
    });
  });

  // ─── APPROVE side effects (G-A9-2: only soft-reservation; no assignment) ────

  describe("APPROVE side effects", () => {
    it("load event LOAD_REQUEST_ACCEPTED is created (G-A9-2)", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      await callHandler(POST, req, { id: lr.id });

      // APPROVE creates LOAD_REQUEST_ACCEPTED event (not ASSIGNED)
      const events = await db.loadEvent.findMany({
        where: { loadId: seed.load.id, eventType: "LOAD_REQUEST_ACCEPTED" },
      });
      expect(events.length).toBeGreaterThan(0);
    });

    it("competing requests are NOT cancelled on APPROVE — only on CONFIRM (G-A9-2)", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });

      const lr = await createLoadRequest();

      // Competing request
      const competing = await db.loadRequest.create({
        data: {
          id: "competing-lr-respond",
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

      // Competing request remains PENDING — only CONFIRM cancels it
      const updatedCompeting = await db.loadRequest.findUnique({
        where: { id: competing.id },
      });
      expect(updatedCompeting.status).toBe("PENDING");
    });
  });

  // ─── Idempotency ────────────────────────────────────────────────────────────

  describe("Idempotency", () => {
    it("already SHIPPER_APPROVED + action APPROVE → 200 with idempotent:true", async () => {
      const lr = await createLoadRequest({ status: "SHIPPER_APPROVED" });

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

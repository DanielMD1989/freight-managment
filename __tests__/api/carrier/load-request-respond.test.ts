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

  // ─── G-M18-2: Load status guard on APPROVE ──────────────────────────────────

  describe("G-M18-2: Load status guard on APPROVE", () => {
    it("APPROVE when load is CANCELLED → 400", async () => {
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
      expect(data.error).toMatch(/no longer available/i);
    });

    it("APPROVE when load is ASSIGNED → 400", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "ASSIGNED", assignedTruckId: "some-other-truck" },
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
      expect(data.error).toMatch(/no longer available/i);
    });

    it("APPROVE when load is COMPLETED → 400", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "COMPLETED", assignedTruckId: null },
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
      expect(data.error).toMatch(/no longer available/i);
    });

    it("REJECT still works when load is CANCELLED (no load guard on REJECT)", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "CANCELLED", assignedTruckId: null },
      });
      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "REJECT" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);
    });
  });

  // ─── G-M18-3: Active trip guard on APPROVE ──────────────────────────────────

  describe("G-M18-3: Active trip guard on APPROVE", () => {
    it("APPROVE when truck has active trip (IN_TRANSIT) → 409", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });

      // Create an active trip for this truck
      await db.trip.create({
        data: {
          id: "active-trip-m18-3",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
        },
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
      expect(data.error).toMatch(/active trip/i);

      // Cleanup
      await db.trip.delete({ where: { id: "active-trip-m18-3" } });
    });

    it("APPROVE when truck has EXCEPTION trip → 409", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });

      await db.trip.create({
        data: {
          id: "exception-trip-m18-3",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
        },
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
      expect(data.error).toMatch(/active trip/i);

      // Cleanup
      await db.trip.delete({ where: { id: "exception-trip-m18-3" } });
    });

    it("APPROVE when truck has COMPLETED trip → 200 (not active)", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });

      await db.trip.create({
        data: {
          id: "completed-trip-m18-3",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "COMPLETED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
        },
      });

      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      // Cleanup
      await db.trip.delete({ where: { id: "completed-trip-m18-3" } });
    });
  });

  // ─── G-M18-4: Wallet gate on shipper APPROVE ───────────────────────────────

  describe("G-M18-4: Wallet gate on shipper APPROVE", () => {
    it("APPROVE when shipper below minimum balance → 402", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });

      // Set shipper wallet below minimum
      await db.financialAccount.update({
        where: { id: seed.shipperWallet.id },
        data: { balance: 0, minimumBalance: 500 },
      });

      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(402);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/wallet/i);

      // Restore wallet
      await db.financialAccount.update({
        where: { id: seed.shipperWallet.id },
        data: { balance: 10000, minimumBalance: 0 },
      });
    });

    it("REJECT succeeds even when shipper below minimum balance", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });

      // Set shipper wallet below minimum
      await db.financialAccount.update({
        where: { id: seed.shipperWallet.id },
        data: { balance: 0, minimumBalance: 500 },
      });

      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "REJECT" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      // Restore wallet
      await db.financialAccount.update({
        where: { id: seed.shipperWallet.id },
        data: { balance: 10000, minimumBalance: 0 },
      });
    });

    it("Admin bypasses wallet gate on APPROVE", async () => {
      setAuthSession(adminSession);
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "POSTED", assignedTruckId: null },
      });

      // Set shipper wallet below minimum
      await db.financialAccount.update({
        where: { id: seed.shipperWallet.id },
        data: { balance: 0, minimumBalance: 500 },
      });

      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      // Restore wallet
      await db.financialAccount.update({
        where: { id: seed.shipperWallet.id },
        data: { balance: 10000, minimumBalance: 0 },
      });
    });
  });

  // ─── G-M18-5: DISPATCHER blocked ───────────────────────────────────────────

  describe("G-M18-5: DISPATCHER cannot respond", () => {
    it("DISPATCHER → 404", async () => {
      const dispatcherSession = createMockSession({
        userId: "dispatcher-user-m18",
        email: "dispatcher@test.com",
        role: "DISPATCHER",
        organizationId: "dispatcher-org-1",
      });
      setAuthSession(dispatcherSession);

      const lr = await createLoadRequest();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(404);
    });
  });

  // ─── G-M18-6: REJECT atomicity — load reversion ───────────────────────────

  describe("G-M18-6: REJECT load reversion atomicity", () => {
    it("REJECT with zero remaining requests reverts SEARCHING → POSTED", async () => {
      // Use a dedicated load to avoid interference from other tests' load requests
      const isolatedLoad = await db.load.create({
        data: {
          id: "m18-6-isolated-load",
          status: "SEARCHING",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Isolated load for M18-6",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      // Only one request on this load — rejecting it should revert to POSTED
      const lr = await createLoadRequest({
        loadId: isolatedLoad.id,
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr.id}/respond`,
        { body: { action: "REJECT" } }
      );

      const res = await callHandler(POST, req, { id: lr.id });
      expect(res.status).toBe(200);

      const updatedLoad = await db.load.findUnique({
        where: { id: isolatedLoad.id },
      });
      expect(updatedLoad.status).toBe("POSTED");
    });

    it("REJECT with other PENDING requests does NOT revert load", async () => {
      // Use a dedicated load to avoid interference
      const isolatedLoad2 = await db.load.create({
        data: {
          id: "m18-6-isolated-load-2",
          status: "SEARCHING",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Isolated load 2 for M18-6",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });

      const lr1 = await createLoadRequest({ loadId: isolatedLoad2.id });
      // Second competing request on same load
      await db.loadRequest.create({
        data: {
          id: "competing-lr-m18-6",
          loadId: isolatedLoad2.id,
          truckId: "some-other-truck-m18",
          carrierId: "some-other-carrier-m18",
          shipperId: seed.shipperOrg.id,
          requestedById: seed.carrierUser.id,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          status: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${lr1.id}/respond`,
        { body: { action: "REJECT" } }
      );

      const res = await callHandler(POST, req, { id: lr1.id });
      expect(res.status).toBe(200);

      const updatedLoad = await db.load.findUnique({
        where: { id: isolatedLoad2.id },
      });
      // Load stays SEARCHING because competing request is still PENDING
      expect(updatedLoad.status).toBe("SEARCHING");
    });
  });
});

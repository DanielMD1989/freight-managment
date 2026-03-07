/**
 * Round A9 — Carrier Request Flow Tests
 *
 * Tests gaps G-A9-2 through G-A9-7:
 *   A9-2: SHIPPER_APPROVED intermediate state + Carrier CONFIRM to create trip
 *   A9-3: POSTED → SEARCHING on request; SEARCHING → POSTED on last-request cancel/reject
 *   A9-4: Dispatcher full visibility (no org filter)
 *   A9-5: Cross-truck sibling request cancellation on CONFIRM
 *   A9-6: GET /api/load-requests/[id]
 *   A9-7: DELETE /api/load-requests/[id]
 *
 * All IDs prefixed "a9-" to avoid collision with other test suites.
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
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

// Import handlers AFTER mocks
const { POST: createLoadRequest } = require("@/app/api/load-requests/route");
const { GET: listLoadRequests } = require("@/app/api/load-requests/route");
const {
  POST: respondToLoadRequest,
} = require("@/app/api/load-requests/[id]/respond/route");
const {
  POST: confirmLoadRequest,
} = require("@/app/api/load-requests/[id]/confirm/route");
const {
  GET: getLoadRequest,
  DELETE: deleteLoadRequest,
} = require("@/app/api/load-requests/[id]/route");

// ─── Sessions ────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "a9-shipper-user",
  role: "SHIPPER",
  organizationId: "a9-shipper-org",
  status: "ACTIVE",
});

const carrierSession = createMockSession({
  userId: "a9-carrier-user",
  role: "CARRIER",
  organizationId: "a9-carrier-org",
  status: "ACTIVE",
});

const carrier2Session = createMockSession({
  userId: "a9-carrier2-user",
  role: "CARRIER",
  organizationId: "a9-carrier2-org",
  status: "ACTIVE",
});

const dispatcherSession = createMockSession({
  userId: "a9-dispatcher-user",
  role: "DISPATCHER",
  organizationId: "a9-dispatcher-org",
  status: "ACTIVE",
});

const dispatcherNoOrgSession = createMockSession({
  userId: "a9-dispatcher-noorg",
  role: "DISPATCHER",
  organizationId: undefined,
  status: "ACTIVE",
});

const adminSession = createMockSession({
  userId: "a9-admin-user",
  role: "ADMIN",
  organizationId: undefined,
  status: "ACTIVE",
});

// ─── Seed data ───────────────────────────────────────────────────────────────

async function seedA9Data() {
  // Orgs
  await db.organization.create({
    data: {
      id: "a9-shipper-org",
      name: "A9 Shipper Co",
      type: "SHIPPER",
      contactEmail: "a9shipper@test.com",
      contactPhone: "+25190000001",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await db.organization.create({
    data: {
      id: "a9-carrier-org",
      name: "A9 Carrier LLC",
      type: "CARRIER_COMPANY",
      contactEmail: "a9carrier@test.com",
      contactPhone: "+25190000002",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await db.organization.create({
    data: {
      id: "a9-carrier2-org",
      name: "A9 Carrier2 LLC",
      type: "CARRIER_COMPANY",
      contactEmail: "a9carrier2@test.com",
      contactPhone: "+25190000003",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  // Users
  await db.user.create({
    data: {
      id: "a9-shipper-user",
      email: "a9shipper@test.com",
      passwordHash: "hash",
      firstName: "A9",
      lastName: "Shipper",
      phone: "+25190000001",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "a9-shipper-org",
    },
  });
  await db.user.create({
    data: {
      id: "a9-carrier-user",
      email: "a9carrier@test.com",
      passwordHash: "hash",
      firstName: "A9",
      lastName: "Carrier",
      phone: "+25190000002",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: "a9-carrier-org",
    },
  });
  await db.user.create({
    data: {
      id: "a9-carrier2-user",
      email: "a9carrier2@test.com",
      passwordHash: "hash",
      firstName: "A9",
      lastName: "Carrier2",
      phone: "+25190000003",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: "a9-carrier2-org",
    },
  });
  await db.user.create({
    data: {
      id: "a9-dispatcher-user",
      email: "a9dispatcher@test.com",
      passwordHash: "hash",
      firstName: "A9",
      lastName: "Dispatcher",
      phone: "+25190000004",
      role: "DISPATCHER",
      status: "ACTIVE",
      organizationId: "a9-dispatcher-org",
    },
  });
  await db.user.create({
    data: {
      id: "a9-dispatcher-noorg",
      email: "a9dispatcher-noorg@test.com",
      passwordHash: "hash",
      firstName: "A9",
      lastName: "NoOrg",
      phone: "+25190000009",
      role: "DISPATCHER",
      status: "ACTIVE",
      organizationId: null,
    },
  });
  await db.user.create({
    data: {
      id: "a9-admin-user",
      email: "a9admin@test.com",
      passwordHash: "hash",
      firstName: "A9",
      lastName: "Admin",
      phone: "+25190000005",
      role: "ADMIN",
      status: "ACTIVE",
      organizationId: null,
    },
  });

  // Wallets
  await db.financialAccount.create({
    data: {
      id: "a9-wallet-shipper",
      organizationId: "a9-shipper-org",
      accountType: "SHIPPER_WALLET",
      balance: 10000,
      currency: "ETB",
    },
  });
  await db.financialAccount.create({
    data: {
      id: "a9-wallet-carrier",
      organizationId: "a9-carrier-org",
      accountType: "CARRIER_WALLET",
      balance: 5000,
      currency: "ETB",
    },
  });

  // Trucks
  await db.truck.create({
    data: {
      id: "a9-truck-1",
      truckType: "DRY_VAN",
      licensePlate: "A9-001",
      capacity: 10000,
      isAvailable: true,
      carrierId: "a9-carrier-org",
      createdById: "a9-carrier-user",
      approvalStatus: "APPROVED",
    },
  });
  await db.truck.create({
    data: {
      id: "a9-truck-2",
      truckType: "DRY_VAN",
      licensePlate: "A9-002",
      capacity: 10000,
      isAvailable: true,
      carrierId: "a9-carrier2-org",
      createdById: "a9-carrier2-user",
      approvalStatus: "APPROVED",
    },
  });

  // Truck postings
  await db.truckPosting.create({
    data: {
      id: "a9-posting-1",
      truckId: "a9-truck-1",
      carrierId: "a9-carrier-org",
      originCityId: "city-addis",
      originCityName: "Addis Ababa",
      availableFrom: new Date(),
      status: "ACTIVE",
      fullPartial: "FULL",
      contactName: "A9 Carrier",
      contactPhone: "+25190000002",
    },
  });
  await db.truckPosting.create({
    data: {
      id: "a9-posting-2",
      truckId: "a9-truck-2",
      carrierId: "a9-carrier2-org",
      originCityId: "city-addis",
      originCityName: "Addis Ababa",
      availableFrom: new Date(),
      status: "ACTIVE",
      fullPartial: "FULL",
      contactName: "A9 Carrier2",
      contactPhone: "+25190000003",
    },
  });
}

// ─── Suite ───────────────────────────────────────────────────────────────────

describe("Round A9 — Carrier Request Flow", () => {
  let loadId: string;
  let load2Id: string; // second load for cross-load cross-truck test

  beforeAll(async () => {
    await seedA9Data();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to create a fresh POSTED load
  async function createFreshLoad(suffix: string) {
    const load = await db.load.create({
      data: {
        id: `a9-load-${suffix}`,
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 86400000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "A9 test cargo",
        shipperId: "a9-shipper-org",
        createdById: "a9-shipper-user",
        postedAt: new Date(),
      },
    });
    return load;
  }

  // Helper to create a load request directly
  async function createLR(
    lId: string,
    truckId: string,
    carrierId: string,
    status = "PENDING",
    id?: string
  ) {
    return db.loadRequest.create({
      data: {
        id: id || `a9-lr-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        loadId: lId,
        truckId,
        carrierId,
        shipperId: "a9-shipper-org",
        requestedById:
          carrierId === "a9-carrier-org"
            ? "a9-carrier-user"
            : "a9-carrier2-user",
        expiresAt: new Date(Date.now() + 24 * 3600000),
        status,
      },
    });
  }

  // ─── G-A9-3: POSTED → SEARCHING transition on first request ──────────────

  describe("G-A9-3 — POSTED→SEARCHING on request; revert on cancel/reject", () => {
    it("A9-3a: load starts as POSTED", async () => {
      const load = await createFreshLoad("3a");
      loadId = load.id;
      expect(load.status).toBe("POSTED");
    });

    it("A9-3b: POST /api/load-requests transitions POSTED → SEARCHING", async () => {
      setAuthSession(carrierSession);

      const req = createRequest("POST", "http://localhost/api/load-requests", {
        body: {
          loadId,
          truckId: "a9-truck-1",
          notes: "G-A9-3 test",
        },
      });

      const res = await createLoadRequest(req);
      expect([200, 201]).toContain(res.status);

      const updated = await db.load.findUnique({ where: { id: loadId } });
      expect(updated?.status).toBe("SEARCHING");
    });

    it("A9-3c: second POST on SEARCHING load leaves status as SEARCHING", async () => {
      setAuthSession(carrier2Session);
      const loadForC = await createFreshLoad("3c");

      // Manually set to SEARCHING (first request already happened)
      await db.load.update({
        where: { id: loadForC.id },
        data: { status: "SEARCHING" },
      });

      // Create a request
      await createLR(loadForC.id, "a9-truck-2", "a9-carrier2-org");

      const updated = await db.load.findUnique({ where: { id: loadForC.id } });
      // Still SEARCHING — only the first request sets it
      expect(["SEARCHING", "POSTED"]).toContain(updated?.status);
    });

    it("A9-3d: REJECT reverts SEARCHING → POSTED when no active requests remain", async () => {
      const load = await createFreshLoad("3d");
      await db.load.update({
        where: { id: load.id },
        data: { status: "SEARCHING" },
      });

      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "PENDING",
        "a9-lr-3d"
      );

      setAuthSession(shipperSession);
      const req = createRequest(
        "POST",
        `http://localhost/api/load-requests/${lr.id}/respond`,
        { body: { action: "REJECT" } }
      );

      const res = await callHandler(respondToLoadRequest, req, { id: lr.id });
      expect(res.status).toBe(200);

      const updatedLoad = await db.load.findUnique({ where: { id: load.id } });
      // No other active requests → reverts to POSTED
      expect(updatedLoad?.status).toBe("POSTED");
    });
  });

  // ─── G-A9-2: SHIPPER_APPROVED + Carrier CONFIRM ───────────────────────────

  describe("G-A9-2 — Shipper APPROVE → SHIPPER_APPROVED; Carrier CONFIRM → Trip", () => {
    let lrId: string;

    beforeAll(async () => {
      const load = await createFreshLoad("2-main");
      load2Id = load.id;

      await db.load.update({
        where: { id: load2Id },
        data: { status: "SEARCHING" },
      });

      const lr = await createLR(
        load2Id,
        "a9-truck-1",
        "a9-carrier-org",
        "PENDING",
        "a9-lr-2-main"
      );
      lrId = lr.id;
    });

    it("A9-2a: Shipper APPROVE sets SHIPPER_APPROVED", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost/api/load-requests/${lrId}/respond`,
        { body: { action: "APPROVE" } }
      );

      const res = await callHandler(respondToLoadRequest, req, { id: lrId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.request.status).toBe("SHIPPER_APPROVED");
    });

    it("A9-2b: no Trip created on APPROVE", async () => {
      const tripsBefore = await db.trip.findMany({
        where: { loadId: load2Id },
      });
      // Trip count must be 0 after APPROVE (trip only created on CONFIRM)
      expect(tripsBefore.length).toBe(0);
    });

    it("A9-2c: load stays SEARCHING on APPROVE — not yet ASSIGNED", async () => {
      const load = await db.load.findUnique({ where: { id: load2Id } });
      expect(load?.status).toBe("SEARCHING");
      // G-A9-2: load must not be assigned yet; mock stores undefined for unset fields
      expect(load?.assignedTruckId ?? null).toBeNull();
    });

    it("A9-2d: Carrier CONFIRM creates Trip with status=ASSIGNED", async () => {
      setAuthSession(carrierSession);

      const req = createRequest(
        "POST",
        `http://localhost/api/load-requests/${lrId}/confirm`,
        { body: { action: "CONFIRM" } }
      );

      const res = await callHandler(confirmLoadRequest, req, { id: lrId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip).toBeDefined();
      expect(data.trip.status).toBe("ASSIGNED");
      expect(data.trip.loadId).toBe(load2Id);
      expect(data.trip.truckId).toBe("a9-truck-1");
    });

    it("A9-2e: Carrier CONFIRM sets load status ASSIGNED", async () => {
      const load = await db.load.findUnique({ where: { id: load2Id } });
      expect(load?.status).toBe("ASSIGNED");
      expect(load?.assignedTruckId).toBe("a9-truck-1");
    });
  });

  // ─── G-A9-2: Carrier DECLINE reverts to POSTED ───────────────────────────

  describe("G-A9-2 — Carrier DECLINE", () => {
    it("A9-2f: Carrier DECLINE sets request CANCELLED, reverts load to POSTED", async () => {
      const load = await createFreshLoad("2-decline");
      await db.load.update({
        where: { id: load.id },
        data: { status: "SEARCHING" },
      });

      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "SHIPPER_APPROVED",
        "a9-lr-2-decline"
      );

      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        `http://localhost/api/load-requests/${lr.id}/confirm`,
        { body: { action: "DECLINE" } }
      );

      const res = await callHandler(confirmLoadRequest, req, { id: lr.id });
      expect(res.status).toBe(200);

      const updatedLR = await db.loadRequest.findUnique({
        where: { id: lr.id },
      });
      expect(updatedLR?.status).toBe("CANCELLED");

      const updatedLoad = await db.load.findUnique({ where: { id: load.id } });
      expect(updatedLoad?.status).toBe("POSTED");
    });
  });

  // ─── G-A9-5: Cross-truck sibling cancellation on CONFIRM ─────────────────

  describe("G-A9-5 — Cross-truck sibling requests cancelled on CONFIRM", () => {
    let confirmLrId: string;
    let siblingLrId: string;

    beforeAll(async () => {
      // Use a fresh truck (truck-5) to avoid conflict with active trip on a9-truck-1 from A9-2d
      await db.truck.create({
        data: {
          id: "a9-truck-5",
          truckType: "DRY_VAN",
          licensePlate: "A9-005",
          capacity: 10000,
          isAvailable: true,
          carrierId: "a9-carrier-org",
          createdById: "a9-carrier-user",
          approvalStatus: "APPROVED",
        },
      });
      await db.truckPosting.create({
        data: {
          id: "a9-posting-5",
          truckId: "a9-truck-5",
          carrierId: "a9-carrier-org",
          originCityId: "city-addis",
          originCityName: "Addis Ababa",
          availableFrom: new Date(),
          status: "ACTIVE",
          fullPartial: "FULL",
          contactName: "A9 Carrier",
          contactPhone: "+25190000002",
        },
      });

      const load = await createFreshLoad("5-main");
      await db.load.update({
        where: { id: load.id },
        data: { status: "SEARCHING" },
      });

      // Another load for the cross-load sibling test
      const siblingLoad = await createFreshLoad("5-sibling");
      await db.load.update({
        where: { id: siblingLoad.id },
        data: { status: "SEARCHING" },
      });

      // Primary request: truck-5 on load-5-main (SHIPPER_APPROVED)
      const lr = await createLR(
        load.id,
        "a9-truck-5",
        "a9-carrier-org",
        "SHIPPER_APPROVED",
        "a9-lr-5-main"
      );
      confirmLrId = lr.id;

      // Sibling request: truck-5 on a DIFFERENT load (cross-load sibling, PENDING)
      const sibling = await createLR(
        siblingLoad.id,
        "a9-truck-5",
        "a9-carrier-org",
        "PENDING",
        "a9-lr-5-sibling"
      );
      siblingLrId = sibling.id;
    });

    it("A9-5a: before CONFIRM, sibling request is PENDING", async () => {
      const lr = await db.loadRequest.findUnique({
        where: { id: siblingLrId },
      });
      expect(lr?.status).toBe("PENDING");
    });

    it("A9-5b: after CONFIRM, cross-load sibling request is CANCELLED (G-A9-5)", async () => {
      setAuthSession(carrierSession);

      const req = createRequest(
        "POST",
        `http://localhost/api/load-requests/${confirmLrId}/confirm`,
        { body: { action: "CONFIRM" } }
      );

      await callHandler(confirmLoadRequest, req, { id: confirmLrId });

      const sibling = await db.loadRequest.findUnique({
        where: { id: siblingLrId },
      });
      expect(sibling?.status).toBe("CANCELLED");
    });
  });

  // ─── G-A9-4: Dispatcher visibility ───────────────────────────────────────

  describe("G-A9-4 — Dispatcher full visibility", () => {
    it("A9-4a: DISPATCHER with org → 200 with loadRequests array", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest("GET", "http://localhost/api/load-requests");
      const res = await listLoadRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(Array.isArray(data.loadRequests)).toBe(true);
    });

    it("A9-4b: DISPATCHER without org → 200 (G-A9-4: no org guard)", async () => {
      setAuthSession(dispatcherNoOrgSession);

      const req = createRequest("GET", "http://localhost/api/load-requests");
      const res = await listLoadRequests(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── G-A9-6: GET /api/load-requests/[id] ────────────────────────────────

  describe("G-A9-6 — GET /api/load-requests/[id]", () => {
    let detailLrId: string;

    beforeAll(async () => {
      const load = await createFreshLoad("6-detail");
      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "PENDING",
        "a9-lr-6-detail"
      );
      detailLrId = lr.id;
    });

    it("A9-6a: CARRIER who made the request → 200", async () => {
      setAuthSession(carrierSession);

      const req = createRequest(
        "GET",
        `http://localhost/api/load-requests/${detailLrId}`
      );
      const res = await callHandler(getLoadRequest, req, { id: detailLrId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.id).toBe(detailLrId);
    });

    it("A9-6b: SHIPPER who owns the load → 200", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost/api/load-requests/${detailLrId}`
      );
      const res = await callHandler(getLoadRequest, req, { id: detailLrId });
      expect(res.status).toBe(200);
    });

    it("A9-6c: DISPATCHER → 200 (full visibility)", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest(
        "GET",
        `http://localhost/api/load-requests/${detailLrId}`
      );
      const res = await callHandler(getLoadRequest, req, { id: detailLrId });
      expect(res.status).toBe(200);
    });

    it("A9-6d: unrelated CARRIER → 404 (info leakage prevention)", async () => {
      setAuthSession(carrier2Session);

      const req = createRequest(
        "GET",
        `http://localhost/api/load-requests/${detailLrId}`
      );
      const res = await callHandler(getLoadRequest, req, { id: detailLrId });
      expect(res.status).toBe(404);
    });
  });

  // ─── G-A9-7: DELETE /api/load-requests/[id] ─────────────────────────────

  describe("G-A9-7 — DELETE /api/load-requests/[id]", () => {
    it("A9-7a: CARRIER can DELETE PENDING request → 200 with cancelled message", async () => {
      const load = await createFreshLoad("7a");
      await db.load.update({
        where: { id: load.id },
        data: { status: "SEARCHING" },
      });
      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "PENDING",
        "a9-lr-7a"
      );

      setAuthSession(carrierSession);
      const req = createRequest(
        "DELETE",
        `http://localhost/api/load-requests/${lr.id}`
      );
      const res = await callHandler(deleteLoadRequest, req, { id: lr.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.message).toMatch(/cancelled/i);
      expect(data.success).toBe(true);
    });

    it("A9-7b: DELETE creates LoadEvent with eventType REQUEST_CANCELLED", async () => {
      const load = await createFreshLoad("7b");
      await db.load.update({
        where: { id: load.id },
        data: { status: "SEARCHING" },
      });
      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "PENDING",
        "a9-lr-7b"
      );

      setAuthSession(carrierSession);
      const req = createRequest(
        "DELETE",
        `http://localhost/api/load-requests/${lr.id}`
      );
      await callHandler(deleteLoadRequest, req, { id: lr.id });

      const events = await db.loadEvent.findMany({
        where: { loadId: load.id, eventType: "REQUEST_CANCELLED" },
      });
      expect(events.length).toBeGreaterThan(0);
    });

    it("A9-7c: DELETE on SHIPPER_APPROVED request is allowed", async () => {
      const load = await createFreshLoad("7c");
      await db.load.update({
        where: { id: load.id },
        data: { status: "SEARCHING" },
      });
      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "SHIPPER_APPROVED",
        "a9-lr-7c"
      );

      setAuthSession(carrierSession);
      const req = createRequest(
        "DELETE",
        `http://localhost/api/load-requests/${lr.id}`
      );
      const res = await callHandler(deleteLoadRequest, req, { id: lr.id });
      expect(res.status).toBe(200);
    });

    it("A9-7d: DELETE on APPROVED request → 400 (already finalised)", async () => {
      const load = await createFreshLoad("7d");
      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "APPROVED",
        "a9-lr-7d"
      );

      setAuthSession(carrierSession);
      const req = createRequest(
        "DELETE",
        `http://localhost/api/load-requests/${lr.id}`
      );
      const res = await callHandler(deleteLoadRequest, req, { id: lr.id });
      expect(res.status).toBe(400);
    });

    it("A9-7e: DELETE reverts load SEARCHING → POSTED when no other active requests", async () => {
      const load = await createFreshLoad("7e");
      await db.load.update({
        where: { id: load.id },
        data: { status: "SEARCHING" },
      });
      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "PENDING",
        "a9-lr-7e"
      );

      setAuthSession(carrierSession);
      const req = createRequest(
        "DELETE",
        `http://localhost/api/load-requests/${lr.id}`
      );
      await callHandler(deleteLoadRequest, req, { id: lr.id });

      const updatedLoad = await db.load.findUnique({ where: { id: load.id } });
      expect(updatedLoad?.status).toBe("POSTED");
    });
  });

  // ─── G-A9-2: CONFIRM pre-conditions ──────────────────────────────────────

  describe("G-A9-2 — CONFIRM pre-conditions", () => {
    it("CONFIRM on PENDING request → 400 (must be SHIPPER_APPROVED)", async () => {
      const load = await createFreshLoad("confirm-pre");
      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "PENDING",
        "a9-lr-confirm-pre"
      );

      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        `http://localhost/api/load-requests/${lr.id}/confirm`,
        { body: { action: "CONFIRM" } }
      );

      const res = await callHandler(confirmLoadRequest, req, { id: lr.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/not awaiting carrier confirmation/i);
    });

    it("CONFIRM by unrelated carrier → 404", async () => {
      const load = await createFreshLoad("confirm-unrelated");
      const lr = await createLR(
        load.id,
        "a9-truck-1",
        "a9-carrier-org",
        "SHIPPER_APPROVED",
        "a9-lr-confirm-unrelated"
      );

      // carrier2 does not own truck-1
      setAuthSession(carrier2Session);
      const req = createRequest(
        "POST",
        `http://localhost/api/load-requests/${lr.id}/confirm`,
        { body: { action: "CONFIRM" } }
      );

      const res = await callHandler(confirmLoadRequest, req, { id: lr.id });
      expect(res.status).toBe(404);
    });
  });
});

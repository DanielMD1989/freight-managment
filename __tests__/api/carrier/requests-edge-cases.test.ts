/**
 * Carrier Load Requests Edge-Case Tests
 *
 * Tests load request boundary conditions:
 * - Duplicate request handling (same load + different truck, prior REJECTED)
 * - Load status validation (DRAFT, IN_TRANSIT, COMPLETED loads)
 * - Approve creates trip (status=ASSIGNED, correct IDs, load status)
 * - Respond edge cases (already responded, invalid action)
 * - GET filtering (by status, empty results)
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

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

// Import handlers AFTER mocks
const {
  POST: createRequest_,
  GET: listRequests,
} = require("@/app/api/load-requests/route");
const {
  POST: respondToRequest,
} = require("@/app/api/load-requests/[id]/respond/route");

describe("Carrier Load Requests Edge Cases", () => {
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
    status: "ACTIVE",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create a second truck for duplicate request tests
    await db.truck.create({
      data: {
        id: "second-truck-001",
        truckType: "FLATBED",
        licensePlate: "BB-54321",
        capacity: 15000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    // Create active posting for second truck
    await db.truckPosting.create({
      data: {
        id: "second-truck-posting",
        truckId: "second-truck-001",
        carrierId: seed.carrierOrg.id,
        originCityId: "city-req",
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "Test Carrier",
        contactPhone: "+251911000002",
      },
    });

    // Create loads in various statuses
    await db.load.create({
      data: {
        id: "draft-req-load",
        status: "DRAFT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Mekelle",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Draft load for request test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    await db.load.create({
      data: {
        id: "intransit-req-load",
        status: "IN_TRANSIT",
        pickupCity: "Hawassa",
        deliveryCity: "Jimma",
        pickupDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "In transit load for request test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    await db.load.create({
      data: {
        id: "completed-req-load",
        status: "COMPLETED",
        pickupCity: "Dire Dawa",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Completed load for request test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    // Create a fresh posted load for approve tests
    await db.load.create({
      data: {
        id: "approve-test-load",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Gondar",
        pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Load for approve test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        postedAt: new Date(),
      },
    });

    // Create a rejected request for re-request test
    await db.loadRequest.create({
      data: {
        id: "rejected-request-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        requestedById: seed.carrierUser.id,
        shipperId: seed.shipperOrg.id,
        status: "REJECTED",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Create a pending request for respond tests
    await db.loadRequest.create({
      data: {
        id: "pending-respond-request",
        loadId: "approve-test-load",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        requestedById: seed.carrierUser.id,
        shipperId: seed.shipperOrg.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Create an already approved request for idempotency test
    await db.loadRequest.create({
      data: {
        id: "already-approved-request",
        loadId: seed.load.id,
        truckId: "second-truck-001",
        carrierId: seed.carrierOrg.id,
        requestedById: seed.carrierUser.id,
        shipperId: seed.shipperOrg.id,
        status: "APPROVED",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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

  // ─── Duplicate Request Handling ────────────────────────────────────────

  describe("Duplicate request handling", () => {
    it("same load + different truck → 201 (allowed)", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: "second-truck-001",
          },
        }
      );
      const res = await createRequest_(req);
      expect(res.status).toBe(201);
    });

    it("same load + same truck with prior REJECTED → 201 (allowed)", async () => {
      // The rejected-request-001 has status REJECTED for same load+truck
      // A new PENDING request should be allowed
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: seed.truck.id,
          },
        }
      );
      const res = await createRequest_(req);
      expect(res.status).toBe(201);
    });
  });

  // ─── Load Status Validation ────────────────────────────────────────────

  describe("Load status validation", () => {
    it("request on DRAFT load returns 400", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: "draft-req-load",
            truckId: seed.truck.id,
          },
        }
      );
      const res = await createRequest_(req);
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("not available");
    });

    it("request on IN_TRANSIT load returns 400", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: "intransit-req-load",
            truckId: seed.truck.id,
          },
        }
      );
      const res = await createRequest_(req);
      expect(res.status).toBe(400);
    });

    it("request on COMPLETED load returns 400", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: "completed-req-load",
            truckId: seed.truck.id,
          },
        }
      );
      const res = await createRequest_(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── Approve Creates Trip ──────────────────────────────────────────────

  describe("Approve creates trip", () => {
    it("APPROVE response creates trip with status=ASSIGNED", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests/pending-respond-request/respond",
        { body: { action: "APPROVE" } }
      );
      const res = await callHandler(respondToRequest, req, {
        id: "pending-respond-request",
      });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.trip).toBeDefined();
      expect(data.trip.status).toBe("ASSIGNED");
    });
  });

  // ─── Respond Edge Cases ────────────────────────────────────────────────

  describe("Respond edge cases", () => {
    it("respond to already-approved request with REJECT → 400", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests/already-approved-request/respond",
        { body: { action: "REJECT" } }
      );
      const res = await callHandler(respondToRequest, req, {
        id: "already-approved-request",
      });
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("already been");
    });

    it("invalid action value returns 400", async () => {
      setAuthSession(shipperSession);

      // Create a fresh pending request for this test
      await db.loadRequest.create({
        data: {
          id: "invalid-action-request",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          requestedById: seed.carrierUser.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests/invalid-action-request/respond",
        { body: { action: "INVALID_ACTION" } }
      );
      const res = await callHandler(respondToRequest, req, {
        id: "invalid-action-request",
      });
      expect(res.status).toBe(400);
    });
  });

  // ─── GET Filtering ─────────────────────────────────────────────────────

  describe("GET filtering", () => {
    it("filter by status=PENDING returns only pending", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests?status=PENDING"
      );
      const res = await listRequests(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(Array.isArray(data.loadRequests)).toBe(true);
      for (const request of data.loadRequests) {
        expect(request.status).toBe("PENDING");
      }
    });

    it("empty result returns loadRequests=[]", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests?loadId=nonexistent-load-id"
      );
      const res = await listRequests(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.loadRequests).toEqual([]);
    });
  });
});

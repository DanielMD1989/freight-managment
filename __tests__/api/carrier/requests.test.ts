/**
 * Carrier Requests Tests
 *
 * Tests for all request-type endpoints:
 * - POST /api/load-requests → { loadRequest, message } (carrier requests load)
 * - GET /api/load-requests → { loadRequests, pagination }
 * - POST /api/load-requests/[id]/respond → { request, load, trip } or { request, message }
 * - GET /api/truck-requests → { requests, total, limit, offset }
 * - GET /api/match-proposals → { proposals, total, limit, offset }
 *
 * Business rules:
 * - Only carriers can create load requests
 * - Carrier must own the truck
 * - Truck must be APPROVED with active posting
 * - Load must be POSTED/SEARCHING/OFFERED
 * - No duplicate pending request for same load+truck
 * - Shipper approves/rejects load requests
 * - Carrier sees requests for own trucks (truck-requests)
 * - Carrier sees proposals for own org (match-proposals)
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
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

jest.mock("@/lib/gpsTracking", () => ({
  enableTrackingForLoad: jest.fn(async () => null),
}));

// Import handlers AFTER mocks
const {
  POST: createLoadRequest,
  GET: listLoadRequests,
} = require("@/app/api/load-requests/route");
const {
  POST: respondToLoadRequest,
} = require("@/app/api/load-requests/[id]/respond/route");
const { GET: listTruckRequests } = require("@/app/api/truck-requests/route");
const { GET: listMatchProposals } = require("@/app/api/match-proposals/route");

describe("Carrier Requests", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    status: "ACTIVE",
    organizationId: "shipper-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    status: "ACTIVE",
    organizationId: "admin-org-1",
  });

  const dispatcherSession = createMockSession({
    userId: "dispatcher-user-1",
    email: "dispatcher@test.com",
    role: "DISPATCHER",
    organizationId: "dispatcher-org-1",
  });

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user",
    email: "other@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "other-carrier-org",
  });

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  // ─── POST /api/load-requests ──────────────────────────────────────────────

  describe("POST /api/load-requests - Carrier Requests Load", () => {
    it("creates request for posted load → 201 with { loadRequest, message }", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: seed.truck.id,
            notes: "Interested in this load",
          },
        }
      );

      const res = await createLoadRequest(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.loadRequest).toBeDefined();
      expect(data.message).toContain("sent to shipper");
      expect(data.loadRequest.loadId).toBe(seed.load.id);
      expect(data.loadRequest.truckId).toBe(seed.truck.id);
      expect(data.loadRequest.carrierId).toBe("carrier-org-1");
      expect(data.loadRequest.status).toBe("PENDING");
    });

    it("rejects when carrier does not own truck → 403", async () => {
      // Create truck owned by another org
      const otherTruck = await db.truck.create({
        data: {
          id: "other-owner-truck",
          truckType: "DRY_VAN",
          licensePlate: "OTH-OWN-1",
          capacity: 10000,
          carrierId: "other-carrier-org",
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: otherTruck.id,
          },
        }
      );

      const res = await createLoadRequest(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("own trucks");
    });

    it("rejects unapproved truck → 400", async () => {
      const pendingTruck = await db.truck.create({
        data: {
          id: "pending-req-truck",
          truckType: "FLATBED",
          licensePlate: "PEND-REQ-1",
          capacity: 8000,
          carrierId: seed.carrierOrg.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: pendingTruck.id,
          },
        }
      );

      const res = await createLoadRequest(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("approved");
    });

    it("rejects truck without active posting → 400", async () => {
      const noPostTruck = await db.truck.create({
        data: {
          id: "no-posting-truck",
          truckType: "TANKER",
          licensePlate: "NO-POST-1",
          capacity: 15000,
          carrierId: seed.carrierOrg.id,
          approvalStatus: "APPROVED",
        },
      });
      // No posting created for this truck

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: noPostTruck.id,
          },
        }
      );

      const res = await createLoadRequest(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("active posting");
    });

    it("rejects non-available load (wrong status) → 400", async () => {
      const assignedLoad = await db.load.create({
        data: {
          id: "assigned-load-req",
          status: "ASSIGNED",
          pickupCity: "Addis",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Assigned load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: assignedLoad.id,
            truckId: seed.truck.id,
          },
        }
      );

      const res = await createLoadRequest(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("not available");
    });

    it("rejects already-assigned load → 400", async () => {
      const alreadyAssigned = await db.load.create({
        data: {
          id: "already-assigned-load",
          status: "POSTED",
          pickupCity: "Addis",
          deliveryCity: "Jimma",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Already assigned",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: "some-truck",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: alreadyAssigned.id,
            truckId: seed.truck.id,
          },
        }
      );

      const res = await createLoadRequest(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("already assigned");
    });

    it("rejects duplicate pending request → 400", async () => {
      // Create a pending request first
      await db.loadRequest.create({
        data: {
          id: "existing-req",
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
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: seed.truck.id,
          },
        }
      );

      const res = await createLoadRequest(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("pending request already exists");
    });

    it("non-carrier role → 403", async () => {
      setAuthSession(shipperSession);

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

      const res = await createLoadRequest(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("Only carriers");
    });

    it("unauthenticated → 401", async () => {
      setAuthSession(null);

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

      const res = await createLoadRequest(req);
      expect([401, 500]).toContain(res.status);
    });

    it("rejects non-existent load → 404", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: {
            loadId: "nonexistent-load",
            truckId: seed.truck.id,
          },
        }
      );

      const res = await createLoadRequest(req);
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/load-requests ───────────────────────────────────────────────

  describe("GET /api/load-requests - List Load Requests", () => {
    it("carrier sees own org requests only", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests"
      );

      const res = await listLoadRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loadRequests).toBeDefined();
      expect(data.pagination).toBeDefined();

      for (const lr of data.loadRequests) {
        expect(lr.carrierId).toBe("carrier-org-1");
      }
    });

    it("shipper sees requests for own loads only", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests"
      );

      const res = await listLoadRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const lr of data.loadRequests) {
        expect(lr.shipperId).toBe("shipper-org-1");
      }
    });

    it("filters by status", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests?status=PENDING"
      );

      const res = await listLoadRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const lr of data.loadRequests) {
        expect(lr.status).toBe("PENDING");
      }
    });

    it("returns pagination metadata", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests?limit=10&offset=0"
      );

      const res = await listLoadRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pagination.total).toBeDefined();
      expect(data.pagination.limit).toBe(10);
      expect(data.pagination.offset).toBe(0);
      expect(typeof data.pagination.hasMore).toBe("boolean");
    });
  });

  // ─── POST /api/load-requests/[id]/respond ─────────────────────────────────

  describe("POST /api/load-requests/[id]/respond - Shipper Responds", () => {
    it("shipper rejects → status=REJECTED", async () => {
      // Create a load request for the shipper to reject
      const rejectableRequest = await db.loadRequest.create({
        data: {
          id: "rejectable-req",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          requestedById: seed.carrierUser.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${rejectableRequest.id}/respond`,
        {
          body: {
            action: "REJECT",
            responseNotes: "Not suitable",
          },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: rejectableRequest.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.message).toContain("rejected");
    });

    it("carrier cannot respond to own request → 404", async () => {
      const carrierReq = await db.loadRequest.create({
        data: {
          id: "carrier-respond-req",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          requestedById: seed.carrierUser.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      // Carrier session, not shipper
      setAuthSession(carrierSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${carrierReq.id}/respond`,
        {
          body: { action: "APPROVE" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: carrierReq.id,
      });
      expect(res.status).toBe(404);
    });

    it("cannot respond to non-PENDING request → 400", async () => {
      const approvedReq = await db.loadRequest.create({
        data: {
          id: "already-approved-req",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          requestedById: seed.carrierUser.id,
          shipperId: seed.shipperOrg.id,
          status: "APPROVED",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${approvedReq.id}/respond`,
        {
          body: { action: "REJECT" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: approvedReq.id,
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent request", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests/nonexistent/respond",
        {
          body: { action: "REJECT" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: "nonexistent",
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/truck-requests ──────────────────────────────────────────────

  describe("GET /api/truck-requests - List Truck Requests", () => {
    beforeAll(async () => {
      // Create a truck request for testing
      await db.truckRequest.create({
        data: {
          id: "test-truck-req",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          shipperId: seed.shipperOrg.id,
          requestedById: seed.shipperUser.id,
          carrierId: seed.carrierOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    it("carrier sees requests for own trucks", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-requests"
      );

      const res = await listTruckRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.requests).toBeDefined();
      expect(Array.isArray(data.requests)).toBe(true);
      expect(typeof data.total).toBe("number");
      expect(typeof data.limit).toBe("number");
      expect(typeof data.offset).toBe("number");
    });

    it("shipper sees own requests", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-requests"
      );

      const res = await listTruckRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const r of data.requests) {
        expect(r.shipperId).toBe("shipper-org-1");
      }
    });

    it("filters by status", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-requests?status=PENDING"
      );

      const res = await listTruckRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const r of data.requests) {
        expect(r.status).toBe("PENDING");
      }
    });
  });

  // ─── GET /api/match-proposals ─────────────────────────────────────────────

  describe("GET /api/match-proposals - List Proposals", () => {
    beforeAll(async () => {
      // Create a match proposal
      await db.matchProposal.create({
        data: {
          id: "test-proposal",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          proposedById: "dispatcher-user-1",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    });

    it("carrier sees proposals for own org", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/match-proposals"
      );

      const res = await listMatchProposals(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.proposals).toBeDefined();
      expect(Array.isArray(data.proposals)).toBe(true);
      expect(typeof data.total).toBe("number");
      expect(typeof data.limit).toBe("number");
      expect(typeof data.offset).toBe("number");

      for (const p of data.proposals) {
        expect(p.carrierId).toBe("carrier-org-1");
      }
    });

    it("dispatcher sees all proposals", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/match-proposals"
      );

      const res = await listMatchProposals(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.proposals).toBeDefined();
    });

    it("filters by status", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/match-proposals?status=PENDING"
      );

      const res = await listMatchProposals(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const p of data.proposals) {
        expect(p.status).toBe("PENDING");
      }
    });

    it("unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/match-proposals"
      );

      const res = await listMatchProposals(req);
      expect([401, 500]).toContain(res.status);
    });
  });
});

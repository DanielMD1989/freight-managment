/**
 * Carrier Disputes API Tests
 *
 * Tests for dispute management:
 * - POST /api/disputes (create dispute) → { message, dispute }
 * - GET /api/disputes (list disputes) → { disputes, pagination }
 *
 * Business rules:
 * - Only shipper or assigned carrier can create dispute for a load
 * - Dispute type enum: PAYMENT_ISSUE, DAMAGE, LATE_DELIVERY, OTHER
 * - Description min 10 characters
 * - Dispute status: OPEN (default), UNDER_REVIEW, RESOLVED, CLOSED
 * - Cross-org access blocked (only see own org disputes)
 * - Filters: status, loadId
 * - Pagination with page/limit
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
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
const {
  POST: createDispute,
  GET: listDisputes,
} = require("@/app/api/disputes/route");

describe("Carrier Disputes", () => {
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

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user-1",
    email: "other-carrier@test.com",
    role: "CARRIER",
    organizationId: "other-carrier-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create a load with assigned truck for dispute tests
    await db.load.create({
      data: {
        id: "dispute-load",
        status: "DELIVERED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Delivered cargo for dispute",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });

    // Create another load without assignment (for access control tests)
    await db.load.create({
      data: {
        id: "unrelated-load",
        status: "POSTED",
        pickupCity: "Mekelle",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 8000,
        cargoDescription: "Unrelated load for access test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    // Pre-create some disputes for list tests
    await db.dispute.create({
      data: {
        id: "existing-dispute-1",
        loadId: "dispute-load",
        createdById: carrierSession.userId,
        disputedOrgId: carrierSession.organizationId!,
        type: "DAMAGE",
        description:
          "Cargo was damaged during transport due to poor road conditions",
        status: "OPEN",
      },
    });

    await db.dispute.create({
      data: {
        id: "existing-dispute-2",
        loadId: "dispute-load",
        createdById: shipperSession.userId,
        disputedOrgId: shipperSession.organizationId!,
        type: "LATE_DELIVERY",
        description: "Delivery was significantly late beyond agreed schedule",
        status: "UNDER_REVIEW",
      },
    });

    await db.dispute.create({
      data: {
        id: "resolved-dispute",
        loadId: seed.load.id,
        createdById: shipperSession.userId,
        disputedOrgId: shipperSession.organizationId!,
        type: "PAYMENT_ISSUE",
        description: "Payment dispute resolved after carrier confirmed receipt",
        status: "RESOLVED",
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

  // ─── POST /api/disputes ────────────────────────────────────────────────────

  describe("POST /api/disputes - Create Dispute", () => {
    it("carrier creates dispute for assigned load → { message, dispute }", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          type: "DAMAGE",
          description: "Cargo was damaged during loading at pickup location",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.dispute).toBeDefined();
      expect(data.message).toContain("Dispute created");
      expect(data.dispute.type).toBe("DAMAGE");
      expect(data.dispute.status).toBe("OPEN");
      expect(data.dispute.loadId).toBe("dispute-load");
      expect(data.dispute.createdById).toBe(carrierSession.userId);
      // C3 FIX: disputedOrgId should be the OTHER party (shipper), not the filer (carrier)
      expect(data.dispute.disputedOrgId).toBe(shipperSession.organizationId);
    });

    it("shipper creates dispute for own load", async () => {
      setAuthSession(shipperSession);

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          type: "LATE_DELIVERY",
          description:
            "Delivery was three days late beyond the agreed delivery date",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.dispute).toBeDefined();
      expect(data.dispute.type).toBe("LATE_DELIVERY");
    });

    it("dispute includes loadId and createdById fields", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          type: "OTHER",
          description:
            "General dispute about the terms of the transport agreement",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.dispute).toBeDefined();
      expect(data.dispute.loadId).toBe("dispute-load");
      expect(data.dispute.createdById).toBe(carrierSession.userId);
      // C3 FIX: disputedOrgId should be the OTHER party (shipper), not the filer (carrier)
      expect(data.dispute.disputedOrgId).toBe(shipperSession.organizationId);
    });

    it("accepts PAYMENT_ISSUE type", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          type: "PAYMENT_ISSUE",
          description:
            "Payment for load was not received after delivery completion",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.dispute.type).toBe("PAYMENT_ISSUE");
    });

    it("accepts evidence field", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          type: "DAMAGE",
          description: "Cargo damage documented with photos during unloading",
          evidence: "https://evidence.example.com/photo1.jpg",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.dispute.evidenceUrls).toBeDefined();
    });

    it("unrelated carrier cannot create dispute → 403", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          type: "DAMAGE",
          description: "This carrier is not assigned to this particular load",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("Forbidden");
    });

    it("non-existent load → 404", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "nonexistent-load-id",
          type: "DAMAGE",
          description: "This load does not exist in the system at all",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("Load not found");
    });

    it("description too short → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          type: "DAMAGE",
          description: "Short",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(400);
    });

    it("missing required fields → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          // missing type and description
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(400);
    });

    it("invalid dispute type → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          type: "INVALID_TYPE",
          description: "Invalid type should be rejected by validation",
        },
      });

      const res = await createDispute(req);
      expect(res.status).toBe(400);
    });

    it("unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-load",
          type: "DAMAGE",
          description:
            "This request should be rejected due to no authentication",
        },
      });

      const res = await createDispute(req);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── GET /api/disputes ─────────────────────────────────────────────────────

  describe("GET /api/disputes - List Disputes", () => {
    it("carrier sees disputes for own org", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/disputes");

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.disputes).toBeDefined();
      expect(Array.isArray(data.disputes)).toBe(true);
      expect(data.pagination).toBeDefined();
      expect(typeof data.pagination.total).toBe("number");
      expect(typeof data.pagination.page).toBe("number");
      expect(typeof data.pagination.limit).toBe("number");
    });

    it("shipper sees disputes for own loads", async () => {
      setAuthSession(shipperSession);

      const req = createRequest("GET", "http://localhost:3000/api/disputes");

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.disputes).toBeDefined();
      // Shipper should see disputes where they are the disputedOrg or load shipper
      expect(data.disputes.length).toBeGreaterThan(0);
    });

    it("filters by status=OPEN", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes?status=OPEN"
      );

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const dispute of data.disputes) {
        expect(dispute.status).toBe("OPEN");
      }
    });

    it("filters by status=UNDER_REVIEW", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes?status=UNDER_REVIEW"
      );

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const dispute of data.disputes) {
        expect(dispute.status).toBe("UNDER_REVIEW");
      }
    });

    it("filters by status=RESOLVED", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes?status=RESOLVED"
      );

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const dispute of data.disputes) {
        expect(dispute.status).toBe("RESOLVED");
      }
    });

    it("filters by loadId", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes?loadId=dispute-load"
      );

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const dispute of data.disputes) {
        expect(dispute.loadId).toBe("dispute-load");
      }
    });

    it("returns pagination structure", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes?page=1&limit=5"
      );

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(5);
      expect(typeof data.pagination.totalPages).toBe("number");
      expect(data.disputes.length).toBeLessThanOrEqual(5);
    });

    it("disputes have loadId field", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/disputes");

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      if (data.disputes.length > 0) {
        expect(data.disputes[0].loadId).toBeDefined();
      }
    });

    it("disputes have createdById and disputedOrgId fields", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/disputes");

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      if (data.disputes.length > 0) {
        expect(data.disputes[0].createdById).toBeDefined();
        expect(data.disputes[0].disputedOrgId).toBeDefined();
      }
    });

    it("other carrier sees no disputes (cross-org blocked)", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest("GET", "http://localhost:3000/api/disputes");

      const res = await listDisputes(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Other carrier should see no disputes since they have no related loads
      expect(data.disputes.length).toBe(0);
    });

    it("unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest("GET", "http://localhost:3000/api/disputes");

      const res = await listDisputes(req);
      expect([401, 500]).toContain(res.status);
    });
  });
});

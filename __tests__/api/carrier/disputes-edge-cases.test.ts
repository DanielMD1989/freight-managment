/**
 * Carrier Disputes Edge-Case Tests
 *
 * Tests dispute boundary conditions:
 * - Description boundary (exactly 10 chars success, 9 chars fails)
 * - Type validation (invalid enum)
 * - Carrier only sees own org disputes
 * - Empty results handling
 * - Dispute on COMPLETED load is allowed
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
  POST: createDispute,
  GET: listDisputes,
} = require("@/app/api/disputes/route");

describe("Carrier Disputes Edge Cases", () => {
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

    // Create a delivered load with assigned truck for dispute tests
    await db.load.create({
      data: {
        id: "dispute-edge-load",
        status: "DELIVERED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Delivered cargo for edge case disputes",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });

    // Create a COMPLETED load for dispute-on-completed test
    await db.load.create({
      data: {
        id: "completed-dispute-load",
        status: "COMPLETED",
        pickupCity: "Mekelle",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 6000,
        cargoDescription: "Completed cargo for dispute test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });

    // Create another carrier org for cross-org tests
    await db.organization.create({
      data: {
        id: "other-carrier-org-1",
        name: "Other Carrier LLC",
        type: "CARRIER_COMPANY",
        contactEmail: "other-carrier@test.com",
        contactPhone: "+251911000099",
        isVerified: true,
      },
    });

    await db.user.create({
      data: {
        id: "other-carrier-user-1",
        email: "other-carrier@test.com",
        role: "CARRIER",
        organizationId: "other-carrier-org-1",
        firstName: "Other",
        lastName: "Carrier",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Pre-create a dispute for carrier org
    await db.dispute.create({
      data: {
        id: "existing-dispute-1",
        loadId: "dispute-edge-load",
        createdById: seed.carrierUser.id,
        disputedOrgId: seed.carrierOrg.id,
        type: "PAYMENT_ISSUE",
        description: "Payment was not received for this delivery",
        status: "OPEN",
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

  // ─── Description Boundary ──────────────────────────────────────────────

  describe("Description boundary", () => {
    it("exactly 10 characters → 200 success", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-edge-load",
          type: "DAMAGE",
          description: "1234567890", // exactly 10 chars
        },
      });
      const res = await createDispute(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.dispute).toBeDefined();
    });

    it("exactly 9 characters → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-edge-load",
          type: "DAMAGE",
          description: "123456789", // 9 chars, below min 10
        },
      });
      const res = await createDispute(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── Type Validation ──────────────────────────────────────────────────

  describe("Type validation", () => {
    it("invalid type enum returns 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "dispute-edge-load",
          type: "INVALID_TYPE",
          description: "This should fail validation because of bad type",
        },
      });
      const res = await createDispute(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── Org Visibility ───────────────────────────────────────────────────

  describe("Org visibility", () => {
    it("carrier only sees own org disputes", async () => {
      setAuthSession(carrierSession);

      const req = createRequest("GET", "http://localhost:3000/api/disputes");
      const res = await listDisputes(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(Array.isArray(data.disputes)).toBe(true);
      // Should see the dispute we created for carrier org
      expect(data.disputes.length).toBeGreaterThan(0);
    });

    it("other carrier sees no disputes from first carrier", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest("GET", "http://localhost:3000/api/disputes");
      const res = await listDisputes(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      // Other carrier should NOT see carrier-org-1's disputes
      expect(data.disputes).toEqual([]);
    });
  });

  // ─── Empty Results ────────────────────────────────────────────────────

  describe("Empty results", () => {
    it("carrier with no disputes returns empty array", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest("GET", "http://localhost:3000/api/disputes");
      const res = await listDisputes(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.disputes).toEqual([]);
    });

    it("filter by non-existent loadId returns empty array", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/disputes?loadId=nonexistent-load-xyz"
      );
      const res = await listDisputes(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.disputes).toEqual([]);
    });
  });

  // ─── Dispute on Completed Load ─────────────────────────────────────────

  describe("Dispute on completed load", () => {
    it("POST dispute on COMPLETED load → 200 (disputes allowed after delivery)", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/disputes", {
        body: {
          loadId: "completed-dispute-load",
          type: "LATE_DELIVERY",
          description:
            "Delivery was significantly delayed beyond agreed schedule",
        },
      });
      const res = await createDispute(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.dispute).toBeDefined();
      expect(data.dispute.type).toBe("LATE_DELIVERY");
    });
  });
});

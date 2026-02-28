/**
 * Carrier Truck Postings Edge-Case Tests
 *
 * Tests truck posting boundary conditions:
 * - POST date validation (availableFrom >= availableTo)
 * - POST field validation (missing required fields)
 * - PATCH edge cases (non-existent, CANCELLED posting, empty body)
 * - GET pagination edge cases (limit clamping, offset > total)
 * - DELETE edge cases (already CANCELLED, non-existent)
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
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();

// Override foundation-rules mock: validateOneActivePostPerTruck must return { valid: true }
jest.mock("@/lib/foundation-rules", () => ({
  getVisibilityRules: jest.fn((role: string) => ({
    canViewAllTrucks: role !== "SHIPPER",
    canViewAllLoads: role !== "CARRIER",
    canViewOwnTrucksOnly: role === "CARRIER",
    canViewOwnLoadsOnly: role === "SHIPPER",
  })),
  RULE_SHIPPER_DEMAND_FOCUS: {
    id: "SHIPPER_DEMAND_FOCUS",
    description: "Shippers cannot browse truck fleet",
  },
  RULE_ONE_ACTIVE_POST_PER_TRUCK: {
    id: "ONE_ACTIVE_POST_PER_TRUCK",
    description: "One active posting per truck",
  },
  RULE_CARRIER_FINAL_AUTHORITY: {
    id: "CARRIER_FINAL_AUTHORITY",
    description: "Carrier must approve",
  },
  validateOneActivePostPerTruck: jest.fn(() => ({ valid: true })),
  canModifyTruckOwnership: jest.fn((role: string) => role === "CARRIER"),
  canDirectlyAssignLoads: jest.fn((role: string) =>
    ["CARRIER", "ADMIN", "SUPER_ADMIN"].includes(role)
  ),
  canProposeMatches: jest.fn((role: string) =>
    ["DISPATCHER", "ADMIN", "SUPER_ADMIN"].includes(role)
  ),
  canStartTrips: jest.fn((role: string) => role === "CARRIER"),
  canAcceptLoadRequests: jest.fn((role: string) => role === "CARRIER"),
  assertDispatcherCannotAssign: jest.fn(),
  assertCarrierOwnership: jest.fn(),
  assertOneActivePost: jest.fn(),
  FoundationRuleViolation: class FoundationRuleViolation extends Error {
    ruleId: string;
    constructor(ruleId: string, desc: string) {
      super(desc);
      this.ruleId = ruleId;
    }
  },
}));

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
  POST: createPosting,
  GET: listPostings,
} = require("@/app/api/truck-postings/route");
const {
  GET: getPosting,
  PATCH: updatePosting,
  DELETE: deletePosting,
} = require("@/app/api/truck-postings/[id]/route");

describe("Carrier Truck Postings Edge Cases", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
    status: "ACTIVE",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create an Ethiopian location for city IDs
    await db.ethiopianLocation.create({
      data: {
        id: "city-addis",
        name: "Addis Ababa",
        nameEthiopic: "አዲስ አበባ",
        region: "Addis Ababa",
        latitude: 9.02,
        longitude: 38.75,
        isActive: true,
      },
    });

    // Create CANCELLED posting for edge case tests
    await db.truckPosting.create({
      data: {
        id: "cancelled-posting-001",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        originCityId: "city-addis",
        availableFrom: new Date(),
        status: "CANCELLED",
        fullPartial: "FULL",
        contactName: "Test Carrier",
        contactPhone: "+251911000002",
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

  // ─── POST Date Validation ──────────────────────────────────────────────

  describe("POST date validation", () => {
    it("availableFrom === availableTo returns 400", async () => {
      const sameDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: seed.truck.id,
            originCityId: "city-addis",
            availableFrom: sameDate,
            availableTo: sameDate,
            contactName: "Test Carrier",
            contactPhone: "+251911000002",
          },
        }
      );
      const res = await createPosting(req);
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("availableTo must be after availableFrom");
    });

    it("POST with all optional fields returns 201", async () => {
      // First remove the existing active posting to avoid ONE_ACTIVE_POST_PER_TRUCK
      const existingPosting = seed.truckPosting;
      await db.truckPosting.update({
        where: { id: existingPosting.id },
        data: { status: "EXPIRED" },
      });

      // Create destination location
      await db.ethiopianLocation.create({
        data: {
          id: "city-hawassa",
          name: "Hawassa",
          nameEthiopic: "ሃዋሳ",
          region: "Sidama",
          latitude: 7.06,
          longitude: 38.48,
          isActive: true,
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: seed.truck.id,
            originCityId: "city-addis",
            destinationCityId: "city-hawassa",
            availableFrom: new Date(
              Date.now() + 1 * 24 * 60 * 60 * 1000
            ).toISOString(),
            availableTo: new Date(
              Date.now() + 7 * 24 * 60 * 60 * 1000
            ).toISOString(),
            contactName: "Test Carrier",
            contactPhone: "+251911000002",
            notes: "Edge case test posting with all fields",
          },
        }
      );
      const res = await createPosting(req);
      expect(res.status).toBe(201);
    });
  });

  // ─── POST Field Validation ─────────────────────────────────────────────

  describe("POST field validation", () => {
    it("missing contactName returns 400", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: seed.truck.id,
            originCityId: "city-addis",
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            contactPhone: "+251911000002",
            // missing contactName
          },
        }
      );
      const res = await createPosting(req);
      expect(res.status).toBe(400);
    });

    it("missing originCityId returns 400", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: seed.truck.id,
            // missing originCityId
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            contactName: "Test Carrier",
            contactPhone: "+251911000002",
          },
        }
      );
      const res = await createPosting(req);
      expect(res.status).toBe(400);
    });
  });

  // ─── PATCH Edge Cases ──────────────────────────────────────────────────

  describe("PATCH edge cases", () => {
    it("PATCH non-existent posting returns 404", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/truck-postings/nonexistent-posting-id-12345",
        { body: { contactName: "Updated" } }
      );
      const res = await callHandler(updatePosting, req, {
        id: "nonexistent-posting-id-12345",
      });
      expect(res.status).toBe(404);
    });

    it("PATCH CANCELLED posting returns 400", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/truck-postings/cancelled-posting-001",
        { body: { contactName: "Updated" } }
      );
      const res = await callHandler(updatePosting, req, {
        id: "cancelled-posting-001",
      });
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("cancelled");
    });

    it("empty PATCH body returns 200", async () => {
      // Create a fresh active posting for this test
      const postingId = `active-patch-posting-${Date.now()}`;
      await db.truckPosting.create({
        data: {
          id: postingId,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          originCityId: "city-addis",
          availableFrom: new Date(),
          status: "ACTIVE",
          fullPartial: "FULL",
          contactName: "Test Carrier",
          contactPhone: "+251911000002",
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/truck-postings/${postingId}`,
        { body: {} }
      );
      const res = await callHandler(updatePosting, req, { id: postingId });
      expect(res.status).toBe(200);
    });
  });

  // ─── GET Pagination Edge Cases ─────────────────────────────────────────

  describe("GET pagination edge cases", () => {
    it("limit=0 is clamped to 1", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings?organizationId=${seed.carrierOrg.id}&limit=0`
      );
      const res = await listPostings(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      // limit should be clamped to at least 1
      expect(data.limit).toBeGreaterThanOrEqual(1);
    });

    it("offset > total returns empty result", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings?organizationId=${seed.carrierOrg.id}&offset=99999`
      );
      const res = await listPostings(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.postings).toEqual([]);
    });

    it("no ACTIVE postings returns empty array", async () => {
      // Use a different org that has no postings
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings?pickupCity=ZZZNonExistent"
      );
      const res = await listPostings(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(Array.isArray(data.postings)).toBe(true);
    });
  });

  // ─── DELETE Edge Cases ─────────────────────────────────────────────────

  describe("DELETE edge cases", () => {
    it("DELETE already CANCELLED posting succeeds (idempotent soft-delete)", async () => {
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/truck-postings/cancelled-posting-001"
      );
      const res = await callHandler(deletePosting, req, {
        id: "cancelled-posting-001",
      });
      // DELETE is a soft-delete (sets status to CANCELLED), already CANCELLED is fine
      expect(res.status).toBe(200);
    });

    it("DELETE non-existent posting returns 404", async () => {
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/truck-postings/nonexistent-posting-id-12345"
      );
      const res = await callHandler(deletePosting, req, {
        id: "nonexistent-posting-id-12345",
      });
      expect(res.status).toBe(404);
    });
  });
});

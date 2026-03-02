/**
 * Carrier Truck Postings Tests
 *
 * Tests for truck posting CRUD:
 * - POST /api/truck-postings (create) → posting directly, status 201
 * - GET /api/truck-postings (list) → { truckPostings, postings, pagination, total, limit, offset }
 * - GET /api/truck-postings/[id] (get) → posting directly
 * - PATCH /api/truck-postings/[id] (update) → posting directly
 * - DELETE /api/truck-postings/[id] (cancel) → posting directly
 * - GET /api/truck-postings/[id]/matching-loads → { truckPostingId, totalMatches, matches }
 *
 * Business rules:
 * - Truck must be APPROVED before posting (approvalStatus=APPROVED)
 * - ONE_ACTIVE_POST_PER_TRUCK foundation rule → 409
 * - Carrier must own the truck
 * - Rate limit: 100 postings/day/carrier
 * - Origin location must exist and be active
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

// Custom foundation rules mock that returns { valid: true } object shape
// (not boolean true) to match what the route handler expects:
//   const oneActivePostValidation = validateOneActivePostPerTruck({...});
//   if (!oneActivePostValidation.valid) { return 409; }
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
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  validateIdFormat: jest.fn(() => ({ valid: true })),
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: error.errors },
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

describe("Carrier Truck Postings", () => {
  let seed: SeedData;
  let originLocation: any;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-1",
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

    // Create an Ethiopian location for origin city
    originLocation = await db.ethiopianLocation.create({
      data: {
        id: "city-addis",
        name: "Addis Ababa",
        nameEthiopic: "አዲስ አበባ",
        region: "Addis Ababa",
        isActive: true,
        latitude: 9.02,
        longitude: 38.75,
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

  // ─── POST /api/truck-postings ────────────────────────────────────────────

  describe("POST /api/truck-postings - Create Posting", () => {
    it("should create posting for approved truck → 201", async () => {
      // Create a fresh approved truck without existing posting
      const freshTruck = await db.truck.create({
        data: {
          id: "posting-test-truck",
          truckType: "DRY_VAN",
          licensePlate: "POST-TRK-1",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: freshTruck.id,
            originCityId: originLocation.id,
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            fullPartial: "FULL",
            contactName: "Test Driver",
            contactPhone: "+251911222333",
          },
        }
      );

      const res = await createPosting(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      // Response is posting directly (unwrapped)
      expect(data.id).toBeDefined();
      expect(data.truckId).toBe(freshTruck.id);
      expect(data.status).toBe("ACTIVE");
      expect(data.carrierId).toBe(seed.carrierOrg.id);
    });

    it("should reject for unapproved truck → 403", async () => {
      const pendingTruck = await db.truck.create({
        data: {
          id: "pending-truck-post",
          truckType: "FLATBED",
          licensePlate: "PEND-TRK-1",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: pendingTruck.id,
            originCityId: originLocation.id,
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            contactName: "Test Driver",
            contactPhone: "+251911222333",
          },
        }
      );

      const res = await createPosting(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("approved");
    });

    it("should reject duplicate active posting (ONE_ACTIVE_POST_PER_TRUCK) → 409", async () => {
      // seed.truck already has an active posting (seed.truckPosting)
      // Mock the foundation rule to return invalid
      const foundationRules = require("@/lib/foundation-rules");
      foundationRules.validateOneActivePostPerTruck.mockReturnValueOnce({
        valid: false,
        error: "Truck already has an active posting",
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: seed.truck.id,
            originCityId: originLocation.id,
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            contactName: "Test Driver",
            contactPhone: "+251911222333",
          },
        }
      );

      const res = await createPosting(req);
      expect(res.status).toBe(409);

      const data = await parseResponse(res);
      expect(data.rule).toBe("ONE_ACTIVE_POST_PER_TRUCK");
    });

    it("should reject for truck owned by other carrier → 403", async () => {
      const otherOrgTruck = await db.truck.create({
        data: {
          id: "other-org-truck",
          truckType: "TANKER",
          licensePlate: "OTHER-ORG-1",
          capacity: 20000,
          isAvailable: true,
          carrierId: "other-carrier-org",
          createdById: "other-carrier-user",
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: otherOrgTruck.id,
            originCityId: originLocation.id,
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            contactName: "Test Driver",
            contactPhone: "+251911222333",
          },
        }
      );

      const res = await createPosting(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("owned by your organization");
    });

    it("should reject for non-existent truck → 404", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: "nonexistent-truck-id",
            originCityId: originLocation.id,
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            contactName: "Test Driver",
            contactPhone: "+251911222333",
          },
        }
      );

      const res = await createPosting(req);
      expect(res.status).toBe(404);
    });

    it("should return 429 when rate limited", async () => {
      const rateLimit = require("@/lib/rateLimit");
      rateLimit.checkRateLimit.mockResolvedValueOnce({
        allowed: false,
        limit: 100,
        remaining: 0,
        retryAfter: 3600,
        resetTime: Date.now() + 3600000,
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: seed.truck.id,
            originCityId: originLocation.id,
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            contactName: "Test Driver",
            contactPhone: "+251911222333",
          },
        }
      );

      const res = await createPosting(req);
      expect(res.status).toBe(429);
    });

    it("should reject unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: seed.truck.id,
            originCityId: originLocation.id,
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            contactName: "Test Driver",
            contactPhone: "+251911222333",
          },
        }
      );

      const res = await createPosting(req);
      expect([401, 500]).toContain(res.status);
    });

    it("should reject inactive origin location → 400", async () => {
      const inactiveLocation = await db.ethiopianLocation.create({
        data: {
          id: "inactive-city",
          name: "Ghost Town",
          region: "Unknown",
          isActive: false,
        },
      });

      const freshTruck2 = await db.truck.create({
        data: {
          id: "inactive-loc-truck",
          truckType: "DRY_VAN",
          licensePlate: "INACT-LOC-1",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: freshTruck2.id,
            originCityId: inactiveLocation.id,
            availableFrom: new Date(
              Date.now() + 24 * 60 * 60 * 1000
            ).toISOString(),
            contactName: "Test Driver",
            contactPhone: "+251911222333",
          },
        }
      );

      const res = await createPosting(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("Origin location");
    });
  });

  // ─── GET /api/truck-postings ──────────────────────────────────────────────

  describe("GET /api/truck-postings - List Postings", () => {
    it("should return postings with pagination", async () => {
      // GET is public (no auth required for ACTIVE postings)
      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings"
      );

      const res = await listPostings(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.truckPostings).toBeDefined();
      expect(data.postings).toBeDefined(); // backward compat
      expect(Array.isArray(data.truckPostings)).toBe(true);
      expect(data.total).toBeDefined();
      expect(data.limit).toBeDefined();
      expect(data.offset).toBeDefined();
    });

    it("should default to ACTIVE postings only in public view", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings"
      );

      const res = await listPostings(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const posting of data.truckPostings) {
        expect(posting.status).toBe("ACTIVE");
      }
    });

    it("should reject invalid status parameter → 400", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings?status=INVALID"
      );

      const res = await listPostings(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("Invalid status");
    });

    it("carrier sees own postings with organizationId filter", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings?organizationId=${carrierSession.organizationId}`
      );

      const res = await listPostings(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const posting of data.truckPostings) {
        expect(posting.carrierId).toBe(carrierSession.organizationId);
      }
    });

    it("should reject organizationId filter for other org → 403", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings?organizationId=other-org-id"
      );

      const res = await listPostings(req);
      expect(res.status).toBe(403);
    });

    it("should support pagination parameters", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings?limit=5&offset=0"
      );

      const res = await listPostings(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.limit).toBe(5);
      expect(data.offset).toBe(0);
    });
  });

  // ─── GET /api/truck-postings/[id] ─────────────────────────────────────────

  describe("GET /api/truck-postings/[id] - Get Posting", () => {
    it("should return posting details", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}`
      );

      const res = await callHandler(getPosting, req, {
        id: seed.truckPosting.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.id).toBe(seed.truckPosting.id);
    });

    it("should return 404 for non-existent posting", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings/nonexistent"
      );

      const res = await callHandler(getPosting, req, { id: "nonexistent" });
      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/truck-postings/[id] ────────────────────────────────────────

  describe("PATCH /api/truck-postings/[id] - Update Posting", () => {
    it("should update posting fields for owner", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}`,
        {
          body: {
            fullPartial: "PARTIAL",
            notes: "Updated notes",
          },
        }
      );

      const res = await callHandler(updatePosting, req, {
        id: seed.truckPosting.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.fullPartial).toBe("PARTIAL");
    });

    it("should reject update from non-owner → 403", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}`,
        {
          body: { notes: "Unauthorized update" },
        }
      );

      const res = await callHandler(updatePosting, req, {
        id: seed.truckPosting.id,
      });
      expect([403, 404]).toContain(res.status);
    });
  });

  // ─── DELETE /api/truck-postings/[id] (Cancel Posting) ──────────────────────

  describe("DELETE /api/truck-postings/[id] - Cancel Posting", () => {
    it("should cancel posting (soft delete) → status CANCELLED", async () => {
      // Create a posting to cancel
      const postingToCancel = await db.truckPosting.create({
        data: {
          id: "posting-to-cancel",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          originCityId: originLocation.id,
          availableFrom: new Date(),
          status: "ACTIVE",
          fullPartial: "FULL",
          contactName: "Cancel Test",
          contactPhone: "+251911333444",
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/truck-postings/${postingToCancel.id}`
      );

      const res = await callHandler(deletePosting, req, {
        id: postingToCancel.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Route returns { message: "...", posting: { id, status, truckId, carrierId } }
      expect(data.posting.status).toBe("CANCELLED");
    });

    it("should reject cancel from non-owner", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}`
      );

      const res = await callHandler(deletePosting, req, {
        id: seed.truckPosting.id,
      });
      expect([403, 404]).toContain(res.status);
    });
  });
});

/**
 * Matching Loads API Tests
 *
 * Tests for GET /api/truck-postings/[id]/matching-loads
 *
 * Business rules:
 * - Only posting owner, dispatchers, or admins can view matches
 * - Shippers cannot view carrier's matches
 * - Inactive (CANCELLED) postings return 400
 * - Results sorted: within-DH-limits first → by DH-O → by match score
 * - Anonymous loads mask shipper info
 * - Query params: minScore, limit
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
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  mockLoadUtils,
  mockGeo,
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
mockDispatcherPermissions();
mockRbac();
mockApiErrors();
mockLogger();
mockLoadUtils();
mockGeo();

// Custom matchingEngine mock with controllable return value
const mockFindMatchingLoads = jest.fn(() => []);
jest.mock("@/lib/matchingEngine", () => ({
  findMatchingLoads: (...args: unknown[]) => mockFindMatchingLoads(...args),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
}));

// Import handler AFTER mocks
const { GET } = require("@/app/api/truck-postings/[id]/matching-loads/route");

describe("Matching Loads", () => {
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

  const dispatcherSession = createMockSession({
    userId: "dispatcher-user-1",
    email: "dispatcher@test.com",
    role: "DISPATCHER",
    organizationId: "dispatcher-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  const superAdminSession = createMockSession({
    userId: "superadmin-user-1",
    email: "superadmin@test.com",
    role: "SUPER_ADMIN",
    organizationId: "superadmin-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create Ethiopian location records for coordinate lookup
    await db.ethiopianLocation.create({
      data: {
        id: "city-addis",
        name: "Addis Ababa",
        latitude: 9.024,
        longitude: 38.7468,
        isActive: true,
      },
    });

    await db.ethiopianLocation.create({
      data: {
        id: "city-dire-dawa",
        name: "Dire Dawa",
        latitude: 9.6009,
        longitude: 41.8501,
        isActive: true,
      },
    });

    // Update the truck posting with city references
    await db.truckPosting.update({
      where: { id: seed.truckPosting.id },
      data: {
        originCityId: "city-addis",
        destinationCityId: "city-dire-dawa",
        status: "ACTIVE",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
    mockFindMatchingLoads.mockReturnValue([]);
  });

  // ─── Auth & Access ──────────────────────────────────────────────────────────

  describe("Auth & Access", () => {
    it("unauthenticated → 401 or 500", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      expect([401, 500]).toContain(res.status);
    });

    it("shipper cannot view carrier's matches → 403", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      expect(res.status).toBe(403);
    });

    it("posting owner can view matches → 200", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      expect(res.status).toBe(200);
    });

    it("dispatcher can view matches → 200", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      expect(res.status).toBe(200);
    });
  });

  // ─── Not found / status ─────────────────────────────────────────────────────

  describe("Not found / status", () => {
    it("non-existent posting → 404", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings/nonexistent/matching-loads"
      );

      const res = await callHandler(GET, req, { id: "nonexistent" });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("not found");
    });

    it("inactive (CANCELLED) posting → 400", async () => {
      // Create a cancelled posting
      await db.truckPosting.create({
        data: {
          id: "cancelled-posting",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          originCityId: "city-addis",
          originCityName: "Addis Ababa",
          availableFrom: new Date(),
          status: "CANCELLED",
          fullPartial: "FULL",
          contactName: "Test",
          contactPhone: "+251911000002",
        },
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings/cancelled-posting/matching-loads"
      );

      const res = await callHandler(GET, req, { id: "cancelled-posting" });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("inactive");
    });
  });

  // ─── Matching results ───────────────────────────────────────────────────────

  describe("Matching results", () => {
    it("returns truckPostingId, totalMatches, and matches array", async () => {
      mockFindMatchingLoads.mockReturnValue([
        {
          id: seed.load.id,
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          matchScore: 85,
          matchReasons: ["Same city", "Same truck type"],
          isExactMatch: false,
        },
      ]);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.truckPostingId).toBe(seed.truckPosting.id);
      expect(typeof data.totalMatches).toBe("number");
      expect(Array.isArray(data.matches)).toBe(true);
    });

    it("match items have matchScore, matchReasons, isExactMatch", async () => {
      mockFindMatchingLoads.mockReturnValue([
        {
          id: seed.load.id,
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          matchScore: 92,
          matchReasons: ["Exact city match", "Compatible truck type"],
          isExactMatch: true,
        },
      ]);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      const data = await parseResponse(res);

      expect(data.matches.length).toBe(1);
      expect(data.matches[0].matchScore).toBe(92);
      expect(data.matches[0].matchReasons).toEqual([
        "Exact city match",
        "Compatible truck type",
      ]);
      expect(data.matches[0].isExactMatch).toBe(true);
    });

    it("DH distances are calculated", async () => {
      mockFindMatchingLoads.mockReturnValue([
        {
          id: seed.load.id,
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          matchScore: 80,
          matchReasons: ["Same origin"],
          isExactMatch: false,
        },
      ]);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      const data = await parseResponse(res);

      expect(data.matches[0]).toHaveProperty("dhToOriginKm");
      expect(data.matches[0]).toHaveProperty("dhAfterDeliveryKm");
      expect(typeof data.matches[0].dhToOriginKm).toBe("number");
    });
  });

  // ─── Query params ──────────────────────────────────────────────────────────

  describe("Query params", () => {
    it("minScore filters low-score matches", async () => {
      mockFindMatchingLoads.mockReturnValue([
        {
          id: seed.load.id,
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          matchScore: 90,
          matchReasons: ["High match"],
          isExactMatch: false,
        },
      ]);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads?minScore=80`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // findMatchingLoads is called with the minScore param
      expect(mockFindMatchingLoads).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        80
      );
    });

    it("limit caps results", async () => {
      // Return many matches
      const manyMatches = Array.from({ length: 10 }, (_, i) => ({
        id: `load-match-${i}`,
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        matchScore: 90 - i,
        matchReasons: ["Match"],
        isExactMatch: false,
      }));
      mockFindMatchingLoads.mockReturnValue(manyMatches);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads?limit=3`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      const data = await parseResponse(res);

      expect(data.matches.length).toBeLessThanOrEqual(3);
    });

    it("uses defaults when no params provided", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      await callHandler(GET, req, { id: seed.truckPosting.id });

      // Default minScore=50
      expect(mockFindMatchingLoads).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        50
      );
    });
  });

  // ─── Anonymous masking ──────────────────────────────────────────────────────

  describe("Anonymous masking", () => {
    it("isAnonymous load → shipper name masked", async () => {
      // Create an anonymous load
      await db.load.create({
        data: {
          id: "anon-load",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Anonymous cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          isAnonymous: true,
          shipperContactName: "Real Contact",
          shipperContactPhone: "+251911999999",
        },
      });

      mockFindMatchingLoads.mockReturnValue([
        {
          id: "anon-load",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          matchScore: 85,
          matchReasons: ["Match"],
          isExactMatch: false,
          isAnonymous: true,
          shipperContactName: "Real Contact",
          shipperContactPhone: "+251911999999",
          shipper: {
            id: seed.shipperOrg.id,
            name: "Test Shipper Corp",
            isVerified: true,
          },
        },
      ]);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      const data = await parseResponse(res);

      expect(data.matches[0].load.shipper.name).toBe("Anonymous Shipper");
      expect(data.matches[0].load.shipperContactName).toBeNull();
      expect(data.matches[0].load.shipperContactPhone).toBeNull();
    });

    it("non-anonymous → real shipper info present", async () => {
      mockFindMatchingLoads.mockReturnValue([
        {
          id: seed.load.id,
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          matchScore: 80,
          matchReasons: ["Match"],
          isExactMatch: false,
          isAnonymous: false,
          shipper: {
            id: seed.shipperOrg.id,
            name: "Test Shipper Corp",
            isVerified: true,
            contactPhone: "+251911000001",
            contactEmail: "shipper@test.com",
          },
        },
      ]);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      const data = await parseResponse(res);

      // Non-anonymous: shipper info not masked
      expect(data.matches[0].load.shipper.name).not.toBe("Anonymous Shipper");
    });
  });

  // ─── Empty results ──────────────────────────────────────────────────────────

  describe("Empty results", () => {
    it("no matching loads → empty matches array", async () => {
      mockFindMatchingLoads.mockReturnValue([]);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.matches).toEqual([]);
      expect(data.totalMatches).toBe(0);
    });
  });

  // ─── Admin access ──────────────────────────────────────────────────────────

  describe("Admin access", () => {
    it("ADMIN can view any posting's matches", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      expect(res.status).toBe(200);
    });

    it("SUPER_ADMIN can view any posting's matches", async () => {
      setAuthSession(superAdminSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      expect(res.status).toBe(200);
    });
  });

  // ─── DH limit flags ────────────────────────────────────────────────────────

  describe("DH limit flags", () => {
    it("withinDhLimits present in match results", async () => {
      mockFindMatchingLoads.mockReturnValue([
        {
          id: seed.load.id,
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          matchScore: 85,
          matchReasons: ["Match"],
          isExactMatch: false,
        },
      ]);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );

      const res = await callHandler(GET, req, { id: seed.truckPosting.id });
      const data = await parseResponse(res);

      expect(data.matches[0]).toHaveProperty("withinDhLimits");
      expect(typeof data.matches[0].withinDhLimits).toBe("boolean");
    });
  });
});

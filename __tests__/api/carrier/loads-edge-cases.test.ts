/**
 * Carrier Load Edge-Case Tests
 *
 * Tests load marketplace and CRUD boundary conditions:
 * - Marketplace filtering (carrier GET forces POSTED, combined filters)
 * - Load detail access (carrier cannot view DRAFT, can view POSTED)
 * - DELETE state restrictions (blocks ASSIGNED/IN_TRANSIT/DELIVERED)
 * - PATCH edge cases (carrier cannot edit shipper's load)
 * - Pagination edge cases (page beyond total, limit=1, total count)
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
  mockTrustMetrics,
  mockBypassDetection,
  mockLoadStateMachine,
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
mockTrustMetrics();
mockBypassDetection();
mockLoadStateMachine();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
}));

// Import handlers AFTER mocks
const { GET: listLoads } = require("@/app/api/loads/route");
const {
  GET: getLoad,
  PATCH: updateLoad,
  DELETE: deleteLoad,
} = require("@/app/api/loads/[id]/route");

describe("Carrier Load Edge Cases", () => {
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

  beforeAll(async () => {
    seed = await seedTestData();

    // Create loads in various statuses for tests
    await db.load.create({
      data: {
        id: "draft-load",
        status: "DRAFT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Mekelle",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 3000,
        cargoDescription: "Draft load for edge case",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    await db.load.create({
      data: {
        id: "assigned-load",
        status: "ASSIGNED",
        pickupCity: "Hawassa",
        deliveryCity: "Jimma",
        pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Assigned load for delete test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });

    await db.load.create({
      data: {
        id: "intransit-load",
        status: "IN_TRANSIT",
        pickupCity: "Dire Dawa",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        truckType: "CONTAINER",
        weight: 6000,
        cargoDescription: "In transit load for delete test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });

    await db.load.create({
      data: {
        id: "delivered-load",
        status: "DELIVERED",
        pickupCity: "Gondar",
        deliveryCity: "Dessie",
        pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        truckType: "TANKER",
        weight: 7000,
        cargoDescription: "Delivered load for delete test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });

    // Extra posted loads for pagination tests
    for (let i = 1; i <= 3; i++) {
      await db.load.create({
        data: {
          id: `posted-load-${i}`,
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: `City-${i}`,
          pickupDate: new Date(Date.now() + (i + 5) * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + (i + 8) * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 2000 + i * 1000,
          cargoDescription: `Posted load ${i} for pagination`,
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          postedAt: new Date(),
        },
      });
    }
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  // ─── Marketplace Filtering ─────────────────────────────────────────────

  describe("Marketplace filtering", () => {
    it("carrier GET forces POSTED status (ignores ?status=DRAFT)", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?status=DRAFT"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      // Carrier marketplace mode forces POSTED - should not see DRAFT loads
      for (const load of data.loads) {
        expect(load.status).toBe("POSTED");
      }
    });

    it("combined filters truckType+pickupCity work", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?truckType=DRY_VAN&pickupCity=Addis"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(Array.isArray(data.loads)).toBe(true);
    });

    it("empty results return loads=[] and pagination", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?pickupCity=NonExistentCity"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.loads).toEqual([]);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.total).toBe(0);
    });
  });

  // ─── Load Detail Access ───────────────────────────────────────────────

  describe("Load detail access", () => {
    it("carrier cannot view DRAFT load → 404", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/draft-load"
      );
      const res = await callHandler(getLoad, req, { id: "draft-load" });
      expect(res.status).toBe(404);
    });

    it("carrier CAN view POSTED load → 200", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}`
      );
      const res = await callHandler(getLoad, req, { id: seed.load.id });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
    });
  });

  // ─── DELETE State Restrictions ────────────────────────────────────────

  describe("DELETE state restrictions", () => {
    beforeEach(() => {
      setAuthSession(shipperSession);
    });

    it("returns 400 for DELETE ASSIGNED load", async () => {
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/loads/assigned-load"
      );
      const res = await callHandler(deleteLoad, req, { id: "assigned-load" });
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("Cannot delete");
    });

    it("returns 400 for DELETE IN_TRANSIT load", async () => {
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/loads/intransit-load"
      );
      const res = await callHandler(deleteLoad, req, { id: "intransit-load" });
      expect(res.status).toBe(400);
    });

    it("returns 400 for DELETE DELIVERED load", async () => {
      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/loads/delivered-load"
      );
      const res = await callHandler(deleteLoad, req, { id: "delivered-load" });
      expect(res.status).toBe(400);
    });

    it("returns 200 for DELETE POSTED load (allowed)", async () => {
      // Create a fresh posted load for deletion
      await db.load.create({
        data: {
          id: "deletable-posted-load",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Mekelle",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "FLATBED",
          weight: 3000,
          cargoDescription: "Deletable posted load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/loads/deletable-posted-load"
      );
      const res = await callHandler(deleteLoad, req, {
        id: "deletable-posted-load",
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── PATCH Edge Cases ─────────────────────────────────────────────────

  describe("PATCH edge cases", () => {
    it("carrier PATCH on shipper's load → 403", async () => {
      setAuthSession(carrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/loads/${seed.load.id}`,
        { body: { pickupCity: "New City" } }
      );
      const res = await callHandler(updateLoad, req, { id: seed.load.id });
      expect(res.status).toBe(403);
    });

    it("shipper PATCH own DRAFT load → 200", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/loads/draft-load",
        { body: { pickupCity: "Updated City" } }
      );
      const res = await callHandler(updateLoad, req, { id: "draft-load" });
      expect(res.status).toBe(200);
    });
  });

  // ─── Pagination Edge Cases ────────────────────────────────────────────

  describe("Pagination edge cases", () => {
    it("page beyond total returns empty loads", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=999&limit=20"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.loads).toEqual([]);
    });

    it("page=1 with limit=1 returns exactly 1 load", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=1&limit=1"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.loads.length).toBe(1);
    });

    it("total count is correct", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=1&limit=100"
      );
      const res = await listLoads(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      // Total should match the number of POSTED loads visible to carrier
      expect(data.pagination.total).toBeGreaterThan(0);
      expect(data.loads.length).toBe(data.pagination.total);
    });
  });
});

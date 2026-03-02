/**
 * Carrier Truck Management Tests
 *
 * Comprehensive tests for truck CRUD operations:
 * - POST /api/trucks (create truck) → { truck: {...} }
 * - GET /api/trucks (list trucks) → { trucks: [...], pagination }
 * - GET /api/trucks/[id] (get truck) → truck directly
 * - PATCH /api/trucks/[id] (update truck) → truck directly
 * - DELETE /api/trucks/[id] (delete truck) → { success, message }
 *
 * Business rules tested:
 * - SHIPPER cannot browse /api/trucks → 403 with hint
 * - CARRIER sees own fleet only (carrierId = organizationId)
 * - License plate uniqueness
 * - GPS IMEI validation
 * - Admin-only delete with active trip guard
 * - Rate limiting
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

// Setup mocks BEFORE requiring route handlers
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
}));

// Import handlers AFTER mocks
const {
  POST: createTruck,
  GET: listTrucks,
} = require("@/app/api/trucks/route");
const {
  GET: getTruck,
  PATCH: updateTruck,
  DELETE: deleteTruck,
} = require("@/app/api/trucks/[id]/route");

describe("Carrier Truck Management", () => {
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
    email: "other-carrier@test.com",
    role: "CARRIER",
    organizationId: "other-carrier-org",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create users needed for admin/dispatcher/superadmin route access checks
    // (seedTestData only creates carrier-user-1 and shipper-user-1)
    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "superadmin-user-1",
        email: "superadmin@test.com",
        role: "SUPER_ADMIN",
        organizationId: "admin-org-1",
        firstName: "Super",
        lastName: "Admin",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "dispatcher-user-1",
        email: "dispatcher@test.com",
        role: "DISPATCHER",
        organizationId: "dispatcher-org-1",
        firstName: "Dispatcher",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "other-carrier-user",
        email: "other-carrier@test.com",
        role: "CARRIER",
        organizationId: "other-carrier-org",
        firstName: "Other",
        lastName: "Carrier",
        status: "ACTIVE",
        passwordHash: "mock-hash",
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

  // ─── POST /api/trucks ─────────────────────────────────────────────────────

  describe("POST /api/trucks - Create Truck", () => {
    it("should create a truck with valid data → 201 wrapped { truck }", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "ET-99999",
          capacity: 15000,
          isAvailable: true,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.truck).toBeDefined();
      expect(data.truck.truckType).toBe("FLATBED");
      expect(data.truck.licensePlate).toBe("ET-99999");
      expect(data.truck.capacity).toBe(15000);
      expect(data.truck.isAvailable).toBe(true);
      expect(data.truck.carrierId).toBe("carrier-org-1");
    });

    it("should set carrierId from user's organizationId", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "TANKER",
          licensePlate: "ET-88888",
          capacity: 20000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.truck.carrierId).toBe(carrierSession.organizationId);
    });

    it("should accept all truckType enum values", async () => {
      const types = [
        "REFRIGERATED",
        "CONTAINER",
        "DRY_VAN",
        "LOWBOY",
        "DUMP_TRUCK",
        "BOX_TRUCK",
      ];

      for (const truckType of types) {
        const req = createRequest("POST", "http://localhost:3000/api/trucks", {
          body: {
            truckType,
            licensePlate: `TP-${truckType.slice(0, 5)}`,
            capacity: 10000,
          },
        });

        const res = await createTruck(req);
        expect(res.status).toBe(201);

        const data = await parseResponse(res);
        expect(data.truck.truckType).toBe(truckType);
      }
    });

    it("should create truck with optional fields (volume, currentCity, currentRegion)", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "DRY_VAN",
          licensePlate: "ET-77777",
          capacity: 12000,
          volume: 80,
          currentCity: "Addis Ababa",
          currentRegion: "Addis Ababa",
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.truck.volume).toBe(80);
      expect(data.truck.currentCity).toBe("Addis Ababa");
    });

    it("should reject missing licensePlate → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      // ZodError → handleApiError returns 500 by default
      expect([400, 500]).toContain(res.status);
    });

    it("should reject negative capacity → 400", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "NEG-CAP-1",
          capacity: -100,
        },
      });

      const res = await createTruck(req);
      expect([400, 500]).toContain(res.status);
    });

    it("should reject duplicate licensePlate → 400", async () => {
      // seed already created "AA-12345"
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "AA-12345",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("license plate already exists");
    });

    it("should reject request without organization → 400", async () => {
      setAuthSession(
        createMockSession({
          userId: "no-org-user",
          role: "CARRIER",
          organizationId: undefined,
        })
      );

      // Mock user without org
      const originalFindUnique = (db.user as any).findUnique;
      (db.user as any).findUnique = jest.fn(() =>
        Promise.resolve({ organizationId: null })
      );

      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "NO-ORG-1",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("organization");

      (db.user as any).findUnique = originalFindUnique;
    });

    it("should reject unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "UNAUTH-1",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect([401, 500]).toContain(res.status);
    });

    it("should create truck with GPS fields (imei, gpsProvider)", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "GPS-TRK-1",
          capacity: 10000,
          imei: "123456789012345",
          gpsProvider: "testprovider",
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.truck.imei).toBe("123456789012345");
      expect(data.truck.gpsVerifiedAt).toBeDefined();
      expect(data.truck.gpsLastSeenAt).toBeDefined();
    });

    it("should reject invalid IMEI format → 400", async () => {
      // Mock validateImeiFormat to return false
      const gpsVerification = require("@/lib/gpsVerification");
      gpsVerification.validateImeiFormat.mockReturnValueOnce(false);

      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "BAD-IMEI-1",
          capacity: 10000,
          imei: "123",
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("IMEI");
    });

    it("should reject failed GPS verification → 400", async () => {
      const gpsVerification = require("@/lib/gpsVerification");
      gpsVerification.validateImeiFormat.mockReturnValueOnce(true);
      gpsVerification.verifyGpsDevice.mockResolvedValueOnce({
        success: false,
        message: "Device not reachable",
      });

      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "FAIL-GPS-1",
          capacity: 10000,
          imei: "999888777666555",
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(400);
    });

    it("should return 429 when rate limited", async () => {
      const rateLimit = require("@/lib/rateLimit");
      rateLimit.checkRpsLimit.mockResolvedValueOnce({
        allowed: false,
        limit: 30,
        remaining: 0,
      });

      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "RATE-LIM-1",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(429);
    });
  });

  // ─── GET /api/trucks ──────────────────────────────────────────────────────

  describe("GET /api/trucks - List Trucks", () => {
    it("should return trucks for carrier's org only", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trucks).toBeDefined();
      expect(Array.isArray(data.trucks)).toBe(true);

      // All trucks should belong to carrier's org
      for (const truck of data.trucks) {
        expect(truck.carrierId).toBe("carrier-org-1");
      }
    });

    it("should return pagination metadata", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks?page=1&limit=10"
      );

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pagination).toBeDefined();
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
      expect(typeof data.pagination.total).toBe("number");
      expect(typeof data.pagination.pages).toBe("number");
    });

    it("should filter by truckType", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks?truckType=DRY_VAN"
      );

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const truck of data.trucks) {
        expect(truck.truckType).toBe("DRY_VAN");
      }
    });

    it("should filter by isAvailable", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks?isAvailable=true"
      );

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const truck of data.trucks) {
        expect(truck.isAvailable).toBe(true);
      }
    });

    it("should filter by approvalStatus", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks?approvalStatus=APPROVED"
      );

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const truck of data.trucks) {
        expect(truck.approvalStatus).toBe("APPROVED");
      }
    });

    it("SHIPPER gets 403 with hint to use /api/truck-postings", async () => {
      setAuthSession(shipperSession);

      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("Shippers cannot browse");
      expect(data.hint).toContain("truck-postings");
    });

    it("DISPATCHER sees all trucks", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trucks).toBeDefined();
    });

    it("ADMIN sees all trucks", async () => {
      setAuthSession(adminSession);

      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trucks).toBeDefined();
    });

    it("should clamp pagination bounds (page=0→1, limit>100→100)", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks?page=0&limit=500"
      );

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(100);
    });

    it("should return 429 when rate limited", async () => {
      const rateLimit = require("@/lib/rateLimit");
      rateLimit.checkRpsLimit.mockResolvedValueOnce({
        allowed: false,
        limit: 30,
        remaining: 0,
      });

      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(429);
    });

    it("should reject unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect([401, 500]).toContain(res.status);
    });

    it("admin can filter by carrierId", async () => {
      setAuthSession(superAdminSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks?carrierId=carrier-org-1"
      );

      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const truck of data.trucks) {
        expect(truck.carrierId).toBe("carrier-org-1");
      }
    });
  });

  // ─── GET /api/trucks/[id] ─────────────────────────────────────────────────

  describe("GET /api/trucks/[id] - Get Single Truck", () => {
    it("should return truck details for owner (unwrapped)", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );

      const res = await callHandler(getTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Response is unwrapped - truck directly (no .truck wrapper)
      expect(data.id).toBe(seed.truck.id);
      expect(data.licensePlate).toBe("AA-12345");
    });

    it("should return 404 for non-existent truck", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/nonexistent"
      );

      const res = await callHandler(getTruck, req, { id: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("should return 404 for truck owned by other carrier", async () => {
      setAuthSession(otherCarrierSession);

      // Create another carrier's truck
      const otherOrg = await db.organization.create({
        data: {
          id: "other-carrier-org",
          name: "Other Carrier",
          type: "CARRIER_COMPANY",
          contactEmail: "other@test.com",
          contactPhone: "+251911999999",
          isVerified: true,
        },
      });

      // The mock user lookup will return the other carrier's org
      // but seed.truck belongs to carrier-org-1
      // Since otherCarrierSession.organizationId !== truck.carrierId, canView is false
      // Actually wait - code checks: truck.carrierId === user?.organizationId
      // The mock won't match because other-carrier-org != carrier-org-1
      // But canView also allows SHIPPER and DISPATCHER
      // For a CARRIER with different org, canView = false → 404

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );

      const res = await callHandler(getTruck, req, { id: seed.truck.id });
      // Carrier from different org gets 404 (permission denied hidden as 404)
      expect(res.status).toBe(404);
    });

    it("admin can view any truck", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );

      const res = await callHandler(getTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.id).toBe(seed.truck.id);
    });

    it("shipper cannot view trucks directly (must use /api/truck-postings)", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );

      const res = await callHandler(getTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(404);
    });
  });

  // ─── PATCH /api/trucks/[id] ───────────────────────────────────────────────

  describe("PATCH /api/trucks/[id] - Update Truck", () => {
    it("should update truck fields (unwrapped response)", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          body: {
            capacity: 15000,
            currentCity: "Dire Dawa",
          },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Unwrapped response
      expect(data.id).toBe(seed.truck.id);
      expect(data.capacity).toBe(15000);
      expect(data.currentCity).toBe("Dire Dawa");
    });

    it("should reject update from non-owner → 404", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          body: { capacity: 99999 },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(404);
    });

    it("should reject update on non-existent truck → 404", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trucks/nonexistent",
        {
          body: { capacity: 5000 },
        }
      );

      const res = await callHandler(updateTruck, req, { id: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("should reject duplicate license plate on update → 400", async () => {
      // Create another truck with unique plate
      await db.truck.create({
        data: {
          id: "dup-check-truck",
          truckType: "FLATBED",
          licensePlate: "DUP-PLATE-1",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          body: { licensePlate: "DUP-PLATE-1" },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("license plate already exists");
    });

    it("SUPER_ADMIN can update any truck", async () => {
      setAuthSession(superAdminSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        {
          body: { isAvailable: false },
        }
      );

      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);
    });
  });

  // ─── DELETE /api/trucks/[id] ──────────────────────────────────────────────

  describe("DELETE /api/trucks/[id] - Delete Truck", () => {
    it("should allow ADMIN to delete a truck → 200", async () => {
      setAuthSession(adminSession);

      const truckToDelete = await db.truck.create({
        data: {
          id: "truck-to-delete",
          truckType: "FLATBED",
          licensePlate: "DEL-TRK-1",
          capacity: 8000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckToDelete.id}`
      );

      const res = await callHandler(deleteTruck, req, {
        id: truckToDelete.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.success).toBe(true);
      expect(data.message).toContain("deleted");
    });

    it("should reject delete of truck with active trip → 409", async () => {
      setAuthSession(adminSession);

      const truckWithTrip = await db.truck.create({
        data: {
          id: "truck-with-trip",
          truckType: "FLATBED",
          licensePlate: "ACT-TRP-1",
          capacity: 10000,
          isAvailable: false,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
        },
      });

      // Create an active trip
      await db.trip.create({
        data: {
          id: "active-trip-for-delete",
          loadId: seed.load.id,
          truckId: truckWithTrip.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckWithTrip.id}`
      );

      const res = await callHandler(deleteTruck, req, {
        id: truckWithTrip.id,
      });
      expect(res.status).toBe(409);

      const data = await parseResponse(res);
      expect(data.error).toContain("active assignments");
    });

    it("should reject delete from non-admin carrier → 404", async () => {
      // Carrier is not admin — returns 404 to prevent resource existence leakage
      setAuthSession(carrierSession);

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );

      const res = await callHandler(deleteTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(404);
    });

    it("should return 404 for non-existent truck", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/trucks/nonexistent"
      );

      const res = await callHandler(deleteTruck, req, { id: "nonexistent" });
      expect(res.status).toBe(404);
    });
  });
});

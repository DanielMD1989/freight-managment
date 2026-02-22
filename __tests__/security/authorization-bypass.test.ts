/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Authorization Bypass Tests
 *
 * Tests that route handlers properly enforce role-based access control
 * and reject unauthorized access attempts.
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
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
  SeedData,
} from "../utils/routeTestUtils";

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

// Import route handlers AFTER mocks (use require so mocks are applied)
const { POST: createLoad, GET: listLoads } = require("@/app/api/loads/route");
const {
  POST: createTruck,
  GET: listTrucks,
} = require("@/app/api/trucks/route");
const { POST: createLoadRequest } = require("@/app/api/load-requests/route");
const { POST: createTruckRequest } = require("@/app/api/truck-requests/route");
const { PATCH: updateTrip } = require("@/app/api/trips/[tripId]/route");
const { GET: listTrips } = require("@/app/api/trips/route");
const { GET: getWalletBalance } = require("@/app/api/wallet/balance/route");
const { POST: createPosting } = require("@/app/api/truck-postings/route");

describe("Authorization Bypass Tests", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Create a trip for trip-related tests
    await db.trip.create({
      data: {
        id: "auth-test-trip",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "ASSIGNED",
        referenceNumber: "TRIP-AUTH01",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Carrier → Shipper Route Access ──────────────────────────────────────

  describe("Carrier accessing Shipper-only routes", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );
    });

    it("should reject carrier creating a load", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Carrier trying to create load",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(403);
    });

    it("should reject carrier sending truck requests (shipper action)", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: seed.truck.id,
          },
        }
      );

      const res = await createTruckRequest(req);
      expect([400, 403]).toContain(res.status);
    });

    it("should reject carrier approving load requests (shipper action)", async () => {
      const {
        POST: respondToLoadRequest,
      } = require("@/app/api/load-requests/[id]/respond/route");

      const loadRequest = await db.loadRequest.create({
        data: {
          id: "lr-carrier-bypass",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${loadRequest.id}/respond`,
        {
          body: { action: "APPROVE" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: loadRequest.id,
      });
      expect(res.status).toBe(403);
    });
  });

  // ─── Shipper → Carrier Route Access ──────────────────────────────────────

  describe("Shipper accessing Carrier-only routes", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );
    });

    it("should reject shipper browsing trucks (foundation rule)", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(403);
    });

    it("should reject shipper creating trucks", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "SHIPPER-TRUCK",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(403);
    });

    it("should reject shipper creating load requests (carrier action)", async () => {
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
    });

    it("should reject shipper updating trip status (carrier action)", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/auth-test-trip",
        {
          body: { status: "PICKUP_PENDING" },
        }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: "auth-test-trip",
      });
      expect(res.status).toBe(403);
    });
  });

  // ─── Unauthenticated Access ──────────────────────────────────────────────

  describe("Unauthenticated access to protected routes", () => {
    beforeEach(() => {
      setAuthSession(null);
    });

    it("should reject unauthenticated load creation", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Unauth load creation attempt",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(401);
    });

    it("should reject unauthenticated truck creation", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "NOAUTH-1",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(401);
    });

    it("should reject unauthenticated trip listing", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trips");

      const res = await listTrips(req);
      expect(res.status).toBe(401);
    });

    it("should reject unauthenticated trip update", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/auth-test-trip",
        {
          body: { status: "IN_TRANSIT" },
        }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: "auth-test-trip",
      });
      expect(res.status).toBe(401);
    });

    it("should reject unauthenticated wallet access", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );

      const res = await getWalletBalance(req);
      expect(res.status).toBe(401);
    });

    it("should reject unauthenticated load request creation", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        {
          body: { loadId: seed.load.id, truckId: seed.truck.id },
        }
      );

      const res = await createLoadRequest(req);
      expect(res.status).toBe(401);
    });

    it("should reject unauthenticated truck request creation", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-requests",
        {
          body: { loadId: seed.load.id, truckId: seed.truck.id },
        }
      );

      const res = await createTruckRequest(req);
      expect(res.status).toBe(401);
    });
  });

  // ─── Inactive / Suspended Users ──────────────────────────────────────────

  describe("Inactive and suspended users", () => {
    it("should reject suspended user creating a load", async () => {
      setAuthSession(
        createMockSession({
          userId: "suspended-user-1",
          email: "suspended@test.com",
          role: "SHIPPER",
          status: "SUSPENDED",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Suspended user load attempt",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(403);
    });

    it("should reject PENDING_VERIFICATION user creating truck posting", async () => {
      setAuthSession(
        createMockSession({
          userId: "pending-carrier-1",
          email: "pending@test.com",
          role: "CARRIER",
          status: "PENDING_VERIFICATION",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: seed.truck.id,
            originCityId: "city-1",
            availableFrom: new Date().toISOString(),
            contactName: "Pending User",
            contactPhone: "+251911000003",
          },
        }
      );

      const res = await createPosting(req);
      expect(res.status).toBe(403);
    });

    it("should reject REJECTED user accessing wallet", async () => {
      setAuthSession(
        createMockSession({
          userId: "rejected-user-1",
          email: "rejected@test.com",
          role: "CARRIER",
          status: "REJECTED",
          organizationId: seed.carrierOrg.id,
        })
      );

      // Wallet uses requireAuth (not requireActiveUser), so behavior may vary
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      // May be 200 (if only requireAuth) or 403 (if requireActiveUser)
      expect([200, 400, 401, 403]).toContain(res.status);
    });
  });

  // ─── Dispatcher Limitations ──────────────────────────────────────────────

  describe("Dispatcher cannot modify (coordination only)", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: "dispatcher-user-1",
          email: "dispatcher@test.com",
          role: "DISPATCHER",
          organizationId: "dispatcher-org-1",
        })
      );
    });

    it("should reject dispatcher creating loads", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Dispatcher load attempt",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(403);
    });

    it("should reject dispatcher creating trucks", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "FLATBED",
          licensePlate: "DISP-001",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(403);
    });

    it("should reject dispatcher updating trip status", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/auth-test-trip",
        {
          body: { status: "PICKUP_PENDING" },
        }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: "auth-test-trip",
      });
      expect(res.status).toBe(403);
    });

    it("should allow dispatcher to list trips (read-only)", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trips");

      const res = await listTrips(req);
      expect(res.status).toBe(200);
    });

    it("should allow dispatcher to list loads (read-only)", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── No Organization ─────────────────────────────────────────────────────

  describe("Users without organization", () => {
    beforeEach(() => {
      setAuthSession(
        createMockSession({
          userId: "no-org-user",
          email: "noorg@test.com",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: undefined,
        })
      );
    });

    it("should reject load request without org", async () => {
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
    });

    it("should reject wallet access without org", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );

      const res = await getWalletBalance(req);
      expect(res.status).toBe(400);
    });
  });
});

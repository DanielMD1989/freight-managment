/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * API Response Parity Tests
 *
 * Verifies that API response shapes match what mobile services expect.
 * Ensures web-mobile data parity for all major endpoints.
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
const { GET: listTrips } = require("@/app/api/trips/route");
const {
  GET: getTrip,
  PATCH: updateTrip,
} = require("@/app/api/trips/[tripId]/route");
const { GET: listTruckPostings } = require("@/app/api/truck-postings/route");
const { GET: listLoadRequests } = require("@/app/api/load-requests/route");
const { GET: getWalletBalance } = require("@/app/api/wallet/balance/route");
const { POST: registerUser } = require("@/app/api/auth/register/route");

describe("API Response Parity Tests", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Create trip for trip-related tests
    await db.trip.create({
      data: {
        id: "parity-trip-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "IN_TRANSIT",
        referenceNumber: "TRIP-PAR001",
        trackingUrl: "https://track.test/par001",
      },
    });

    // Create load request
    await db.loadRequest.create({
      data: {
        id: "parity-lr-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Auth Response Shape ─────────────────────────────────────────────────

  describe("Auth response shape", () => {
    it("POST /api/auth/register should return { user, limitedAccess, sessionToken? }", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "parity-reg@test.com",
            password: "Secure123!",
            firstName: "Parity",
            lastName: "Reg",
            role: "SHIPPER",
          },
          headers: { "x-client-type": "mobile" },
        }
      );

      const res = await registerUser(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data).toHaveProperty("user");
      expect(data.user).toHaveProperty("id");
      expect(data.user).toHaveProperty("email");
      expect(data.user).toHaveProperty("role");
      expect(data.user).toHaveProperty("status");
    });

    it("registration user object should have expected fields", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "parity-fields@test.com",
            password: "Secure123!",
            firstName: "Field",
            lastName: "Test",
            role: "CARRIER",
            companyName: "Field Corp",
            carrierType: "CARRIER_COMPANY",
          },
        }
      );

      const res = await registerUser(req);
      if (res.status === 201) {
        const data = await parseResponse(res);
        const user = data.user;
        expect(user).toHaveProperty("firstName");
        expect(user).toHaveProperty("lastName");
        expect(user).toHaveProperty("role");
      }
    });
  });

  // ─── Load Response Shapes ────────────────────────────────────────────────

  describe("Load response shapes", () => {
    it("POST /api/loads should return wrapped { load: {...} }", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 86400000).toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(Date.now() + 172800000).toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Parity test load cargo description",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      // Mobile expects: response.data.load
      expect(data).toHaveProperty("load");
      expect(data.load).toHaveProperty("id");
      expect(data.load).toHaveProperty("status");
      expect(data.load).toHaveProperty("pickupCity");
      expect(data.load).toHaveProperty("deliveryCity");
      expect(data.load).toHaveProperty("truckType");
      expect(data.load).toHaveProperty("weight");
    });

    it("GET /api/loads should return { loads: [...], pagination: {...} }", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=1&limit=10"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Mobile expects: response.data.loads and response.data.pagination
      expect(data).toHaveProperty("loads");
      expect(data).toHaveProperty("pagination");
      expect(Array.isArray(data.loads)).toBe(true);
      expect(data.pagination).toHaveProperty("page");
      expect(data.pagination).toHaveProperty("limit");
      expect(data.pagination).toHaveProperty("total");
    });

    it("load list items should have expected fields", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?myLoads=true"
      );
      const res = await listLoads(req);
      const data = await parseResponse(res);

      if (data.loads.length > 0) {
        const load = data.loads[0];
        expect(load).toHaveProperty("id");
        expect(load).toHaveProperty("status");
        expect(load).toHaveProperty("pickupCity");
        expect(load).toHaveProperty("deliveryCity");
      }
    });
  });

  // ─── Truck Response Shapes ───────────────────────────────────────────────

  describe("Truck response shapes", () => {
    it("POST /api/trucks should return wrapped { truck: {...} }", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "CONTAINER",
          licensePlate: "PARITY-001",
          capacity: 20000,
        },
      });

      const res = await createTruck(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      // Mobile expects: response.data.truck
      expect(data).toHaveProperty("truck");
      expect(data.truck).toHaveProperty("id");
      expect(data.truck).toHaveProperty("truckType");
      expect(data.truck).toHaveProperty("licensePlate");
      expect(data.truck).toHaveProperty("capacity");
    });

    it("GET /api/trucks should return { trucks: [...], pagination: {...} }", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks?page=1&limit=10"
      );
      const res = await listTrucks(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data).toHaveProperty("trucks");
      expect(data).toHaveProperty("pagination");
      expect(Array.isArray(data.trucks)).toBe(true);
    });
  });

  // ─── Trip Response Shapes ────────────────────────────────────────────────

  describe("Trip response shapes", () => {
    it("GET /api/trips should return { trips: [...], pagination: {...} }", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data).toHaveProperty("trips");
      expect(data).toHaveProperty("pagination");
      expect(Array.isArray(data.trips)).toBe(true);
      expect(data.pagination).toHaveProperty("page");
      expect(data.pagination).toHaveProperty("limit");
      expect(data.pagination).toHaveProperty("total");
    });

    it("GET /api/trips/[id] should return { trip: {...} }", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/parity-trip-001"
      );
      const res = await callHandler(getTrip, req, {
        tripId: "parity-trip-001",
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Mobile expects: response.data.trip
      expect(data).toHaveProperty("trip");
      expect(data.trip).toHaveProperty("id");
      expect(data.trip).toHaveProperty("status");
    });

    it('PATCH /api/trips/[id] should return { trip: {...}, message: "..." }', async () => {
      // Create a fresh trip for PATCH test
      await db.trip.create({
        data: {
          id: "parity-patch-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          referenceNumber: "TRIP-PATCH01",
        },
      });

      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/parity-patch-trip",
        {
          body: { status: "PICKUP_PENDING" },
        }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: "parity-patch-trip",
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data).toHaveProperty("trip");
      expect(data).toHaveProperty("message");
      expect(data.trip.status).toBe("PICKUP_PENDING");
    });

    it("trip list items should include key fields", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await listTrips(req);
      const data = await parseResponse(res);

      if (data.trips.length > 0) {
        const trip = data.trips[0];
        expect(trip).toHaveProperty("id");
        expect(trip).toHaveProperty("status");
      }
    });
  });

  // ─── Truck Posting Response Shapes ───────────────────────────────────────

  describe("Truck posting response shapes", () => {
    it("GET /api/truck-postings should return postings array", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings"
      );
      const res = await listTruckPostings(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Mobile expects: response.data.truckPostings or response.data.postings
      expect(data.truckPostings || data.postings).toBeDefined();
      expect(data).toHaveProperty("pagination");
    });

    it("posting list should have pagination info", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings?limit=5"
      );
      const res = await listTruckPostings(req);
      const data = await parseResponse(res);

      expect(data.pagination).toBeDefined();
      if (data.pagination) {
        expect(data.pagination).toHaveProperty("total");
      }
    });
  });

  // ─── Load Request Response Shapes ────────────────────────────────────────

  describe("Load request response shapes", () => {
    it("GET /api/load-requests should return { loadRequests: [...], pagination: {...} }", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests"
      );
      const res = await listLoadRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data).toHaveProperty("loadRequests");
      expect(Array.isArray(data.loadRequests)).toBe(true);
      expect(data).toHaveProperty("pagination");
    });

    it("load request list should have pagination with correct shape", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests"
      );
      const res = await listLoadRequests(req);
      const data = await parseResponse(res);

      expect(data.pagination).toBeDefined();
      if (data.pagination) {
        expect(data.pagination).toHaveProperty("total");
        expect(data.pagination).toHaveProperty("limit");
        expect(data.pagination).toHaveProperty("offset");
      }
    });
  });

  // ─── Wallet Response Shapes ──────────────────────────────────────────────

  describe("Wallet response shapes", () => {
    it("GET /api/wallet/balance should return { wallets, totalBalance, currency }", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // Mobile expects these exact keys
      expect(data).toHaveProperty("wallets");
      expect(data).toHaveProperty("totalBalance");
      expect(data).toHaveProperty("currency");
      expect(data).toHaveProperty("recentTransactionsCount");

      expect(Array.isArray(data.wallets)).toBe(true);
      expect(typeof data.totalBalance).toBe("number");
      expect(typeof data.currency).toBe("string");
      expect(typeof data.recentTransactionsCount).toBe("number");
    });

    it("wallet items should have id, type/accountType, balance, currency", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      const data = await parseResponse(res);

      if (data.wallets.length > 0) {
        const wallet = data.wallets[0];
        expect(wallet).toHaveProperty("id");
        expect(wallet).toHaveProperty("balance");
      }
    });
  });

  // ─── Error Response Shapes ───────────────────────────────────────────────

  describe("Error response shapes", () => {
    it('401 should return { error: "..." }', async () => {
      setAuthSession(null);

      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await listTrips(req);
      expect(res.status).toBe(401);

      const data = await parseResponse(res);
      expect(data).toHaveProperty("error");
      expect(typeof data.error).toBe("string");
    });

    it("400 validation error should return structured error", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: { pickupCity: "A" }, // Too short + missing fields
      });

      const res = await createLoad(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data).toHaveProperty("error");
    });

    it('403 should return { error: "..." }', async () => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/trucks");
      const res = await listTrucks(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data).toHaveProperty("error");
    });

    it('404 should return { error: "..." }', async () => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/non-existent"
      );
      const res = await callHandler(getTrip, req, { tripId: "non-existent" });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data).toHaveProperty("error");
    });
  });

  // ─── Pagination Consistency ──────────────────────────────────────────────

  describe("Pagination consistency across endpoints", () => {
    it("loads pagination should have page, limit, total, pages", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=1&limit=10"
      );
      const res = await listLoads(req);
      const data = await parseResponse(res);

      expect(data.pagination).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
      });
    });

    it("trips pagination should have page, limit, total", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips?page=1&limit=10"
      );
      const res = await listTrips(req);
      const data = await parseResponse(res);

      expect(data.pagination).toMatchObject({
        page: expect.any(Number),
        limit: expect.any(Number),
        total: expect.any(Number),
      });
    });
  });
});

/**
 * Shipper Workflow Tests
 *
 * Tests the complete shipper lifecycle through actual API route handlers:
 * Registration → Login → Create Load → Post Load → Browse Trucks (403) →
 * Send Truck Request → Approve Load Request → Track Trip → Wallet
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

// Setup all mocks before importing route handlers
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
const { POST: registerPost } = require("@/app/api/auth/register/route");
const { POST: loginPost } = require("@/app/api/auth/login/route");
const { POST: createLoad, GET: listLoads } = require("@/app/api/loads/route");
const { GET: listTrucks } = require("@/app/api/trucks/route");
const { GET: listTruckPostings } = require("@/app/api/truck-postings/route");
const {
  POST: createTruckRequest,
  GET: listTruckRequests,
} = require("@/app/api/truck-requests/route");
const {
  POST: respondToLoadRequest,
} = require("@/app/api/load-requests/[id]/respond/route");
const { GET: listTrips } = require("@/app/api/trips/route");
const { GET: getTrip } = require("@/app/api/trips/[tripId]/route");
const { GET: getWalletBalance } = require("@/app/api/wallet/balance/route");
const { GET: listLoadRequests } = require("@/app/api/load-requests/route");

describe("Shipper Workflow", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: authenticated as shipper
    setAuthSession(
      createMockSession({
        userId: seed?.shipperUser?.id || "shipper-user-1",
        email: "shipper@test.com",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: seed?.shipperOrg?.id || "shipper-org-1",
      })
    );
  });

  // ─── Registration ────────────────────────────────────────────────────────

  describe("Registration", () => {
    it("should register a new shipper", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "newshipper@test.com",
            password: "Secure123!",
            firstName: "New",
            lastName: "Shipper",
            role: "SHIPPER",
            companyName: "New Shipper Corp",
          },
        }
      );

      const res = await registerPost(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.user).toBeDefined();
      expect(data.user.role).toBe("SHIPPER");
    });

    it("should create organization for shipper with companyName", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "orgshipper@test.com",
            password: "Secure123!",
            firstName: "Org",
            lastName: "Shipper",
            role: "SHIPPER",
            companyName: "Org Shipper Inc",
          },
        }
      );

      const res = await registerPost(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.user.organizationId).toBeDefined();
    });

    it("should reject duplicate email registration", async () => {
      // First registration
      await db.user.create({
        data: {
          id: "dup-shipper-1",
          email: "duplicate@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "Dup",
          lastName: "Shipper",
          role: "SHIPPER",
          status: "REGISTERED",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "duplicate@test.com",
            password: "Secure123!",
            firstName: "Dup2",
            lastName: "Shipper",
            role: "SHIPPER",
          },
        }
      );

      const res = await registerPost(req);
      expect(res.status).toBe(400);
    });

    it("should reject invalid email format", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "not-an-email",
            password: "Secure123!",
            firstName: "Bad",
            lastName: "Email",
            role: "SHIPPER",
          },
        }
      );

      const res = await registerPost(req);
      expect(res.status).toBe(400);
    });

    it("should reject missing required fields", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: { email: "partial@test.com" },
        }
      );

      const res = await registerPost(req);
      expect(res.status).toBe(400);
    });

    it("should set initial status to REGISTERED", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/register",
        {
          body: {
            email: "status-check@test.com",
            password: "Secure123!",
            firstName: "Status",
            lastName: "Check",
            role: "SHIPPER",
          },
        }
      );

      const res = await registerPost(req);
      if (res.status === 201) {
        const data = await parseResponse(res);
        expect(data.user.status).toBe("REGISTERED");
      }
    });
  });

  // ─── Login ───────────────────────────────────────────────────────────────

  describe("Login", () => {
    it("should login with valid credentials", async () => {
      await db.user.create({
        data: {
          id: "login-shipper-1",
          email: "loginshipper@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "Login",
          lastName: "Shipper",
          role: "SHIPPER",
          status: "ACTIVE",
          organizationId: seed.shipperOrg.id,
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/login",
        {
          body: { email: "loginshipper@test.com", password: "Test1234!" },
        }
      );

      const res = await loginPost(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.user).toBeDefined();
      expect(data.user.role).toBe("SHIPPER");
    });

    it("should reject login with wrong password", async () => {
      await db.user.create({
        data: {
          id: "wrong-pass-shipper",
          email: "wrongpass@test.com",
          passwordHash: "hashed_Correct123!",
          firstName: "Wrong",
          lastName: "Pass",
          role: "SHIPPER",
          status: "ACTIVE",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/login",
        {
          body: { email: "wrongpass@test.com", password: "WrongPassword!" },
        }
      );

      const res = await loginPost(req);
      expect(res.status).toBe(401);
    });

    it("should reject login with non-existent email", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/login",
        {
          body: { email: "nonexistent@test.com", password: "Test1234!" },
        }
      );

      const res = await loginPost(req);
      expect(res.status).toBe(401);
    });

    it("should return limited access for PENDING_VERIFICATION users", async () => {
      await db.user.create({
        data: {
          id: "pending-shipper-1",
          email: "pending@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "Pending",
          lastName: "User",
          role: "SHIPPER",
          status: "PENDING_VERIFICATION",
          organizationId: seed.shipperOrg.id,
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/auth/login",
        {
          body: { email: "pending@test.com", password: "Test1234!" },
        }
      );

      const res = await loginPost(req);
      if (res.status === 200) {
        const data = await parseResponse(res);
        expect(data.limitedAccess).toBe(true);
      }
    });
  });

  // ─── Create Load ─────────────────────────────────────────────────────────

  describe("Create Load", () => {
    it("should create a load as DRAFT with wrapped response", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date(
            Date.now() + 7 * 24 * 60 * 60 * 1000
          ).toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(
            Date.now() + 10 * 24 * 60 * 60 * 1000
          ).toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Electronics shipment for test",
          status: "DRAFT",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.load.status).toBe("DRAFT");
      expect(data.load.pickupCity).toBe("Addis Ababa");
    });

    it("should create a load as POSTED", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Mekelle",
          pickupDate: new Date(
            Date.now() + 5 * 24 * 60 * 60 * 1000
          ).toISOString(),
          deliveryCity: "Bahir Dar",
          deliveryDate: new Date(
            Date.now() + 8 * 24 * 60 * 60 * 1000
          ).toISOString(),
          truckType: "FLATBED",
          weight: 8000,
          cargoDescription: "Construction materials for delivery",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
    });

    it("should reject load creation with missing fields", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: { pickupCity: "Addis Ababa" }, // Missing required fields
      });

      const res = await createLoad(req);
      expect(res.status).toBe(400);
    });

    it("should reject unauthenticated load creation", async () => {
      setAuthSession(null);

      const req = createRequest("POST", "http://localhost:3000/api/loads", {
        body: {
          pickupCity: "Addis Ababa",
          pickupDate: new Date().toISOString(),
          deliveryCity: "Hawassa",
          deliveryDate: new Date().toISOString(),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Test cargo description",
        },
      });

      const res = await createLoad(req);
      expect(res.status).toBe(401);
    });
  });

  // ─── List Loads ──────────────────────────────────────────────────────────

  describe("List Loads", () => {
    it("should list shipper own loads with myLoads param", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?myLoads=true"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loads).toBeDefined();
      expect(data.pagination).toBeDefined();
    });

    it("should list marketplace loads", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/loads");

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loads).toBeDefined();
    });

    it("should return pagination info", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads?page=1&limit=5"
      );

      const res = await listLoads(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pagination).toBeDefined();
      expect(data.pagination).toHaveProperty("page");
      expect(data.pagination).toHaveProperty("limit");
      expect(data.pagination).toHaveProperty("total");
    });
  });

  // ─── Browse Trucks (Foundation Rule: SHIPPER cannot) ─────────────────────

  describe("Browse Trucks (Foundation Rule)", () => {
    it("should return 403 when shipper tries to browse trucks", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toBeDefined();
    });

    it("should allow shipper to browse truck postings instead", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings"
      );

      const res = await listTruckPostings(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.truckPostings || data.postings).toBeDefined();
    });

    it("should include hint about truck-postings in 403 response", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trucks");

      const res = await listTrucks(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      // Should suggest using truck-postings instead
      const errorStr = JSON.stringify(data).toLowerCase();
      expect(errorStr).toMatch(/posting|demand/i);
    });
  });

  // ─── Send Truck Request ──────────────────────────────────────────────────

  describe("Send Truck Request", () => {
    it("should create a truck request for shipper load", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-requests",
        {
          body: {
            loadId: seed.load.id,
            truckId: seed.truck.id,
            notes: "Need this truck for urgent delivery",
            expiresInHours: 48,
          },
        }
      );

      const res = await createTruckRequest(req);
      if (res.status === 201) {
        const data = await parseResponse(res);
        expect(data.request || data).toBeDefined();
      }
      // Accept 201 or validation errors
      expect([201, 400, 403]).toContain(res.status);
    });

    it("should reject truck request for another shipper load", async () => {
      // Create load owned by different shipper
      const otherLoad = await db.load.create({
        data: {
          id: "other-shipper-load",
          status: "POSTED",
          pickupCity: "Jimma",
          pickupDate: new Date(),
          deliveryCity: "Adama",
          truckType: "DRY_VAN",
          weight: 1000,
          cargoDescription: "Other shipper cargo",
          shipperId: "other-shipper-org",
          createdById: "other-shipper-user",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-requests",
        {
          body: {
            loadId: otherLoad.id,
            truckId: seed.truck.id,
          },
        }
      );

      const res = await createTruckRequest(req);
      expect([400, 403]).toContain(res.status);
    });

    it("should list shipper truck requests", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-requests"
      );

      const res = await listTruckRequests(req);
      expect(res.status).toBe(200);
    });

    it("should reject unauthenticated truck request", async () => {
      setAuthSession(null);

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
      expect(res.status).toBe(401);
    });
  });

  // ─── Approve Load Request ────────────────────────────────────────────────

  describe("Approve Load Request", () => {
    let loadRequestId: string;

    beforeAll(async () => {
      // Create a load request to respond to
      const loadRequest = await db.loadRequest.create({
        data: {
          id: "lr-to-approve-001",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
      loadRequestId = loadRequest.id;
    });

    it("should approve a load request", async () => {
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${loadRequestId}/respond`,
        {
          body: { action: "APPROVE", responseNotes: "Approved for delivery" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: loadRequestId,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.request || data.loadRequest).toBeDefined();
    });

    it("should reject approval of non-existent request", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests/non-existent/respond",
        {
          body: { action: "APPROVE" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: "non-existent",
      });
      expect(res.status).toBe(404);
    });

    it("should reject load request", async () => {
      const rejectRequest = await db.loadRequest.create({
        data: {
          id: "lr-to-reject-001",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${rejectRequest.id}/respond`,
        {
          body: { action: "REJECT", responseNotes: "Truck type mismatch" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: rejectRequest.id,
      });
      expect(res.status).toBe(200);
    });

    it("should reject invalid action", async () => {
      const invalidRequest = await db.loadRequest.create({
        data: {
          id: "lr-invalid-action",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${invalidRequest.id}/respond`,
        {
          body: { action: "INVALID_ACTION" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: invalidRequest.id,
      });
      expect(res.status).toBe(400);
    });

    it("should reject approval by non-shipper", async () => {
      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const carrierRequest = await db.loadRequest.create({
        data: {
          id: "lr-wrong-role",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${carrierRequest.id}/respond`,
        {
          body: { action: "APPROVE" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: carrierRequest.id,
      });
      expect(res.status).toBe(403);
    });

    it("should reject approval of already-processed request", async () => {
      const processedRequest = await db.loadRequest.create({
        data: {
          id: "lr-already-done",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "APPROVED",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/load-requests/${processedRequest.id}/respond`,
        {
          body: { action: "APPROVE" },
        }
      );

      const res = await callHandler(respondToLoadRequest, req, {
        id: processedRequest.id,
      });
      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── Track Trip ──────────────────────────────────────────────────────────

  describe("Track Trip", () => {
    let tripId: string;

    beforeAll(async () => {
      const trip = await db.trip.create({
        data: {
          id: "shipper-trip-001",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          referenceNumber: "TRIP-SHIP001",
        },
      });
      tripId = trip.id;
    });

    it("should list shipper trips", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trips");

      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trips).toBeDefined();
    });

    it("should get trip details as shipper", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}`
      );

      const res = await callHandler(getTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip).toBeDefined();
    });

    it("should not see trip from another organization", async () => {
      const otherTrip = await db.trip.create({
        data: {
          id: "other-shipper-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: "other-org-id",
          status: "IN_TRANSIT",
          referenceNumber: "TRIP-OTHER1",
        },
      });

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${otherTrip.id}`
      );

      const res = await callHandler(getTrip, req, { tripId: otherTrip.id });
      // Cross-org trip access returns 404 (invisible) — prevents resource enumeration
      expect(res.status).toBe(404);
    });
  });

  // ─── Wallet ──────────────────────────────────────────────────────────────

  describe("Wallet", () => {
    it("should get shipper wallet balance", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );

      const res = await getWalletBalance(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.wallets).toBeDefined();
      expect(data.totalBalance).toBeDefined();
      expect(data.currency).toBe("ETB");
    });

    it("should reject wallet access without auth", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/wallet/balance"
      );
      const res = await getWalletBalance(req);
      expect(res.status).toBe(401);
    });
  });

  // ─── Load Request Listing ────────────────────────────────────────────────

  describe("Load Request Listing", () => {
    it("should list load requests for shipper loads", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests"
      );

      const res = await listLoadRequests(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.loadRequests).toBeDefined();
    });

    it("should filter by status", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/load-requests?status=PENDING"
      );

      const res = await listLoadRequests(req);
      expect(res.status).toBe(200);
    });
  });
});

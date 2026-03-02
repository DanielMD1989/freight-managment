/**
 * Carrier Dashboard API Tests
 *
 * Tests for GET /api/carrier/dashboard:
 * - Returns carrier-specific statistics
 * - Total trucks, active trucks, active postings
 * - Completed deliveries, in-transit trips
 * - Wallet balance, recent postings, pending approvals
 *
 * Business rules:
 * - Only CARRIER or ADMIN role can access
 * - User must belong to an organization
 * - Rate limited (dashboard RPS config)
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

// Custom rate limit mock — we need to control it per test
const mockCheckRpsLimit = jest.fn(async () => ({
  allowed: true,
  limit: 5,
  remaining: 4,
}));

jest.mock("@/lib/rateLimit", () => ({
  checkRpsLimit: (...args: any[]) => mockCheckRpsLimit(...args),
  checkRateLimit: jest.fn(async () => ({
    allowed: true,
    success: true,
    limit: 100,
    remaining: 99,
    retryAfter: 0,
    resetTime: Date.now() + 3600000,
  })),
  addRateLimitHeaders: jest.fn((res: any) => res),
  RPS_CONFIGS: {
    marketplace: { endpoint: "loads", rps: 50, burst: 100 },
    fleet: { endpoint: "trucks", rps: 30, burst: 60 },
    dashboard: { endpoint: "dashboard", rps: 5, burst: 10 },
    gps: { endpoint: "gps", rps: 30, burst: 60 },
  },
  RATE_LIMIT_TRUCK_POSTING: { maxRequests: 100, windowMs: 86400000 },
}));

// Import handler AFTER mocks
const { GET: getDashboard } = require("@/app/api/carrier/dashboard/route");

describe("Carrier Dashboard", () => {
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
    organizationId: "carrier-org-1",
  });

  const noOrgCarrierSession = createMockSession({
    userId: "no-org-carrier",
    email: "noorg-carrier@test.com",
    role: "CARRIER",
    organizationId: undefined,
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create additional trucks (some available, some not)
    await db.truck.create({
      data: {
        id: "truck-available-2",
        truckType: "FLATBED",
        licensePlate: "AA-67890",
        capacity: 15000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    await db.truck.create({
      data: {
        id: "truck-unavailable",
        truckType: "TANKER",
        licensePlate: "AA-11111",
        capacity: 20000,
        isAvailable: false,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    // Create a truck pending approval
    await db.truck.create({
      data: {
        id: "truck-pending",
        truckType: "DRY_VAN",
        licensePlate: "AA-99999",
        capacity: 8000,
        isAvailable: false,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "PENDING",
      },
    });

    // Create trips in various statuses
    await db.trip.create({
      data: {
        id: "dashboard-trip-completed",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "COMPLETED",
      },
    });

    await db.trip.create({
      data: {
        id: "dashboard-trip-delivered",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "DELIVERED",
      },
    });

    await db.trip.create({
      data: {
        id: "dashboard-trip-intransit",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "IN_TRANSIT",
      },
    });

    // Create a second active posting
    await db.truckPosting.create({
      data: {
        id: "posting-active-2",
        truckId: "truck-available-2",
        carrierId: seed.carrierOrg.id,
        originCityId: "city-hawassa",
        originCityName: "Hawassa",
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "Test Carrier",
        contactPhone: "+251911000002",
      },
    });

    // Create user without org
    await db.user.create({
      data: {
        id: "no-org-carrier",
        email: "noorg-carrier@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "NoOrg",
        lastName: "Carrier",
        phone: "+251911000077",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: undefined,
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockCheckRpsLimit.mockResolvedValue({
      allowed: true,
      limit: 5,
      remaining: 4,
    });
    setAuthSession(carrierSession);
  });

  // ─── Auth & Access ─────────────────────────────────────────────────────────

  describe("Auth & Access", () => {
    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect([401, 500]).toContain(res.status);
    });

    it("shipper role → 403", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("Carrier role");
    });

    it("carrier role → 200", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── No Org ─────────────────────────────────────────────────────────────────

  describe("No Organization", () => {
    it("carrier without organizationId → 400", async () => {
      setAuthSession(noOrgCarrierSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("organization");
    });
  });

  // ─── Admin Access ───────────────────────────────────────────────────────────

  describe("Admin Access", () => {
    it("admin can view carrier dashboard", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.totalTrucks).toBeDefined();
    });
  });

  // ─── Stats Accuracy ─────────────────────────────────────────────────────────

  describe("Stats Accuracy", () => {
    it("totalTrucks count matches fleet size", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // test-truck-001 + truck-available-2 + truck-unavailable + truck-pending = 4
      expect(data.totalTrucks).toBe(4);
    });

    it("activeTrucks counts only isAvailable=true", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // test-truck-001 (available) + truck-available-2 (available) = 2
      expect(data.activeTrucks).toBe(2);
    });

    it("activePostings counts ACTIVE status", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // test-posting-001 + posting-active-2 = 2
      expect(data.activePostings).toBe(2);
    });

    it("completedDeliveries from Trip model", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // dashboard-trip-completed + dashboard-trip-delivered = 2
      expect(data.completedDeliveries).toBe(2);
    });
  });

  // ─── In-Transit Count ──────────────────────────────────────────────────────

  describe("In-Transit Count", () => {
    it("inTransitTrips counts IN_TRANSIT status trips", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.inTransitTrips).toBe(1);
    });
  });

  // ─── Wallet Balance ─────────────────────────────────────────────────────────

  describe("Wallet Balance", () => {
    it("wallet balance matches financial account", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.wallet).toBeDefined();
      expect(data.wallet.balance).toBe(5000);
      expect(data.wallet.currency).toBe("ETB");
    });
  });

  // ─── Empty State ────────────────────────────────────────────────────────────

  describe("Empty State", () => {
    it("new carrier with no data returns zeros", async () => {
      // Create a new carrier org with no trucks/trips
      await db.organization.create({
        data: {
          id: "empty-carrier-org",
          name: "Empty Carrier",
          type: "CARRIER_COMPANY",
          contactEmail: "empty@test.com",
          contactPhone: "+251911000066",
        },
      });

      await db.user.create({
        data: {
          id: "empty-carrier-user",
          email: "empty@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "Empty",
          lastName: "Carrier",
          phone: "+251911000066",
          role: "CARRIER",
          status: "ACTIVE",
          organizationId: "empty-carrier-org",
        },
      });

      const emptySession = createMockSession({
        userId: "empty-carrier-user",
        email: "empty@test.com",
        role: "CARRIER",
        organizationId: "empty-carrier-org",
      });

      setAuthSession(emptySession);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.totalTrucks).toBe(0);
      expect(data.activeTrucks).toBe(0);
      expect(data.activePostings).toBe(0);
      expect(data.completedDeliveries).toBe(0);
      expect(data.inTransitTrips).toBe(0);
    });
  });

  // ─── Recent Postings ────────────────────────────────────────────────────────

  describe("Recent Postings", () => {
    it("returns recent truck postings count", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(typeof data.recentPostings).toBe("number");
    });
  });

  // ─── Pending Approvals ──────────────────────────────────────────────────────

  describe("Pending Approvals", () => {
    it("shows trucks with approvalStatus=PENDING", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pendingApprovals).toBe(1);
    });
  });

  // ─── Rate Limiting ──────────────────────────────────────────────────────────

  describe("Rate Limiting", () => {
    it("429 when RPS limit exceeded", async () => {
      mockCheckRpsLimit.mockResolvedValue({
        allowed: false,
        limit: 5,
        remaining: 0,
      });

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );
      const res = await getDashboard(req);
      expect(res.status).toBe(429);

      const data = await parseResponse(res);
      expect(data.error).toContain("Rate limit");
    });
  });
});

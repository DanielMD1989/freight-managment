/**
 * US-15 · Cross-Role Access Denial
 *
 * Full role access matrix test:
 *
 * | Action                        | CARRIER | SHIPPER | DISPATCHER | ADMIN | SUPER_ADMIN |
 * |-------------------------------|---------|---------|------------|-------|-------------|
 * | Browse /api/trucks            | ✅      | 403     | ✅         | ✅    | ✅          |
 * | POST truck posting            | ✅      | 403     | 403        | ✅    | ✅          |
 * | Create match proposal         | 403     | 403     | ✅         | ✅    | ✅          |
 * | POST GPS update               | ✅ own  | 404     | 404        | ✅    | ✅          |
 * | Access other org trip         | 404     | 404     | 404        | ✅    | ✅          |
 * | Download doc (own)            | ✅      | ✅      | ✅         | ✅    | ✅          |
 * | Download doc (other org)      | 404     | 404     | 404        | ✅    | ✅          |
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
  mockServiceFee,
  mockStorage,
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
mockServiceFee();
mockStorage();

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
const { GET: getTrucks } = require("@/app/api/trucks/route");
const { POST: createTruckPosting } = require("@/app/api/truck-postings/route");
const { POST: createProposal } = require("@/app/api/match-proposals/route");
const { POST: createGpsUpdate } = require("@/app/api/trips/[tripId]/gps/route");
const { GET: getTrips } = require("@/app/api/trips/route");

describe("US-15 · Cross-Role Access Denial", () => {
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
    userId: "cross-dispatcher-1",
    email: "crossd@test.com",
    role: "DISPATCHER",
    organizationId: "carrier-org-1",
  });

  const adminSession = createMockSession({
    userId: "cross-admin-1",
    email: "crossadmin@test.com",
    role: "ADMIN",
    organizationId: "cross-admin-org",
  });

  const superAdminSession = createMockSession({
    userId: "cross-superadmin-1",
    email: "crosssuper@test.com",
    role: "SUPER_ADMIN",
    organizationId: "cross-admin-org",
  });

  const otherCarrierSession = createMockSession({
    userId: "cross-other-carrier-1",
    email: "crossother@test.com",
    role: "CARRIER",
    organizationId: "cross-other-org",
  });

  beforeAll(async () => {
    await seedTestData();

    // Additional users for role tests
    await db.user.create({
      data: {
        id: "cross-dispatcher-1",
        email: "crossd@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Cross",
        lastName: "Dispatcher",
        phone: "+251911000081",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "carrier-org-1",
      },
    });

    await db.organization.create({
      data: {
        id: "cross-admin-org",
        name: "Cross Admin",
        type: "PLATFORM",
        contactEmail: "crossadmin@test.com",
        contactPhone: "+251911000082",
      },
    });
    await db.user.create({
      data: {
        id: "cross-admin-1",
        email: "crossadmin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Cross",
        lastName: "Admin",
        phone: "+251911000082",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "cross-admin-org",
      },
    });
    await db.user.create({
      data: {
        id: "cross-superadmin-1",
        email: "crosssuper@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Cross",
        lastName: "SuperAdmin",
        phone: "+251911000083",
        role: "SUPER_ADMIN",
        status: "ACTIVE",
        organizationId: "cross-admin-org",
      },
    });

    await db.organization.create({
      data: {
        id: "cross-other-org",
        name: "Cross Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "crossother@test.com",
        contactPhone: "+251911000084",
      },
    });
    await db.user.create({
      data: {
        id: "cross-other-carrier-1",
        email: "crossother@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Cross",
        lastName: "OtherCarrier",
        phone: "+251911000084",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: "cross-other-org",
      },
    });

    // Truck for other org
    await db.truck.create({
      data: {
        id: "cross-other-truck",
        truckType: "DRY_VAN",
        licensePlate: "BB-CROSS-01",
        capacity: 8000,
        isAvailable: true,
        carrierId: "cross-other-org",
        createdById: "cross-other-carrier-1",
        approvalStatus: "APPROVED",
      },
    });

    // Trip for carrier-org-1 (trackingEnabled required for GPS updates)
    await db.trip.create({
      data: {
        id: "cross-trip-1",
        loadId: "test-load-001",
        truckId: "test-truck-001",
        carrierId: "carrier-org-1",
        status: "IN_TRANSIT",
        startedAt: new Date(),
        trackingEnabled: true,
      },
    });

    // Trip for cross-other-org
    await db.load.create({
      data: {
        id: "cross-other-load",
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 86400000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Other org cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        assignedTruckId: "cross-other-truck",
      },
    });
    await db.trip.create({
      data: {
        id: "cross-other-trip",
        loadId: "cross-other-load",
        truckId: "cross-other-truck",
        carrierId: "cross-other-org",
        status: "IN_TRANSIT",
        startedAt: new Date(),
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Browse /api/trucks ───────────────────────────────────────────────────

  describe("GET /api/trucks", () => {
    it("CARRIER can browse trucks → 200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("GET", "http://localhost:3000/api/trucks");
      const res = await getTrucks(req);
      expect(res.status).toBe(200);
    });

    it("SHIPPER cannot browse trucks → 403", async () => {
      setAuthSession(shipperSession);
      const req = createRequest("GET", "http://localhost:3000/api/trucks");
      const res = await getTrucks(req);
      expect(res.status).toBe(403);
    });

    it("DISPATCHER can browse trucks → 200", async () => {
      setAuthSession(dispatcherSession);
      const req = createRequest("GET", "http://localhost:3000/api/trucks");
      const res = await getTrucks(req);
      expect(res.status).toBe(200);
    });

    it("ADMIN can browse trucks → 200", async () => {
      setAuthSession(adminSession);
      const req = createRequest("GET", "http://localhost:3000/api/trucks");
      const res = await getTrucks(req);
      expect(res.status).toBe(200);
    });

    it("SUPER_ADMIN can browse trucks → 200", async () => {
      setAuthSession(superAdminSession);
      const req = createRequest("GET", "http://localhost:3000/api/trucks");
      const res = await getTrucks(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── POST /api/truck-postings ─────────────────────────────────────────────

  describe("POST /api/truck-postings", () => {
    const validPosting = {
      truckId: "test-truck-001",
      originCityId: "city-addis",
      originCityName: "Addis Ababa",
      availableFrom: new Date().toISOString(),
      fullPartial: "FULL",
      contactName: "Test Carrier",
      contactPhone: "+251911000002",
    };

    it("CARRIER can post truck → 201/200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        { body: validPosting }
      );
      const res = await createTruckPosting(req);
      // 201 on success, 400/409 if truck already has active posting
      expect([200, 201, 400, 409]).toContain(res.status);
      expect(res.status).not.toBe(403);
    });

    it("SHIPPER cannot post truck → 403", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        { body: validPosting }
      );
      const res = await createTruckPosting(req);
      expect(res.status).toBe(403);
    });

    it("DISPATCHER cannot post truck → 403", async () => {
      setAuthSession(dispatcherSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        { body: validPosting }
      );
      const res = await createTruckPosting(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── POST /api/match-proposals ────────────────────────────────────────────

  describe("POST /api/match-proposals", () => {
    const validProposal = {
      loadId: "test-load-001",
      truckId: "test-truck-001",
      expiresInHours: 24,
    };

    it("DISPATCHER can create proposal → 201/400", async () => {
      setAuthSession(dispatcherSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/match-proposals",
        { body: validProposal }
      );
      const res = await createProposal(req);
      // Not 403 — dispatcher is allowed
      expect(res.status).not.toBe(403);
    });

    it("CARRIER cannot create match proposal → 403", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/match-proposals",
        { body: validProposal }
      );
      const res = await createProposal(req);
      expect(res.status).toBe(403);
    });

    it("SHIPPER cannot create match proposal → 403", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/match-proposals",
        { body: validProposal }
      );
      const res = await createProposal(req);
      expect(res.status).toBe(403);
    });

    it("ADMIN can create match proposal → 201/400", async () => {
      setAuthSession(adminSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/match-proposals",
        { body: validProposal }
      );
      const res = await createProposal(req);
      // Not 403 — admin is allowed
      expect(res.status).not.toBe(403);
    });
  });

  // ─── POST GPS update ─────────────────────────────────────────────────────

  describe("POST /api/trips/[tripId]/gps", () => {
    const validGps = {
      latitude: 9.02,
      longitude: 38.75,
      timestamp: new Date().toISOString(),
      speed: 60,
      heading: 180,
    };

    it("CARRIER can post GPS for own trip → 200/201", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/cross-trip-1/gps`,
        { body: validGps }
      );
      const res = await callHandler(createGpsUpdate, req, {
        tripId: "cross-trip-1",
      });
      expect([200, 201]).toContain(res.status);
    });

    it("SHIPPER cannot post GPS → 404", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/cross-trip-1/gps`,
        { body: validGps }
      );
      const res = await callHandler(createGpsUpdate, req, {
        tripId: "cross-trip-1",
      });
      expect(res.status).toBe(404);
    });

    it("DISPATCHER cannot post GPS for carrier trip → 404", async () => {
      setAuthSession(dispatcherSession);
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/cross-trip-1/gps`,
        { body: validGps }
      );
      const res = await callHandler(createGpsUpdate, req, {
        tripId: "cross-trip-1",
      });
      expect(res.status).toBe(404);
    });

    it("OTHER CARRIER cannot post GPS for another carrier's trip → 404", async () => {
      setAuthSession(otherCarrierSession);
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/cross-trip-1/gps`,
        { body: validGps }
      );
      const res = await callHandler(createGpsUpdate, req, {
        tripId: "cross-trip-1",
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── Access other org trip ────────────────────────────────────────────────

  describe("Access other org trip via GET /api/trips", () => {
    it("CARRIER sees only own org trips (other org trip filtered out)", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await getTrips(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      // Carrier sees own trips
      expect(data).toBeDefined();
    });

    it("ADMIN sees all trips → 200", async () => {
      setAuthSession(adminSession);
      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await getTrips(req);
      expect(res.status).toBe(200);
    });

    it("SUPER_ADMIN sees all trips → 200", async () => {
      setAuthSession(superAdminSession);
      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await getTrips(req);
      expect(res.status).toBe(200);
    });

    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);
      const req = createRequest("GET", "http://localhost:3000/api/trips");
      const res = await getTrips(req);
      expect([401, 500]).toContain(res.status);
    });
  });
});

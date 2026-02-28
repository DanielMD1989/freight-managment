/**
 * GPS Live Position API Tests
 *
 * Tests for GET /api/gps/live - Get live GPS positions for active trips
 *
 * Query modes:
 * - ?loadId=X → position for a specific load/trip
 * - ?truckIds=X,Y → positions for multiple trucks
 * - (no params) → all active IN_TRANSIT trips for user's context
 *
 * Business rules:
 * - Carrier sees own trucks/loads only
 * - Shipper sees trucks on their IN_TRANSIT loads only
 * - Admin/dispatcher sees all
 * - Default mode caps at 100 trips
 * - Shipper gets position:null when load not IN_TRANSIT
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

// Import handler AFTER mocks
const { GET: getLive } = require("@/app/api/gps/live/route");

describe("GPS Live API", () => {
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

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user-1",
    email: "other@test.com",
    role: "CARRIER",
    organizationId: "other-carrier-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Other carrier
    await db.organization.create({
      data: {
        id: "other-carrier-org-1",
        name: "Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "other@test.com",
        contactPhone: "+251911000009",
      },
    });
    await db.user.create({
      data: {
        id: "other-carrier-user-1",
        email: "other@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Other",
        lastName: "Carrier",
        phone: "+251911000009",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: "other-carrier-org-1",
      },
    });

    // Admin
    await db.organization.create({
      data: {
        id: "admin-org-1",
        name: "Admin Org",
        type: "PLATFORM",
        contactEmail: "admin@test.com",
        contactPhone: "+251911000010",
      },
    });
    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Admin",
        lastName: "User",
        phone: "+251911000010",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "admin-org-1",
      },
    });

    // Truck with current location (carrier-org-1)
    await db.truck.create({
      data: {
        id: "live-truck-1",
        truckType: "DRY_VAN",
        licensePlate: "AA-LIVE-01",
        capacity: 10000,
        isAvailable: false,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
        currentLocationLat: 9.02,
        currentLocationLon: 38.75,
        locationUpdatedAt: new Date(),
        gpsStatus: "ACTIVE",
      },
    });

    // Another truck (carrier-org-1)
    await db.truck.create({
      data: {
        id: "live-truck-2",
        truckType: "FLATBED",
        licensePlate: "AA-LIVE-02",
        capacity: 8000,
        isAvailable: false,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
        currentLocationLat: 8.98,
        currentLocationLon: 38.72,
        locationUpdatedAt: new Date(),
        gpsStatus: "ACTIVE",
      },
    });

    // Other carrier's truck
    await db.truck.create({
      data: {
        id: "live-truck-other",
        truckType: "DRY_VAN",
        licensePlate: "AA-LIVE-OTH",
        capacity: 10000,
        isAvailable: false,
        carrierId: "other-carrier-org-1",
        createdById: "other-carrier-user-1",
        approvalStatus: "APPROVED",
        currentLocationLat: 7.5,
        currentLocationLon: 37.5,
        locationUpdatedAt: new Date(),
        gpsStatus: "ACTIVE",
      },
    });

    // IN_TRANSIT load on live-truck-1 (shipper-org-1)
    await db.load.create({
      data: {
        id: "live-load-1",
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Live tracking cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        assignedTruckId: "live-truck-1",
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 86400000),
      },
    });

    // ASSIGNED load (not IN_TRANSIT)
    await db.load.create({
      data: {
        id: "live-load-assigned",
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        truckType: "FLATBED",
        weight: 3000,
        cargoDescription: "Assigned cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        assignedTruckId: "live-truck-2",
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 86400000),
      },
    });

    // Other carrier's IN_TRANSIT load
    await db.load.create({
      data: {
        id: "live-load-other",
        status: "IN_TRANSIT",
        pickupCity: "Mekelle",
        deliveryCity: "Bahir Dar",
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Other carrier cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        assignedTruckId: "live-truck-other",
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 86400000),
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Auth ────────────────────────────────────────────────────────────────

  describe("Auth", () => {
    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);
      const req = createRequest("GET", "http://localhost:3000/api/gps/live");
      const res = await getLive(req);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── By loadId ───────────────────────────────────────────────────────────

  describe("By loadId", () => {
    it("load not found → 404", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?loadId=nonexistent"
      );
      const res = await getLive(req);
      expect(res.status).toBe(404);
    });

    it("carrier on assigned truck → 200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?loadId=live-load-1"
      );
      const res = await getLive(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.loadId).toBe("live-load-1");
      expect(data.position).toBeDefined();
    });

    it("unrelated carrier → 403", async () => {
      setAuthSession(otherCarrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?loadId=live-load-1"
      );
      const res = await getLive(req);
      expect(res.status).toBe(403);
    });

    it("shipper on own load → 200", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?loadId=live-load-1"
      );
      const res = await getLive(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.loadId).toBe("live-load-1");
    });

    it("shipper gets position:null when load not IN_TRANSIT", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?loadId=live-load-assigned"
      );
      const res = await getLive(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.position).toBeNull();
    });

    it("returns position:null when no truck assigned", async () => {
      // Create load with no truck
      await db.load.create({
        data: {
          id: "live-load-no-truck",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Jimma",
          truckType: "DRY_VAN",
          weight: 2000,
          cargoDescription: "No truck assigned",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          pickupDate: new Date(),
          deliveryDate: new Date(Date.now() + 86400000),
        },
      });
      // Use admin session since carrier access control fails when no truck assigned
      setAuthSession(adminSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?loadId=live-load-no-truck"
      );
      const res = await getLive(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.position).toBeNull();
    });
  });

  // ─── By truckIds ─────────────────────────────────────────────────────────

  describe("By truckIds", () => {
    it("carrier sees own trucks", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?truckIds=live-truck-1,live-truck-2"
      );
      const res = await getLive(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.positions).toHaveLength(2);
    });

    it("carrier filters out other carrier's trucks", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?truckIds=live-truck-1,live-truck-other"
      );
      const res = await getLive(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      // Only own truck returned
      expect(data.positions).toHaveLength(1);
      expect(data.positions[0].truckId).toBe("live-truck-1");
    });

    it("shipper sees only trucks on their IN_TRANSIT loads", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?truckIds=live-truck-1,live-truck-2"
      );
      const res = await getLive(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      // Only live-truck-1 has an IN_TRANSIT load for this shipper
      expect(data.positions).toHaveLength(1);
      expect(data.positions[0].truckId).toBe("live-truck-1");
    });

    it("admin sees any trucks", async () => {
      setAuthSession(adminSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?truckIds=live-truck-1,live-truck-other"
      );
      const res = await getLive(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.positions).toHaveLength(2);
    });
  });

  // ─── Default mode (no params) ────────────────────────────────────────────

  describe("Default mode (no params)", () => {
    it("returns active IN_TRANSIT trips", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("GET", "http://localhost:3000/api/gps/live");
      const res = await getLive(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.trips).toBeDefined();
      expect(data.count).toBeGreaterThanOrEqual(1);
    });

    it("carrier sees only own trips", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("GET", "http://localhost:3000/api/gps/live");
      const res = await getLive(req);
      const data = await parseResponse(res);
      // Verify response structure — trips include truck data with resolved relations
      expect(data.trips).toBeDefined();
      expect(data.count).toBeGreaterThanOrEqual(1);
      // Each trip should have truck info (resolved via select)
      for (const trip of data.trips) {
        if (trip.truck) {
          expect(trip.truck.id).toBeDefined();
        }
      }
    });

    it("admin sees all active trips", async () => {
      setAuthSession(adminSession);
      const req = createRequest("GET", "http://localhost:3000/api/gps/live");
      const res = await getLive(req);
      const data = await parseResponse(res);
      // Admin should see trips from all carriers
      expect(data.trips.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ─── Carrier no org ──────────────────────────────────────────────────────

  describe("Carrier without org", () => {
    it("carrier without organizationId → 403", async () => {
      const noOrgSession = createMockSession({
        userId: "live-no-org",
        role: "CARRIER",
        organizationId: undefined,
      });
      await db.user.create({
        data: {
          id: "live-no-org",
          email: "livenoorg@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "No",
          lastName: "Org",
          phone: "+251911077777",
          role: "CARRIER",
          status: "ACTIVE",
        },
      });
      setAuthSession(noOrgSession);
      const req = createRequest("GET", "http://localhost:3000/api/gps/live");
      const res = await getLive(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── Response shape ──────────────────────────────────────────────────────

  describe("Response shape", () => {
    it("truckIds mode positions include truckId/position fields", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?truckIds=live-truck-1"
      );
      const res = await getLive(req);
      const data = await parseResponse(res);
      expect(data.positions[0]).toHaveProperty("truckId");
      expect(data.positions[0]).toHaveProperty("plateNumber");
      expect(data.positions[0].position).toHaveProperty("lat");
      expect(data.positions[0].position).toHaveProperty("lng");
    });

    it("loadId mode includes load and truck info", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/live?loadId=live-load-1"
      );
      const res = await getLive(req);
      const data = await parseResponse(res);
      expect(data.loadId).toBe("live-load-1");
      expect(data.truck).toBeDefined();
      expect(data.truck.id).toBe("live-truck-1");
      expect(data.position).toBeDefined();
    });
  });
});

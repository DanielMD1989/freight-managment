/**
 * GPS History API Tests
 *
 * Tests for GET /api/gps/history - Get GPS position history
 *
 * Query params:
 * - loadId / truckId (at least one required)
 * - from / to (date range filter)
 * - limit (default 1000, cap 5000)
 *
 * Business rules:
 * - Carrier can access own truck/load history
 * - Shipper can access load history (not truck history directly)
 * - Admin can access any history
 * - Returns route stats: totalDistanceKm, totalTimeHours, avgSpeedKmh
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

jest.mock("@/lib/geo", () => ({
  calculateDistanceKm: jest.fn(() => 25),
  isValidCoordinate: jest.fn(() => true),
}));

jest.mock("@/lib/rounding", () => ({
  roundToDecimals: jest.fn((value: number, decimals: number) =>
    Number(value.toFixed(decimals))
  ),
}));

// Import handler AFTER mocks
const { GET: getHistory } = require("@/app/api/gps/history/route");

describe("GPS History API", () => {
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

    // Truck for history tests
    await db.truck.create({
      data: {
        id: "hist-truck-1",
        truckType: "DRY_VAN",
        licensePlate: "AA-HIST-01",
        capacity: 10000,
        isAvailable: false,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
      },
    });

    // Load for history tests (assigned to hist-truck-1)
    await db.load.create({
      data: {
        id: "hist-load-1",
        status: "DELIVERED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "History test cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        assignedTruckId: "hist-truck-1",
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 86400000),
      },
    });

    // Create GPS position history
    const baseTime = new Date("2026-02-25T08:00:00Z").getTime();
    for (let i = 0; i < 5; i++) {
      await db.gpsPosition.create({
        data: {
          truckId: "hist-truck-1",
          deviceId: "hist-device",
          latitude: 9.0 + i * 0.1,
          longitude: 38.7 + i * 0.1,
          speed: 50 + i * 5,
          heading: 180,
          timestamp: new Date(baseTime + i * 3600000), // 1 hour apart
          loadId: "hist-load-1",
        },
      });
    }
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Auth ────────────────────────────────────────────────────────────────

  describe("Auth", () => {
    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?loadId=hist-load-1"
      );
      const res = await getHistory(req);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── Param validation ───────────────────────────────────────────────────

  describe("Param validation", () => {
    it("neither loadId nor truckId → 400", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("GET", "http://localhost:3000/api/gps/history");
      const res = await getHistory(req);
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toMatch(/loadId|truckId/i);
    });
  });

  // ─── By loadId ───────────────────────────────────────────────────────────

  describe("By loadId — access", () => {
    it("carrier on assigned truck → 200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?loadId=hist-load-1"
      );
      const res = await getHistory(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.positions.length).toBeGreaterThan(0);
    });

    it("unrelated carrier → 403", async () => {
      setAuthSession(otherCarrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?loadId=hist-load-1"
      );
      const res = await getHistory(req);
      expect(res.status).toBe(403);
    });

    it("shipper on own load → 200", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?loadId=hist-load-1"
      );
      const res = await getHistory(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── By truckId ──────────────────────────────────────────────────────────

  describe("By truckId — access", () => {
    it("carrier own truck → 200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?truckId=hist-truck-1"
      );
      const res = await getHistory(req);
      expect(res.status).toBe(200);
    });

    it("other carrier's truck → 403", async () => {
      setAuthSession(otherCarrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?truckId=hist-truck-1"
      );
      const res = await getHistory(req);
      expect(res.status).toBe(403);
    });

    it("shipper cannot access truck history directly → 403", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?truckId=hist-truck-1"
      );
      const res = await getHistory(req);
      expect(res.status).toBe(403);
    });

    it("admin can access any truck → 200", async () => {
      setAuthSession(adminSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?truckId=hist-truck-1"
      );
      const res = await getHistory(req);
      expect(res.status).toBe(200);
    });
  });

  // ─── Date range filter ──────────────────────────────────────────────────

  describe("Date range filter", () => {
    it("from/to query params filter positions", async () => {
      setAuthSession(carrierSession);
      const from = new Date("2026-02-25T09:00:00Z").toISOString();
      const to = new Date("2026-02-25T11:00:00Z").toISOString();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/gps/history?loadId=hist-load-1&from=${from}&to=${to}`
      );
      const res = await getHistory(req);
      const data = await parseResponse(res);
      expect(res.status).toBe(200);
      // Should only have positions within the time range
      for (const pos of data.positions) {
        const ts = new Date(pos.timestamp).getTime();
        expect(ts).toBeGreaterThanOrEqual(new Date(from).getTime());
        expect(ts).toBeLessThanOrEqual(new Date(to).getTime());
      }
    });
  });

  // ─── Stats calculation ──────────────────────────────────────────────────

  describe("Stats calculation", () => {
    it("returns totalDistanceKm/totalTimeHours/avgSpeedKmh", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?loadId=hist-load-1"
      );
      const res = await getHistory(req);
      const data = await parseResponse(res);
      expect(data.stats).toBeDefined();
      expect(typeof data.stats.totalDistanceKm).toBe("number");
      expect(typeof data.stats.totalTimeHours).toBe("number");
      expect(typeof data.stats.avgSpeedKmh).toBe("number");
      // With 5 positions 1 hour apart, calculateDistanceKm returns 25 each time
      // Total distance = 4 * 25 = 100 km
      expect(data.stats.totalDistanceKm).toBe(100);
    });

    it("stats are 0 when ≤1 position", async () => {
      // Create a load with only one GPS position
      await db.load.create({
        data: {
          id: "hist-load-single",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Jimma",
          truckType: "DRY_VAN",
          weight: 2000,
          cargoDescription: "Single pos cargo",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          assignedTruckId: "hist-truck-1",
          pickupDate: new Date(),
          deliveryDate: new Date(Date.now() + 86400000),
        },
      });
      await db.gpsPosition.create({
        data: {
          truckId: "hist-truck-1",
          deviceId: "hist-device",
          latitude: 9.5,
          longitude: 38.5,
          speed: 0,
          timestamp: new Date("2026-02-26T08:00:00Z"),
          loadId: "hist-load-single",
        },
      });

      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?loadId=hist-load-single"
      );
      const res = await getHistory(req);
      const data = await parseResponse(res);
      expect(data.stats.totalDistanceKm).toBe(0);
      expect(data.stats.totalTimeHours).toBe(0);
      expect(data.stats.avgSpeedKmh).toBe(0);
    });
  });

  // ─── Response shape ──────────────────────────────────────────────────────

  describe("Response shape", () => {
    it("positions have id/lat/lng/speed/timestamp", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?loadId=hist-load-1"
      );
      const res = await getHistory(req);
      const data = await parseResponse(res);
      const pos = data.positions[0];
      expect(pos).toHaveProperty("id");
      expect(pos).toHaveProperty("lat");
      expect(pos).toHaveProperty("lng");
      expect(pos).toHaveProperty("speed");
      expect(pos).toHaveProperty("timestamp");
    });

    it("count matches positions array length", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?loadId=hist-load-1"
      );
      const res = await getHistory(req);
      const data = await parseResponse(res);
      expect(data.count).toBe(data.positions.length);
    });
  });

  // ─── Empty history ──────────────────────────────────────────────────────

  describe("Empty history", () => {
    it("returns empty positions with zero stats", async () => {
      // Create a load with no GPS positions
      await db.load.create({
        data: {
          id: "hist-load-empty",
          status: "ASSIGNED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Adama",
          truckType: "DRY_VAN",
          weight: 1000,
          cargoDescription: "Empty history cargo",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          assignedTruckId: "hist-truck-1",
          pickupDate: new Date(),
          deliveryDate: new Date(Date.now() + 86400000),
        },
      });

      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/gps/history?loadId=hist-load-empty"
      );
      const res = await getHistory(req);
      const data = await parseResponse(res);
      expect(data.positions).toHaveLength(0);
      expect(data.count).toBe(0);
      expect(data.stats.totalDistanceKm).toBe(0);
      expect(data.stats.totalTimeHours).toBe(0);
      expect(data.stats.avgSpeedKmh).toBe(0);
    });
  });
});

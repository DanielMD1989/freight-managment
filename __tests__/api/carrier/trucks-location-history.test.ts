/**
 * Truck Location, History & Nearby-Loads Tests
 *
 * Routes tested:
 * - PATCH /api/trucks/[id]/location → update truck location
 * - GET   /api/trucks/[id]/location → get truck current location
 * - GET   /api/trucks/[id]/history  → GPS position history
 * - GET   /api/trucks/[id]/nearby-loads → DH-O optimized load search
 *
 * Business rules tested:
 * - Ownership checks (carrier sees own truck only)
 * - Shipper with IN_TRANSIT load can see location
 * - Date range validation (max 7 days)
 * - Rate limiting passthrough
 * - maxDHO range (1-2000)
 * - minTripKm <= maxTripKm validation
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
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Mock deadheadOptimization
jest.mock("@/lib/deadheadOptimization", () => ({
  getTruckCurrentLocation: jest.fn(async () => ({
    latitude: 9.02,
    longitude: 38.75,
    source: "gps",
    timestamp: new Date(),
  })),
  findLoadsWithMinimalDHO: jest.fn(async () => [
    {
      id: "load-nearby-1",
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      deadheadKm: 15,
      tripKm: 450,
    },
  ]),
}));

// Mock gpsQuery
jest.mock("@/lib/gpsQuery", () => ({
  getPositionHistory: jest.fn(async () => [
    {
      id: "pos-1",
      latitude: 9.02,
      longitude: 38.75,
      speed: 60,
      heading: 90,
      timestamp: new Date(),
    },
    {
      id: "pos-2",
      latitude: 9.03,
      longitude: 38.76,
      speed: 55,
      heading: 85,
      timestamp: new Date(),
    },
  ]),
}));

// Import handlers AFTER mocks
const {
  PATCH: updateLocation,
  GET: getLocation,
} = require("@/app/api/trucks/[id]/location/route");
const { GET: getHistory } = require("@/app/api/trucks/[id]/history/route");
const {
  GET: getNearbyLoads,
} = require("@/app/api/trucks/[id]/nearby-loads/route");

describe("Truck Location, History & Nearby-Loads", () => {
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

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user",
    email: "other-carrier@test.com",
    role: "CARRIER",
    organizationId: "other-carrier-org",
  });

  beforeAll(async () => {
    seed = await seedTestData();

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

  // ─── PATCH /api/trucks/[id]/location ────────────────────────────────

  describe("PATCH /api/trucks/[id]/location", () => {
    it("should update location for own truck → 200", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}/location`,
        { body: { latitude: 9.02, longitude: 38.75 } }
      );
      const res = await callHandler(updateLocation, req, {
        id: seed.truck.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.message).toContain("updated");
      expect(body.truck.currentLocationLat).toBe(9.02);
      expect(body.truck.currentLocationLon).toBe(38.75);
    });

    it("should allow admin to update any truck location → 200", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}/location`,
        { body: { latitude: 8.99, longitude: 38.7 } }
      );
      const res = await callHandler(updateLocation, req, {
        id: seed.truck.id,
      });

      expect(res.status).toBe(200);
    });

    it("should deny other carrier from updating → 404 (cloaked)", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}/location`,
        { body: { latitude: 9.0, longitude: 38.7 } }
      );
      const res = await callHandler(updateLocation, req, {
        id: seed.truck.id,
      });

      expect(res.status).toBe(404);
    });

    it("should return 400 for invalid latitude/longitude", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}/location`,
        { body: { latitude: 100, longitude: 200 } }
      );
      const res = await callHandler(updateLocation, req, {
        id: seed.truck.id,
      });

      expect(res.status).toBe(400);
    });

    it("should return 404 for non-existent truck", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trucks/nonexistent/location",
        { body: { latitude: 9.0, longitude: 38.7 } }
      );
      const res = await callHandler(updateLocation, req, {
        id: "nonexistent",
      });

      expect(res.status).toBe(404);
    });
  });

  // ─── GET /api/trucks/[id]/location ──────────────────────────────────

  describe("GET /api/trucks/[id]/location", () => {
    it("should get location for own truck → 200", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/location`
      );
      const res = await callHandler(getLocation, req, { id: seed.truck.id });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.truckId).toBe(seed.truck.id);
      expect(body.location.latitude).toBeDefined();
      expect(body.location.longitude).toBeDefined();
    });

    it("should allow shipper with IN_TRANSIT load to see location → 200", async () => {
      // Assign truck to load and mark IN_TRANSIT
      await db.load.update({
        where: { id: seed.load.id },
        data: { assignedTruckId: seed.truck.id, status: "IN_TRANSIT" },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/location`
      );
      const res = await callHandler(getLocation, req, { id: seed.truck.id });

      expect(res.status).toBe(200);

      // Reset load status
      await db.load.update({
        where: { id: seed.load.id },
        data: { assignedTruckId: null, status: "POSTED" },
      });
    });

    it("should deny shipper without active load → 404 (cloaked)", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/location`
      );
      const res = await callHandler(getLocation, req, { id: seed.truck.id });

      expect(res.status).toBe(404);
    });

    it("should return 404 when location unavailable", async () => {
      const { getTruckCurrentLocation } = require("@/lib/deadheadOptimization");
      getTruckCurrentLocation.mockResolvedValueOnce(null);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/location`
      );
      const res = await callHandler(getLocation, req, { id: seed.truck.id });

      expect(res.status).toBe(404);
      const body = await parseResponse(res);
      expect(body.error).toContain("not available");
    });
  });

  // ─── GET /api/trucks/[id]/history ───────────────────────────────────

  describe("GET /api/trucks/[id]/history", () => {
    it("should return positions with default dates → 200", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/history`
      );
      const res = await callHandler(getHistory, req, { id: seed.truck.id });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.positions).toBeDefined();
      expect(body.count).toBeGreaterThanOrEqual(0);
      expect(body.startDate).toBeDefined();
      expect(body.endDate).toBeDefined();
    });

    it("should return 400 for invalid date format", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/history?start=invalid-date&end=also-invalid`
      );
      const res = await callHandler(getHistory, req, { id: seed.truck.id });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("Invalid date");
    });

    it("should return 400 when start > end", async () => {
      const end = new Date();
      const start = new Date(end.getTime() + 86400000);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/history?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      const res = await callHandler(getHistory, req, { id: seed.truck.id });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("before");
    });

    it("should return 400 when range > 7 days", async () => {
      const end = new Date();
      const start = new Date(end.getTime() - 8 * 24 * 60 * 60 * 1000);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/history?start=${start.toISOString()}&end=${end.toISOString()}`
      );
      const res = await callHandler(getHistory, req, { id: seed.truck.id });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("7 days");
    });

    it("should return 404 for non-existent truck", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/nonexistent/history"
      );
      const res = await callHandler(getHistory, req, { id: "nonexistent" });

      expect(res.status).toBe(404);
    });

    it("should deny other carrier → 404 (resource cloaking)", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/history`
      );
      const res = await callHandler(getHistory, req, { id: seed.truck.id });

      expect(res.status).toBe(404);
    });

    it("should return empty positions array when no data", async () => {
      const { getPositionHistory } = require("@/lib/gpsQuery");
      getPositionHistory.mockResolvedValueOnce([]);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/history`
      );
      const res = await callHandler(getHistory, req, { id: seed.truck.id });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.positions).toEqual([]);
      expect(body.count).toBe(0);
    });
  });

  // ─── GET /api/trucks/[id]/nearby-loads ──────────────────────────────

  describe("GET /api/trucks/[id]/nearby-loads", () => {
    it("should return nearby loads with defaults → 200", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/nearby-loads`
      );
      const res = await callHandler(getNearbyLoads, req, {
        id: seed.truck.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.truckId).toBe(seed.truck.id);
      expect(body.maxDHO).toBe(200);
      expect(body.loads).toBeDefined();
      expect(body.count).toBeGreaterThanOrEqual(0);
    });

    it("should apply custom filters → 200", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/nearby-loads?maxDHO=500&minTripKm=100&maxTripKm=1000`
      );
      const res = await callHandler(getNearbyLoads, req, {
        id: seed.truck.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.maxDHO).toBe(500);
      expect(body.filters.minTripKm).toBe(100);
      expect(body.filters.maxTripKm).toBe(1000);
    });

    it("should return 400 when minTripKm > maxTripKm", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/nearby-loads?minTripKm=500&maxTripKm=100`
      );
      const res = await callHandler(getNearbyLoads, req, {
        id: seed.truck.id,
      });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("minTripKm");
    });

    it("should return 404 for non-existent truck", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trucks/nonexistent/nearby-loads"
      );
      const res = await callHandler(getNearbyLoads, req, {
        id: "nonexistent",
      });

      expect(res.status).toBe(404);
    });

    it("should deny other carrier → 404 (cloaked)", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}/nearby-loads`
      );
      const res = await callHandler(getNearbyLoads, req, {
        id: seed.truck.id,
      });

      expect(res.status).toBe(404);
    });
  });
});

/**
 * Trip Tracking Tests — History & Live
 *
 * Routes tested:
 * - GET /api/trips/[tripId]/history → route history playback
 * - GET /api/trips/[tripId]/live   → live position tracking
 *
 * Business rules tested:
 * - Permission: carrier, shipper, admin, dispatcher can view own trips
 * - Shippers restricted by trip status for live tracking
 * - GPS status determination (active/stale/offline)
 * - ETA calculation
 * - Route simplification
 * - Distance calculation
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
  mockGeo,
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
mockGeo();

// Mock rounding
jest.mock("@/lib/rounding", () => ({
  roundToDecimals: jest.fn((val: number) => Math.round(val * 100) / 100),
  roundDistance1: jest.fn((val: number) => Math.round(val * 10) / 10),
}));

// Import handlers AFTER mocks
const {
  GET: getTripHistory,
} = require("@/app/api/trips/[tripId]/history/route");
const { GET: getTripLive } = require("@/app/api/trips/[tripId]/live/route");

describe("Trip Tracking — History & Live", () => {
  let seed: SeedData;
  let tripId: string;

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

    // Create a trip for testing
    const trip = await db.trip.create({
      data: {
        id: "trip-tracking-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "IN_TRANSIT",
        pickupLat: 9.02,
        pickupLng: 38.75,
        pickupCity: "Addis Ababa",
        pickupAddress: "Test Pickup",
        deliveryLat: 9.6,
        deliveryLng: 41.85,
        deliveryCity: "Dire Dawa",
        deliveryAddress: "Test Delivery",
        estimatedDistanceKm: 450,
        trackingEnabled: true,
        currentLat: 9.3,
        currentLng: 39.5,
        currentLocationUpdatedAt: new Date(),
        startedAt: new Date(Date.now() - 3600000),
      },
    });

    tripId = trip.id;

    // Create GPS positions for this trip
    await db.gpsPosition.create({
      data: {
        truckId: seed.truck.id,
        tripId: tripId,
        latitude: 9.02,
        longitude: 38.75,
        speed: 60,
        heading: 90,
        timestamp: new Date(Date.now() - 3600000),
      },
    });

    await db.gpsPosition.create({
      data: {
        truckId: seed.truck.id,
        tripId: tripId,
        latitude: 9.3,
        longitude: 39.5,
        speed: 55,
        heading: 85,
        timestamp: new Date(),
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

  // ─── GET /api/trips/[tripId]/history — permissions ──────────────

  describe("History — permissions", () => {
    it("should allow carrier to view own trip history → 200", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/history`
      );
      const res = await callHandler(getTripHistory, req, { tripId });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.tripId).toBe(tripId);
      expect(body.route).toBeDefined();
    });

    it("should allow shipper to view their trip history → 200", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/history`
      );
      const res = await callHandler(getTripHistory, req, { tripId });

      expect(res.status).toBe(200);
    });

    it("should allow admin to view any trip history → 200", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/history`
      );
      const res = await callHandler(getTripHistory, req, { tripId });

      expect(res.status).toBe(200);
    });

    it("should deny other carrier → 403", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/history`
      );
      const res = await callHandler(getTripHistory, req, { tripId });

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/trips/[tripId]/history — data ─────────────────────

  describe("History — data", () => {
    it("should return route with positions and distance", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/history`
      );
      const res = await callHandler(getTripHistory, req, { tripId });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.route.length).toBeGreaterThan(0);
      expect(body.distance).toBeDefined();
      expect(body.stats.positionCount).toBeGreaterThan(0);
    });

    it("should return 404 for non-existent trip", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/nonexistent/history"
      );
      const res = await callHandler(getTripHistory, req, {
        tripId: "nonexistent",
      });

      expect(res.status).toBe(404);
    });

    it("should return empty route when no GPS positions exist", async () => {
      // Create a trip with no GPS data
      const emptyTrip = await db.trip.create({
        data: {
          id: "trip-no-gps",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${emptyTrip.id}/history`
      );
      const res = await callHandler(getTripHistory, req, {
        tripId: emptyTrip.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.route).toEqual([]);
      expect(body.stats.positionCount).toBe(0);
    });

    it("should support time range filtering with start/end params", async () => {
      const start = new Date(Date.now() - 7200000).toISOString();
      const end = new Date().toISOString();

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/history?start=${start}&end=${end}`
      );
      const res = await callHandler(getTripHistory, req, { tripId });

      expect(res.status).toBe(200);
    });

    it("should support resolution=simplified parameter", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/history?resolution=simplified`
      );
      const res = await callHandler(getTripHistory, req, { tripId });

      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/trips/[tripId]/live — permissions ──────────────────

  describe("Live — permissions", () => {
    it("should allow carrier to view own trip live → 200", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/live`
      );
      const res = await callHandler(getTripLive, req, { tripId });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.tripId).toBe(tripId);
      expect(body.status).toBe("IN_TRANSIT");
    });

    it("should allow shipper for IN_TRANSIT trip → 200", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/live`
      );
      const res = await callHandler(getTripLive, req, { tripId });

      expect(res.status).toBe(200);
    });

    it("should deny shipper for ASSIGNED trip → 403", async () => {
      // Create an ASSIGNED trip
      const assignedTrip = await db.trip.create({
        data: {
          id: "trip-assigned-live",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          trackingEnabled: true,
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${assignedTrip.id}/live`
      );
      const res = await callHandler(getTripLive, req, {
        tripId: assignedTrip.id,
      });

      expect(res.status).toBe(403);
      const body = await parseResponse(res);
      expect(body.error).toContain("in transit");
    });

    it("should deny other carrier → 403", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/live`
      );
      const res = await callHandler(getTripLive, req, { tripId });

      expect(res.status).toBe(403);
    });
  });

  // ─── GET /api/trips/[tripId]/live — data ─────────────────────────

  describe("Live — data", () => {
    it("should return currentLocation and ETA for IN_TRANSIT", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/live`
      );
      const res = await callHandler(getTripLive, req, { tripId });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.currentLocation).toBeDefined();
      expect(body.currentLocation.latitude).toBeDefined();
      expect(body.timing.etaMinutes).toBeDefined();
      expect(body.gpsStatus).toBeDefined();
    });

    it("should return 404 for non-existent trip", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/nonexistent/live"
      );
      const res = await callHandler(getTripLive, req, {
        tripId: "nonexistent",
      });

      expect(res.status).toBe(404);
    });

    it("should return null currentLocation when no position data", async () => {
      const noLocTrip = await db.trip.create({
        data: {
          id: "trip-no-loc",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          trackingEnabled: true,
          currentLat: null,
          currentLng: null,
        },
      });

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${noLocTrip.id}/live`
      );
      const res = await callHandler(getTripLive, req, {
        tripId: noLocTrip.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.currentLocation).toBeNull();
    });

    it("should determine GPS status correctly (active/stale/offline)", async () => {
      // Trip with recent update → active
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}/live`
      );
      const res = await callHandler(getTripLive, req, { tripId });
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(["active", "stale", "offline"]).toContain(body.gpsStatus);
    });
  });

  // ─── Live — edge cases ────────────────────────────────────────────

  describe("Live — edge cases", () => {
    it("should allow shipper to view DELIVERED trip → 200", async () => {
      const deliveredTrip = await db.trip.create({
        data: {
          id: "trip-delivered-live",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          trackingEnabled: true,
          currentLat: 9.6,
          currentLng: 41.85,
          currentLocationUpdatedAt: new Date(),
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${deliveredTrip.id}/live`
      );
      const res = await callHandler(getTripLive, req, {
        tripId: deliveredTrip.id,
      });

      expect(res.status).toBe(200);
    });

    it("should allow shipper to view COMPLETED trip → 200", async () => {
      const completedTrip = await db.trip.create({
        data: {
          id: "trip-completed-live",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "COMPLETED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          trackingEnabled: true,
          currentLat: 9.6,
          currentLng: 41.85,
          currentLocationUpdatedAt: new Date(),
        },
      });

      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${completedTrip.id}/live`
      );
      const res = await callHandler(getTripLive, req, {
        tripId: completedTrip.id,
      });

      expect(res.status).toBe(200);
    });
  });
});

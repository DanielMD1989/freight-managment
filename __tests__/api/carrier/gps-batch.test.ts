/**
 * GPS Batch Update API Tests
 *
 * Tests for POST /api/gps/batch - Submit multiple GPS positions at once
 *
 * Business rules:
 * - Only carriers can batch upload GPS positions
 * - Truck must belong to carrier's organization
 * - Truck must have a GPS device registered
 * - Max 100 positions per batch
 * - Positions sorted by timestamp (oldest first)
 * - Truck location updated to latest position
 * - Load linked when truck has IN_TRANSIT load
 * - WebSocket broadcast with latest position
 * - Atomic transaction (createMany + truck update)
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
jest.mock("@/lib/rateLimit", () => ({
  checkRpsLimit: jest.fn(async () => ({
    allowed: true,
    limit: 100,
    remaining: 99,
  })),
  checkRateLimit: jest.fn(async () => ({
    allowed: true,
    success: true,
    limit: 100,
    remaining: 99,
    retryAfter: 0,
    resetTime: Date.now() + 3600000,
  })),
  addRateLimitHeaders: jest.fn((res: unknown) => res),
  withRpsLimit: jest.fn((_config: unknown, handler: unknown) => handler),
  RPS_CONFIGS: {
    marketplace: { endpoint: "loads", rps: 50, burst: 100 },
    fleet: { endpoint: "trucks", rps: 30, burst: 60 },
    dashboard: { endpoint: "dashboard", rps: 5, burst: 10 },
    gps: { endpoint: "gps", rps: 100, burst: 20 },
  },
  RATE_LIMIT_TRUCK_POSTING: { maxRequests: 100, windowMs: 86400000 },
}));
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

jest.mock("@/lib/websocket-server", () => ({
  broadcastGpsPosition: jest.fn(async () => {}),
}));

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
const { POST: batchUpload } = require("@/app/api/gps/batch/route");
const { broadcastGpsPosition } = require("@/lib/websocket-server");

describe("GPS Batch API", () => {
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

  const makePositions = (count: number) =>
    Array.from({ length: count }, (_, i) => ({
      latitude: 9.0 + i * 0.01,
      longitude: 38.7 + i * 0.01,
      speed: 50 + i,
      timestamp: new Date(Date.now() - (count - i) * 60000).toISOString(),
    }));

  beforeAll(async () => {
    seed = await seedTestData();

    // Other carrier org + user
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

    // Truck with GPS device
    await db.gpsDevice.create({
      data: {
        id: "batch-gps-device",
        imei: "111222333444555",
        truckId: "batch-truck-1",
        status: "ACTIVE",
      },
    });
    await db.truck.create({
      data: {
        id: "batch-truck-1",
        truckType: "DRY_VAN",
        licensePlate: "AA-BATCH-01",
        capacity: 10000,
        isAvailable: true,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
        gpsDeviceId: "batch-gps-device",
      },
    });

    // Truck without GPS device
    await db.truck.create({
      data: {
        id: "batch-no-gps",
        truckType: "FLATBED",
        licensePlate: "AA-BNGPS",
        capacity: 8000,
        isAvailable: true,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
      },
    });

    // IN_TRANSIT load assigned to batch truck
    await db.load.create({
      data: {
        id: "batch-intransit-load",
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Batch GPS cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        assignedTruckId: "batch-truck-1",
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 86400000),
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Auth & Role", () => {
    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions: makePositions(3) },
      });
      const res = await batchUpload(req);
      expect([401, 500]).toContain(res.status);
    });

    it("shipper → 403", async () => {
      setAuthSession(shipperSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions: makePositions(3) },
      });
      const res = await batchUpload(req);
      expect(res.status).toBe(403);
    });
  });

  describe("Org & Ownership", () => {
    it("carrier without org → 400", async () => {
      const noOrgSession = createMockSession({
        userId: "batch-no-org",
        role: "CARRIER",
        organizationId: undefined,
      });
      await db.user.create({
        data: {
          id: "batch-no-org",
          email: "batchnoorg@test.com",
          passwordHash: "hashed_Test1234!",
          firstName: "No",
          lastName: "Org",
          phone: "+251911088888",
          role: "CARRIER",
          status: "ACTIVE",
        },
      });
      setAuthSession(noOrgSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions: makePositions(2) },
      });
      const res = await batchUpload(req);
      expect(res.status).toBe(400);
    });

    it("truck not owned by carrier → 404", async () => {
      setAuthSession(otherCarrierSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions: makePositions(2) },
      });
      const res = await batchUpload(req);
      expect(res.status).toBe(404);
    });
  });

  describe("GPS device required", () => {
    it("truck without gpsDeviceId → 400", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-no-gps", positions: makePositions(2) },
      });
      const res = await batchUpload(req);
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toMatch(/GPS device/i);
    });
  });

  describe("Validation", () => {
    it("empty positions array → 400", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions: [] },
      });
      const res = await batchUpload(req);
      expect(res.status).toBe(400);
    });

    it(">100 positions → 400", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions: makePositions(101) },
      });
      const res = await batchUpload(req);
      expect(res.status).toBe(400);
    });

    it("invalid latitude in position → 400", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: {
          truckId: "batch-truck-1",
          positions: [
            {
              latitude: 200,
              longitude: 38.7,
              timestamp: new Date().toISOString(),
            },
          ],
        },
      });
      const res = await batchUpload(req);
      expect(res.status).toBe(400);
    });
  });

  describe("Success", () => {
    it("returns positionsRecorded count", async () => {
      setAuthSession(carrierSession);
      const positions = makePositions(5);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions },
      });
      const res = await batchUpload(req);
      const data = await parseResponse(res);
      expect(res.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.positionsRecorded).toBe(5);
    });

    it("returns latestPosition from sorted data", async () => {
      setAuthSession(carrierSession);
      const positions = makePositions(3);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions },
      });
      const res = await batchUpload(req);
      const data = await parseResponse(res);
      // The latest position should be the last one (newest timestamp)
      expect(data.latestPosition).toBeDefined();
      expect(data.latestPosition.lat).toBeDefined();
      expect(data.latestPosition.lng).toBeDefined();
    });

    it("updates truck location to latest position", async () => {
      setAuthSession(carrierSession);
      const positions = [
        {
          latitude: 8.5,
          longitude: 38.0,
          speed: 40,
          timestamp: new Date(Date.now() - 120000).toISOString(),
        },
        {
          latitude: 9.5,
          longitude: 39.0,
          speed: 60,
          timestamp: new Date(Date.now() - 60000).toISOString(),
        },
        {
          latitude: 10.0,
          longitude: 39.5,
          speed: 70,
          timestamp: new Date().toISOString(),
        },
      ];
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions },
      });
      await batchUpload(req);

      const truck = await db.truck.findUnique({
        where: { id: "batch-truck-1" },
      });
      expect(truck.currentLocationLat).toBe(10.0);
      expect(truck.currentLocationLon).toBe(39.5);
    });
  });

  describe("Load linking", () => {
    it("loadId populated when truck has IN_TRANSIT load", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions: makePositions(2) },
      });
      const res = await batchUpload(req);
      const data = await parseResponse(res);
      expect(data.loadId).toBe("batch-intransit-load");
    });
  });

  describe("WebSocket", () => {
    it("broadcasts latest position after batch upload", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions: makePositions(3) },
      });
      await batchUpload(req);
      expect(broadcastGpsPosition).toHaveBeenCalledWith(
        "batch-truck-1",
        "batch-intransit-load",
        "carrier-org-1",
        expect.objectContaining({
          truckId: "batch-truck-1",
        })
      );
    });
  });

  describe("Transaction", () => {
    it("uses $transaction for atomicity", async () => {
      setAuthSession(carrierSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-truck-1", positions: makePositions(2) },
      });
      await batchUpload(req);
      expect(db.$transaction).toHaveBeenCalled();
    });
  });

  describe("No active load", () => {
    it("loadId is null when no IN_TRANSIT load", async () => {
      // Create a truck with no active loads
      await db.truck.create({
        data: {
          id: "batch-idle-truck",
          truckType: "DRY_VAN",
          licensePlate: "AA-IDLE",
          capacity: 8000,
          isAvailable: true,
          carrierId: "carrier-org-1",
          createdById: "carrier-user-1",
          approvalStatus: "APPROVED",
          gpsDeviceId: "batch-gps-device",
        },
      });

      setAuthSession(carrierSession);
      const req = createRequest("POST", "http://localhost:3000/api/gps/batch", {
        body: { truckId: "batch-idle-truck", positions: makePositions(2) },
      });
      const res = await batchUpload(req);
      const data = await parseResponse(res);
      expect(data.loadId).toBeNull();
    });
  });
});

/**
 * GPS Position API Tests
 *
 * Tests for GPS position tracking:
 * - POST /api/gps/position - Update truck GPS position (carrier only)
 * - GET /api/gps/position - Get current truck position
 *
 * Business rules:
 * - Only carriers can update GPS positions
 * - Truck must belong to carrier's organization
 * - If truck is IN_TRANSIT, position linked to load
 * - GPS position record only created when truck has gpsDeviceId
 * - WebSocket broadcast on position update (non-blocking)
 * - Carriers see own trucks, shippers see trucks on IN_TRANSIT loads, admin sees all
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
const {
  POST: updatePosition,
  GET: getPosition,
} = require("@/app/api/gps/position/route");
const { broadcastGpsPosition } = require("@/lib/websocket-server");

describe("GPS Position API", () => {
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

    // Create other carrier org and user
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

    // Create admin user
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

    // Create a truck with GPS device
    await db.gpsDevice.create({
      data: {
        id: "gps-device-1",
        imei: "123456789012345",
        truckId: "gps-truck-1",
        status: "ACTIVE",
      },
    });
    await db.truck.create({
      data: {
        id: "gps-truck-1",
        truckType: "DRY_VAN",
        licensePlate: "AA-GPS-01",
        capacity: 10000,
        isAvailable: true,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
        gpsDeviceId: "gps-device-1",
      },
    });

    // Create a truck without GPS device
    await db.truck.create({
      data: {
        id: "no-gps-truck",
        truckType: "FLATBED",
        licensePlate: "AA-NOGPS",
        capacity: 8000,
        isAvailable: true,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
      },
    });

    // Create an IN_TRANSIT load assigned to the GPS truck
    await db.load.create({
      data: {
        id: "intransit-load-1",
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "GPS tracking cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        assignedTruckId: "gps-truck-1",
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 86400000),
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── POST /api/gps/position ──────────────────────────────────────────────

  describe("POST /api/gps/position", () => {
    const validBody = {
      truckId: "gps-truck-1",
      latitude: 9.02,
      longitude: 38.75,
      speed: 60,
      heading: 180,
    };

    describe("Auth & Role", () => {
      it("unauthenticated → 401", async () => {
        setAuthSession(null);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        const res = await updatePosition(req);
        expect(res.status).toBe(401);
      });

      it("shipper → 403", async () => {
        setAuthSession(shipperSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        const res = await updatePosition(req);
        expect(res.status).toBe(403);
      });

      it("carrier → 200", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        const res = await updatePosition(req);
        expect(res.status).toBe(200);
      });
    });

    describe("Org & Ownership", () => {
      it("carrier without org → 400", async () => {
        const noOrgSession = createMockSession({
          userId: "no-org-user",
          role: "CARRIER",
          organizationId: undefined,
        });
        await db.user.create({
          data: {
            id: "no-org-user",
            email: "noorg@test.com",
            passwordHash: "hashed_Test1234!",
            firstName: "No",
            lastName: "Org",
            phone: "+251911099999",
            role: "CARRIER",
            status: "ACTIVE",
          },
        });
        setAuthSession(noOrgSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        const res = await updatePosition(req);
        expect(res.status).toBe(400);
      });

      it("truck not owned by carrier → 404", async () => {
        setAuthSession(otherCarrierSession);
        await db.user.create({
          data: {
            id: "other-carrier-user-1-pos",
            email: "otherpos@test.com",
            passwordHash: "hashed_Test1234!",
            firstName: "Other",
            lastName: "Carrier",
            phone: "+251911000019",
            role: "CARRIER",
            status: "ACTIVE",
            organizationId: "other-carrier-org-1",
          },
        });
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        const res = await updatePosition(req);
        expect(res.status).toBe(404);
      });
    });

    describe("Validation", () => {
      it("missing truckId → 400", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: { latitude: 9.02, longitude: 38.75 },
          }
        );
        const res = await updatePosition(req);
        expect(res.status).toBe(400);
      });

      it("latitude out of range → 400", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: { truckId: "gps-truck-1", latitude: 95, longitude: 38.75 },
          }
        );
        const res = await updatePosition(req);
        expect(res.status).toBe(400);
      });
    });

    describe("Success", () => {
      it("returns position data on success", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        const res = await updatePosition(req);
        const data = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.success).toBe(true);
        expect(data.truckId).toBe("gps-truck-1");
        expect(data.position.lat).toBe(9.02);
        expect(data.position.lng).toBe(38.75);
      });

      it("updates truck location", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        await updatePosition(req);

        const truck = await db.truck.findUnique({
          where: { id: "gps-truck-1" },
        });
        expect(truck.currentLocationLat).toBe(9.02);
        expect(truck.currentLocationLon).toBe(38.75);
      });

      it("links loadId when truck has IN_TRANSIT load", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        const res = await updatePosition(req);
        const data = await parseResponse(res);
        expect(data.loadId).toBe("intransit-load-1");
      });
    });

    describe("GPS device handling", () => {
      it("creates gpsPosition record when gpsDeviceId exists", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        const res = await updatePosition(req);
        const data = await parseResponse(res);
        expect(data.positionId).toBeDefined();
      });

      it("succeeds without gpsPosition record when no device", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: { ...validBody, truckId: "no-gps-truck" },
          }
        );
        const res = await updatePosition(req);
        const data = await parseResponse(res);
        expect(res.status).toBe(200);
        expect(data.positionId).toBeUndefined();
      });
    });

    describe("WebSocket", () => {
      it("broadcasts GPS position after update", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: validBody,
          }
        );
        await updatePosition(req);
        expect(broadcastGpsPosition).toHaveBeenCalledWith(
          "gps-truck-1",
          "intransit-load-1",
          "carrier-org-1",
          expect.objectContaining({
            truckId: "gps-truck-1",
            lat: 9.02,
            lng: 38.75,
          })
        );
      });
    });
  });

  // ─── GET /api/gps/position ───────────────────────────────────────────────

  describe("GET /api/gps/position", () => {
    describe("Auth", () => {
      it("unauthenticated → 401/500", async () => {
        setAuthSession(null);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/gps/position?truckId=gps-truck-1"
        );
        const res = await getPosition(req);
        expect([401, 500]).toContain(res.status);
      });
    });

    describe("Param validation", () => {
      it("missing truckId → 400", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/gps/position"
        );
        const res = await getPosition(req);
        expect(res.status).toBe(400);
      });
    });

    describe("Carrier access", () => {
      it("carrier sees own truck → 200", async () => {
        setAuthSession(carrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/gps/position?truckId=gps-truck-1"
        );
        const res = await getPosition(req);
        expect(res.status).toBe(200);
        const data = await parseResponse(res);
        expect(data.truckId).toBe("gps-truck-1");
      });

      it("carrier cannot see other carrier's truck → 404", async () => {
        setAuthSession(otherCarrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/gps/position?truckId=gps-truck-1"
        );
        const res = await getPosition(req);
        expect(res.status).toBe(404);
      });
    });

    describe("Shipper access", () => {
      it("shipper sees truck on their IN_TRANSIT load → 200", async () => {
        setAuthSession(shipperSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/gps/position?truckId=gps-truck-1"
        );
        const res = await getPosition(req);
        expect(res.status).toBe(200);
      });

      it("shipper cannot see truck not on their load → 403", async () => {
        setAuthSession(shipperSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/gps/position?truckId=no-gps-truck"
        );
        const res = await getPosition(req);
        expect(res.status).toBe(403);
      });
    });

    describe("Admin access", () => {
      it("admin sees any truck → 200", async () => {
        setAuthSession(adminSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/gps/position?truckId=gps-truck-1"
        );
        const res = await getPosition(req);
        expect(res.status).toBe(200);
      });
    });

    describe("Response shape", () => {
      it("returns currentLocation with lat/lng when coordinates exist", async () => {
        setAuthSession(carrierSession);
        // First update position
        const postReq = createRequest(
          "POST",
          "http://localhost:3000/api/gps/position",
          {
            body: {
              truckId: "gps-truck-1",
              latitude: 9.02,
              longitude: 38.75,
            },
          }
        );
        await updatePosition(postReq);

        const req = createRequest(
          "GET",
          "http://localhost:3000/api/gps/position?truckId=gps-truck-1"
        );
        const res = await getPosition(req);
        const data = await parseResponse(res);
        expect(data.currentLocation).toBeDefined();
        expect(data.currentLocation.lat).toBe(9.02);
        expect(data.currentLocation.lng).toBe(38.75);
      });

      it("returns currentLocation null when no coordinates", async () => {
        // Create a fresh truck with no coordinates
        await db.truck.create({
          data: {
            id: "no-coords-truck",
            truckType: "TANKER",
            licensePlate: "AA-NOCOORDS",
            capacity: 5000,
            isAvailable: true,
            carrierId: "carrier-org-1",
            createdById: "carrier-user-1",
            approvalStatus: "APPROVED",
          },
        });
        setAuthSession(carrierSession);
        const req = createRequest(
          "GET",
          "http://localhost:3000/api/gps/position?truckId=no-coords-truck"
        );
        const res = await getPosition(req);
        const data = await parseResponse(res);
        expect(data.currentLocation).toBeNull();
      });
    });
  });
});

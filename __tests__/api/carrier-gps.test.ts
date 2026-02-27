/**
 * Carrier GPS API Tests
 *
 * Tests the GPS tracking endpoints:
 * - GET /api/carrier/gps - Carrier fleet GPS data
 * - GET /api/gps/devices - List GPS devices (admin/ops)
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
mockRbac();

// Import route handlers AFTER mocks (use require so mocks are applied)
const { GET: getCarrierGPS } = require("@/app/api/carrier/gps/route");
const { GET: listGPSDevices } = require("@/app/api/gps/devices/route");

describe("Carrier GPS API", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Create a GPS device linked to the seeded truck
    await db.gpsDevice.create({
      data: {
        id: "gps-device-001",
        imei: "123456789012345",
        status: "ACTIVE",
        truckId: seed.truck.id,
        lastSeenAt: new Date(),
      },
    });

    // Update the truck record to include the gpsDevice relation data
    // (the mock DB does not resolve relations, so we embed it directly)
    await db.truck.update({
      where: { id: seed.truck.id },
      data: {
        gpsDevice: {
          id: "gps-device-001",
          imei: "123456789012345",
          status: "ACTIVE",
          lastSeenAt: new Date(),
        },
      },
    });

    // Create a second truck without a GPS device
    await db.truck.create({
      data: {
        id: "test-truck-002",
        truckType: "FLATBED",
        licensePlate: "AA-67890",
        capacity: 15000,
        isAvailable: true,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
        currentCity: "Dire Dawa",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GET /api/carrier/gps ─────────────────────────────────────────────────

  describe("GET /api/carrier/gps", () => {
    it("returns 401 for unauthenticated requests", async () => {
      setAuthSession(null);

      const req = createRequest("GET", "http://localhost:3000/api/carrier/gps");
      const res = await callHandler(getCarrierGPS, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(401);
      expect(body.error).toBeDefined();
    });

    it("returns GPS data for a carrier user", async () => {
      setAuthSession(
        createMockSession({
          userId: "carrier-user-1",
          role: "CARRIER",
          organizationId: "carrier-org-1",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/carrier/gps");
      const res = await callHandler(getCarrierGPS, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.trucks).toBeDefined();
      expect(Array.isArray(body.trucks)).toBe(true);
      expect(body.trucks.length).toBeGreaterThanOrEqual(1);
    });

    it("returns 403 for shipper users", async () => {
      setAuthSession(
        createMockSession({
          userId: "shipper-user-1",
          role: "SHIPPER",
          organizationId: "shipper-org-1",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/carrier/gps");
      const res = await callHandler(getCarrierGPS, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(body.error).toBeDefined();
    });

    it("returns 400 when carrier has no organizationId", async () => {
      setAuthSession(
        createMockSession({
          userId: "carrier-user-1",
          role: "CARRIER",
          organizationId: undefined,
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/carrier/gps");
      const res = await callHandler(getCarrierGPS, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(400);
      expect(body.error).toMatch(/organization/i);
    });

    it("includes gpsDevice data for trucks with GPS devices", async () => {
      setAuthSession(
        createMockSession({
          userId: "carrier-user-1",
          role: "CARRIER",
          organizationId: "carrier-org-1",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/carrier/gps");
      const res = await callHandler(getCarrierGPS, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);

      const truckWithGps = body.trucks.find(
        (t: { id: string }) => t.id === "test-truck-001"
      );
      expect(truckWithGps).toBeDefined();
      expect(truckWithGps.gpsDevice).toBeDefined();
      expect(truckWithGps.gpsDevice).not.toBeNull();
      expect(truckWithGps.gpsDevice.imei).toBe("123456789012345");
      expect(truckWithGps.gpsDevice.status).toBe("ACTIVE");
    });

    it("returns null gpsDevice for trucks without GPS devices", async () => {
      setAuthSession(
        createMockSession({
          userId: "carrier-user-1",
          role: "CARRIER",
          organizationId: "carrier-org-1",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/carrier/gps");
      const res = await callHandler(getCarrierGPS, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);

      const truckWithoutGps = body.trucks.find(
        (t: { id: string }) => t.id === "test-truck-002"
      );
      expect(truckWithoutGps).toBeDefined();
      expect(truckWithoutGps.gpsDevice).toBeNull();
    });

    it("includes a timestamp in the response", async () => {
      setAuthSession(
        createMockSession({
          userId: "carrier-user-1",
          role: "CARRIER",
          organizationId: "carrier-org-1",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/carrier/gps");
      const res = await callHandler(getCarrierGPS, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.timestamp).toBeDefined();
      expect(typeof body.timestamp).toBe("string");
      // Verify it parses as a valid ISO date
      const parsed = new Date(body.timestamp);
      expect(parsed.getTime()).not.toBeNaN();
    });

    it("returns 403 for dispatcher users", async () => {
      setAuthSession(
        createMockSession({
          userId: "dispatcher-user-1",
          role: "DISPATCHER",
          organizationId: "dispatcher-org-1",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/carrier/gps");
      const res = await callHandler(getCarrierGPS, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(403);
      expect(body.error).toBeDefined();
    });

    it("allows admin users to access GPS data", async () => {
      setAuthSession(
        createMockSession({
          userId: "admin-user-1",
          role: "ADMIN",
          organizationId: "carrier-org-1",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/carrier/gps");
      const res = await callHandler(getCarrierGPS, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.trucks).toBeDefined();
      expect(body.timestamp).toBeDefined();
    });
  });

  // ─── GET /api/gps/devices ─────────────────────────────────────────────────

  describe("GET /api/gps/devices", () => {
    it("returns 500 for unauthenticated requests", async () => {
      // The GPS devices route does not use handleApiError;
      // its generic catch block returns 500 for any error
      setAuthSession(null);

      const req = createRequest("GET", "http://localhost:3000/api/gps/devices");
      const res = await callHandler(listGPSDevices, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(500);
      expect(body.error).toBeDefined();
    });

    it("returns a list of GPS devices for authorized users", async () => {
      setAuthSession(
        createMockSession({
          userId: "admin-user-1",
          role: "ADMIN",
          organizationId: "carrier-org-1",
        })
      );

      const req = createRequest("GET", "http://localhost:3000/api/gps/devices");
      const res = await callHandler(listGPSDevices, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.devices).toBeDefined();
      expect(Array.isArray(body.devices)).toBe(true);
    });
  });
});

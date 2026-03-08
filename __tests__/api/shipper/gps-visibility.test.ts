/**
 * Shipper GPS Visibility Tests (Round A19)
 *
 * Blueprint v1.2 §3:
 * - Live GPS tracking: Shipper can see truck's real-time location during active trip (IN_TRANSIT only).
 * - No GPS access before trip starts or on any other truck.
 * - Route history: After completion (COMPLETED), Shipper can view full route.
 *
 * Tests (GV-1 … GV-6):
 * GV-1: Shipper gets 200 for live GPS when load is IN_TRANSIT
 * GV-2: Shipper gets 403 for live GPS when load is ASSIGNED (not IN_TRANSIT)
 * GV-3: Shipper gets 403 for live GPS when load is PICKUP_PENDING (not IN_TRANSIT)
 * GV-4: Shipper gets 200 for route history when load is COMPLETED
 * GV-5: Shipper gets 403 for route history when load is DELIVERED (not COMPLETED)
 * GV-6: Shipper gets 404 for route history on another shipper's load (resource cloaking)
 */

// @jest-environment node

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
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
} from "../../utils/routeTestUtils";

// ─── Module-level mocks ────────────────────────────────────────────────────────

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
  calculateDistanceKm: jest.fn(() => 0),
}));

jest.mock("@/lib/rounding", () => ({
  roundToDecimals: jest.fn((v: number, d: number) => Number(v.toFixed(d))),
}));

// Route handlers — imported AFTER all mocks
const { GET: getLive } = require("@/app/api/gps/live/route");
const { GET: getHistory } = require("@/app/api/gps/history/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  email: "shipper@test.com",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
});

// other-shipper-org-1 is used via setAuthSession in GV-6 by matching shipper-user-1 (not org)
// GV-6 verifies resource cloaking (404) via shipper-org-1 on another org's load

// ─── Test IDs ─────────────────────────────────────────────────────────────────

const TRUCK_ID = "gv-truck-1";
const LOAD_IN_TRANSIT = "gv-load-in-transit";
const LOAD_ASSIGNED = "gv-load-assigned";
const LOAD_PICKUP_PENDING = "gv-load-pickup-pending";
const LOAD_COMPLETED = "gv-load-completed";
const LOAD_DELIVERED = "gv-load-delivered";
const OTHER_LOAD = "gv-load-other-shipper";

describe("Shipper GPS Visibility (A19 — Blueprint v1.2)", () => {
  beforeAll(async () => {
    await seedTestData();

    // Other shipper org
    await db.organization.create({
      data: {
        id: "other-shipper-org-1",
        name: "Other Shipper",
        type: "SHIPPER",
        contactEmail: "other@test.com",
        contactPhone: "+251911000099",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "other-shipper-user-1",
        email: "other@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Other",
        lastName: "Shipper",
        phone: "+251911000099",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "other-shipper-org-1",
      },
    });

    // Truck assigned to carrier-org-1
    await db.truck.create({
      data: {
        id: TRUCK_ID,
        truckType: "DRY_VAN",
        licensePlate: "AA-GV-001",
        capacity: 10000,
        isAvailable: false,
        carrierId: "carrier-org-1",
        createdById: "carrier-user-1",
        approvalStatus: "APPROVED",
        currentLocationLat: 9.0,
        currentLocationLon: 38.7,
      },
    });

    // Loads in various states (all owned by shipper-org-1 except OTHER_LOAD)
    const loadBase = {
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      truckType: "DRY_VAN" as const,
      weight: 5000,
      cargoDescription: "GPS visibility test",
      shipperId: "shipper-org-1",
      createdById: "shipper-user-1",
      assignedTruckId: TRUCK_ID,
      pickupDate: new Date(),
      deliveryDate: new Date(Date.now() + 86400000),
    };

    await db.load.create({
      data: { id: LOAD_IN_TRANSIT, status: "IN_TRANSIT", ...loadBase },
    });
    await db.load.create({
      data: { id: LOAD_ASSIGNED, status: "ASSIGNED", ...loadBase },
    });
    await db.load.create({
      data: { id: LOAD_PICKUP_PENDING, status: "PICKUP_PENDING", ...loadBase },
    });
    await db.load.create({
      data: { id: LOAD_COMPLETED, status: "COMPLETED", ...loadBase },
    });
    await db.load.create({
      data: { id: LOAD_DELIVERED, status: "DELIVERED", ...loadBase },
    });
    await db.load.create({
      data: {
        id: OTHER_LOAD,
        status: "COMPLETED",
        ...loadBase,
        shipperId: "other-shipper-org-1",
        createdById: "other-shipper-user-1",
      },
    });
  });

  afterAll(() => clearAllStores());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── Live GPS ─────────────────────────────────────────────────────────────

  describe("GET /api/gps/live?loadId= (A19-1)", () => {
    it("GV-1: Shipper gets 200 when load is IN_TRANSIT", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/gps/live?loadId=${LOAD_IN_TRANSIT}`
      );
      const res = await getLive(req);
      expect(res.status).toBe(200);
    });

    it("GV-2: Shipper gets 403 when load is ASSIGNED (not yet IN_TRANSIT)", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/gps/live?loadId=${LOAD_ASSIGNED}`
      );
      const res = await getLive(req);
      expect(res.status).toBe(403);
    });

    it("GV-3: Shipper gets 403 when load is PICKUP_PENDING (not yet IN_TRANSIT)", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/gps/live?loadId=${LOAD_PICKUP_PENDING}`
      );
      const res = await getLive(req);
      expect(res.status).toBe(403);
    });
  });

  // ─── Route History ────────────────────────────────────────────────────────

  describe("GET /api/gps/history?loadId= (A19-2)", () => {
    it("GV-4: Shipper gets 200 for route history when load is COMPLETED", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/gps/history?loadId=${LOAD_COMPLETED}`
      );
      const res = await getHistory(req);
      expect(res.status).toBe(200);
    });

    it("GV-5: Shipper gets 403 for route history when load is DELIVERED (not COMPLETED)", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/gps/history?loadId=${LOAD_DELIVERED}`
      );
      const res = await getHistory(req);
      expect(res.status).toBe(403);
    });

    it("GV-6: Shipper gets 404 for route history on another shipper's load (resource cloaking)", async () => {
      setAuthSession(shipperSession);
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/gps/history?loadId=${OTHER_LOAD}`
      );
      const res = await getHistory(req);
      expect(res.status).toBe(404);
    });
  });
});

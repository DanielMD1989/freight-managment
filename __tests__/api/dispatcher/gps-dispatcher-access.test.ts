// @jest-environment node
/**
 * GPS Dispatcher Access Tests — Round U2-FULL
 *
 * Per-load and bulk GPS access matrix for GET /api/gps/live.
 *
 * Tests GDA-1 to GDA-8.
 *
 * Note: GPS route uses `requireActiveUser` (not `requireAuth`).
 * All sessions must have status: "ACTIVE".
 * The route is wrapped with withRpsLimit — mockRateLimit() unwraps it.
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
  mockServiceFee,
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
  SeedData,
} from "../../utils/routeTestUtils";

// ─── Module-level mocks ───────────────────────────────────────────────────────

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
mockServiceFee();
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
}));

// Import handler AFTER mocks (withRpsLimit is unwrapped by mockRateLimit)
const { GET: getGpsLive } = require("@/app/api/gps/live/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────
// Note: all sessions need status: "ACTIVE" because route uses requireActiveUser

let dispatcherSession: ReturnType<typeof createMockSession>;
let carrierOwnSession: ReturnType<typeof createMockSession>;
let carrierWrongSession: ReturnType<typeof createMockSession>;
let shipperOwnSession: ReturnType<typeof createMockSession>;
let shipperWrongSession: ReturnType<typeof createMockSession>;

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("GPS Dispatcher Access — Round U2-FULL", () => {
  let seed: SeedData;
  let inTransitLoadId: string;
  let postedLoadId: string;
  let wrongShipperLoadId: string;
  let truckId: string;

  beforeAll(async () => {
    seed = await seedTestData();
    truckId = seed.truck.id;

    // Sessions with real org IDs
    dispatcherSession = createMockSession({
      userId: "gda-dispatcher-1",
      email: "gda-dispatcher@test.com",
      role: "DISPATCHER",
      status: "ACTIVE",
      organizationId: "gda-dispatcher-org",
    });

    carrierOwnSession = createMockSession({
      userId: "gda-carrier-own",
      email: "gda-carrier-own@test.com",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: seed.carrierOrg.id,
    });

    carrierWrongSession = createMockSession({
      userId: "gda-carrier-wrong",
      email: "gda-carrier-wrong@test.com",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: "gda-wrong-carrier-org",
    });

    shipperOwnSession = createMockSession({
      userId: "gda-shipper-own",
      email: "gda-shipper-own@test.com",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: seed.shipperOrg.id,
    });

    shipperWrongSession = createMockSession({
      userId: "gda-shipper-wrong",
      email: "gda-shipper-wrong@test.com",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "gda-wrong-shipper-org",
    });

    // Create users (db.user.findUnique is called for organizationId lookup)
    for (const u of [
      dispatcherSession,
      carrierOwnSession,
      carrierWrongSession,
      shipperOwnSession,
      shipperWrongSession,
    ]) {
      await db.user.create({
        data: {
          id: u.userId,
          email: u.email,
          role: u.role as any,
          organizationId: u.organizationId,
          firstName: u.role,
          lastName: "GDA",
          status: "ACTIVE",
          passwordHash: "mock-hash",
        },
      });
    }

    // IN_TRANSIT load assigned to carrier's truck
    const inTransitLoad = await db.load.create({
      data: {
        id: "gda-load-in-transit",
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "GDA in-transit test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });
    inTransitLoadId = inTransitLoad.id;

    // POSTED load assigned to carrier's truck (for GDA-5: SHIPPER gets 403 because not IN_TRANSIT)
    const postedLoad = await db.load.create({
      data: {
        id: "gda-load-posted",
        status: "POSTED",
        pickupCity: "Dire Dawa",
        deliveryCity: "Mekelle",
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "GDA posted test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });
    postedLoadId = postedLoad.id;

    // Load belonging to wrong shipper (for GDA-6: SHIPPER gets 404)
    const wrongShipperLoad = await db.load.create({
      data: {
        id: "gda-load-wrong-shipper",
        status: "IN_TRANSIT",
        pickupCity: "Jimma",
        deliveryCity: "Bahir Dar",
        truckType: "DRY_VAN",
        weight: 2000,
        cargoDescription: "GDA wrong shipper test",
        shipperId: seed.shipperOrg.id, // real shipper org owns it
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });
    wrongShipperLoadId = wrongShipperLoad.id;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── GDA-1: DISPATCHER loadId → 200 ──────────────────────────────────────────

  it("GDA-1 — DISPATCHER GET ?loadId= → 200 (no org scope applied)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/gps/live?loadId=${inTransitLoadId}`
    );

    const res = await callHandler(getGpsLive, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.loadId).toBe(inTransitLoadId);
  });

  // ─── GDA-2: CARRIER owns assigned truck → 200 ────────────────────────────────

  it("GDA-2 — CARRIER (owns assigned truck) GET ?loadId= → 200", async () => {
    setAuthSession(carrierOwnSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/gps/live?loadId=${inTransitLoadId}`
    );

    const res = await callHandler(getGpsLive, req);
    expect(res.status).toBe(200);
  });

  // ─── GDA-3: CARRIER does not own truck → 404 ─────────────────────────────────

  it("GDA-3 — CARRIER (does not own truck) GET ?loadId= → 404", async () => {
    setAuthSession(carrierWrongSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/gps/live?loadId=${inTransitLoadId}`
    );

    const res = await callHandler(getGpsLive, req);
    expect(res.status).toBe(404);
  });

  // ─── GDA-4: SHIPPER own load IN_TRANSIT → 200 ────────────────────────────────

  it("GDA-4 — SHIPPER (own load, IN_TRANSIT) GET ?loadId= → 200", async () => {
    setAuthSession(shipperOwnSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/gps/live?loadId=${inTransitLoadId}`
    );

    const res = await callHandler(getGpsLive, req);
    expect(res.status).toBe(200);
  });

  // ─── GDA-5: SHIPPER own load POSTED → 403 ────────────────────────────────────

  it("GDA-5 — SHIPPER (own load, POSTED — not IN_TRANSIT) GET ?loadId= → 403", async () => {
    setAuthSession(shipperOwnSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/gps/live?loadId=${postedLoadId}`
    );

    const res = await callHandler(getGpsLive, req);
    expect(res.status).toBe(403);
  });

  // ─── GDA-6: SHIPPER wrong-org load → 404 ─────────────────────────────────────

  it("GDA-6 — SHIPPER (wrong-org load) GET ?loadId= → 404", async () => {
    setAuthSession(shipperWrongSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/gps/live?loadId=${wrongShipperLoadId}`
    );

    const res = await callHandler(getGpsLive, req);
    expect(res.status).toBe(404);
  });

  // ─── GDA-7: DISPATCHER ?truckIds= → 200, no carrierId filter ─────────────────

  it("GDA-7 — DISPATCHER GET ?truckIds= → 200, all trucks returned (no carrierId filter)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/gps/live?truckIds=${truckId}`
    );

    const res = await callHandler(getGpsLive, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(Array.isArray(data.positions)).toBe(true);
    // Dispatcher sees all trucks — the requested truck should be present
    const ids = data.positions.map((p: any) => p.truckId);
    expect(ids).toContain(truckId);
  });

  // ─── GDA-8: CARRIER ?truckIds= → 200, filtered to own-org ───────────────────

  it("GDA-8 — CARRIER GET ?truckIds= → 200, filtered to own-org trucks only", async () => {
    setAuthSession(carrierOwnSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/gps/live?truckIds=${truckId}`
    );

    const res = await callHandler(getGpsLive, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(Array.isArray(data.positions)).toBe(true);
    // The carrier owns this truck, so it should appear in results
    const ids = data.positions.map((p: any) => p.truckId);
    expect(ids).toContain(truckId);
  });
});

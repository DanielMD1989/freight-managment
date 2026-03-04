// @jest-environment node
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

// Mock gpsQuery used by gps-history route
jest.mock("@/lib/gpsQuery", () => ({
  getLoadPositions: jest.fn(async () => []),
  calculateTripDistance: jest.fn(() => 0),
}));

// Route handlers — imported AFTER all mocks
const { GET: getTracking } = require("@/app/api/loads/[id]/tracking/route");
const {
  GET: getGpsHistory,
} = require("@/app/api/loads/[id]/gps-history/route");
const {
  GET: getLivePosition,
} = require("@/app/api/loads/[id]/live-position/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

const carrierSession = createMockSession({
  userId: "carrier-user-1",
  role: "CARRIER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

const _adminSession = createMockSession({
  userId: "admin-user-1",
  role: "ADMIN",
  organizationId: "admin-org-1",
  status: "ACTIVE",
});

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Load Tracking — GET /api/loads/[id]/tracking", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("returns 200 with tracking and events for shipper on own load", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/tracking`
    );
    const res = await callHandler(getTracking, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("tracking");
    expect(body).toHaveProperty("events");
  });

  it("returns 404 for unrelated carrier (canAccessTracking returns false)", async () => {
    // Override canAccessTracking to deny access for this call
    jest
      .requireMock("@/lib/gpsTracking")
      .canAccessTracking.mockResolvedValueOnce(false);

    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/tracking`
    );
    const res = await callHandler(getTracking, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  it("returns 401 when unauthenticated", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/tracking`
    );
    const res = await callHandler(getTracking, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(401);
    expect(body.error).toBeDefined();
  });
});

describe("Load Tracking — GET /api/loads/[id]/gps-history", () => {
  let seed: SeedData;
  const { db } = require("@/lib/db");

  beforeAll(async () => {
    seed = await seedTestData();

    // Ensure tracking is enabled on the test load
    await db.load.update({
      where: { id: seed.load.id },
      data: { trackingEnabled: true },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  it("returns 200 with positions, count and actualTripKm for shipper on own load", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/gps-history`
    );
    const res = await callHandler(getGpsHistory, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("loadId", seed.load.id);
    expect(body).toHaveProperty("positions");
    expect(body).toHaveProperty("count");
    expect(body).toHaveProperty("actualTripKm");
  });
});

describe("Load Tracking — GET /api/loads/[id]/live-position", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
    // Ensure isTrackingActive returns true so the route proceeds
    jest
      .requireMock("@/lib/gpsTracking")
      .isTrackingActive.mockResolvedValue(true);
    // Return a mock position so we get 200 instead of 404
    jest
      .requireMock("@/lib/gpsTracking")
      .getLoadLivePosition.mockResolvedValue({
        lat: 9.02,
        lng: 38.75,
        speed: 60,
        heading: 90,
        timestamp: new Date().toISOString(),
      });
  });

  it("returns 200 with position for shipper on own load", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/loads/${seed.load.id}/live-position`
    );
    const res = await callHandler(getLivePosition, req, { id: seed.load.id });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body).toHaveProperty("position");
  });
});

// @jest-environment node
/**
 * Dispatcher Dashboard Tests
 *
 * Route tested:
 * - GET /api/dispatcher/dashboard
 *
 * Business rules verified:
 * - DASH-1: DISPATCHER GET dashboard → 200 with stats
 * - DASH-2: ADMIN GET dashboard → 200
 * - DASH-3: CARRIER GET dashboard → 403
 * - DASH-4: SHIPPER GET dashboard → 403
 * - DASH-5: Unauthenticated → 401
 * - DASH-6: SUPER_ADMIN GET dashboard → 200
 */

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
  mockServiceFee,
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
} from "../../utils/routeTestUtils";

// All mocks BEFORE require()
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

// Route handler AFTER mocks
const {
  GET: getDispatcherDashboard,
} = require("@/app/api/dispatcher/dashboard/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const dispatcherSession = createMockSession({
  userId: "dash-dispatcher-1",
  role: "DISPATCHER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

const adminSession = createMockSession({
  userId: "dash-admin-1",
  role: "ADMIN",
  organizationId: "dash-admin-org-1",
  status: "ACTIVE",
});

const superAdminSession = createMockSession({
  userId: "dash-super-admin-1",
  role: "SUPER_ADMIN",
  organizationId: "dash-admin-org-1",
  status: "ACTIVE",
});

const carrierSession = createMockSession({
  userId: "carrier-user-1",
  role: "CARRIER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Dispatcher Dashboard — GET /api/dispatcher/dashboard", () => {
  beforeAll(async () => {
    await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // DASH-1: DISPATCHER GET dashboard → 200 with stats
  it("DASH-1: DISPATCHER GET dashboard → 200 with stats", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      "http://localhost/api/dispatcher/dashboard"
    );
    const res = await getDispatcherDashboard(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.stats).toBeDefined();
    expect(typeof body.stats.postedLoads).toBe("number");
    expect(typeof body.stats.assignedLoads).toBe("number");
    expect(typeof body.stats.inTransitLoads).toBe("number");
    expect(typeof body.stats.availableTrucks).toBe("number");
    expect(typeof body.stats.onTimeRate).toBe("number");
    expect(Array.isArray(body.pickupsToday)).toBe(true);
  });

  // DASH-2: ADMIN GET dashboard → 200
  it("DASH-2: ADMIN GET dashboard → 200", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      "http://localhost/api/dispatcher/dashboard"
    );
    const res = await getDispatcherDashboard(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.stats).toBeDefined();
  });

  // DASH-3: CARRIER GET dashboard → 403
  it("DASH-3: CARRIER GET dashboard → 403", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      "http://localhost/api/dispatcher/dashboard"
    );
    const res = await getDispatcherDashboard(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/access denied|dispatcher/i);
  });

  // DASH-4: SHIPPER GET dashboard → 403
  it("DASH-4: SHIPPER GET dashboard → 403", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      "http://localhost/api/dispatcher/dashboard"
    );
    const res = await getDispatcherDashboard(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/access denied|dispatcher/i);
  });

  // DASH-5: Unauthenticated → 401
  it("DASH-5: unauthenticated GET dashboard → 401", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      "http://localhost/api/dispatcher/dashboard"
    );
    const res = await getDispatcherDashboard(req);

    expect(res.status).toBe(401);
  });

  // DASH-6: SUPER_ADMIN GET dashboard → 200
  it("DASH-6: SUPER_ADMIN GET dashboard → 200", async () => {
    setAuthSession(superAdminSession);

    const req = createRequest(
      "GET",
      "http://localhost/api/dispatcher/dashboard"
    );
    const res = await getDispatcherDashboard(req);
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.stats).toBeDefined();
  });
});

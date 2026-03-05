// @jest-environment node
/**
 * Load Settle Dispatcher Bypass Tests (BUG-E2E-9)
 *
 * Route tested:
 * - GET /api/loads/[id]/settle
 *
 * Business rules verified:
 * - LSD-1: DISPATCHER with shipper-org GET settle → 403 (BUG-E2E-9 fix)
 * - LSD-2: DISPATCHER with carrier-org GET settle → 403 (BUG-E2E-9 fix)
 * - LSD-3: Shipper GET own load settle → 200 with pod/settlement keys (regression)
 * - LSD-4: Assigned carrier GET settle → 200 (regression)
 * - LSD-5: Admin GET settle → 200 (regression)
 * - LSD-6: Unrelated shipper GET settle → 403
 * - LSD-7: Unauthenticated GET settle → 401
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  parseResponse,
  seedTestData,
  clearAllStores,
  callHandler,
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
const { GET: getSettle } = require("@/app/api/loads/[id]/settle/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

// DISPATCHER with shipper-org (BUG-E2E-9 attack vector)
const dispatcherShipperOrgSession = createMockSession({
  userId: "lsd-disp-shpr-1",
  role: "DISPATCHER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

// DISPATCHER with carrier-org (BUG-E2E-9 attack vector)
const dispatcherCarrierOrgSession = createMockSession({
  userId: "lsd-disp-carr-1",
  role: "DISPATCHER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

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

const adminSession = createMockSession({
  userId: "lsd-admin-1",
  role: "ADMIN",
  organizationId: "lsd-admin-org-1",
  status: "ACTIVE",
});

// Unrelated shipper from a different org (for LSD-6)
const otherShipperSession = createMockSession({
  userId: "lsd-other-shpr-1",
  role: "SHIPPER",
  organizationId: "lsd-other-shpr-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Load Settle Dispatcher Bypass — GET /api/loads/[id]/settle", () => {
  const loadId = "test-load-001";

  beforeAll(async () => {
    await seedTestData();

    // Assign truck to load so carrierId is populated for LSD-4
    await db.load.update({
      where: { id: loadId },
      data: {
        status: "IN_TRANSIT",
        assignedTruckId: "test-truck-001",
        assignedAt: new Date(),
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // LSD-1: DISPATCHER with shipper-org GET settle → 403 (BUG-E2E-9 fix)
  it("LSD-1: DISPATCHER with shipper-org GET settle → 403 (BUG-E2E-9 fix)", async () => {
    setAuthSession(dispatcherShipperOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/settle`
    );
    const res = await callHandler(getSettle, req, { id: loadId });
    const body = await parseResponse(res);

    // BUG-E2E-9 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LSD-2: DISPATCHER with carrier-org GET settle → 403 (BUG-E2E-9 fix)
  it("LSD-2: DISPATCHER with carrier-org GET settle → 403 (BUG-E2E-9 fix)", async () => {
    setAuthSession(dispatcherCarrierOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/settle`
    );
    const res = await callHandler(getSettle, req, { id: loadId });
    const body = await parseResponse(res);

    // BUG-E2E-9 fix: DISPATCHER org matches carrierId but role is not CARRIER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LSD-3: Shipper GET own load settle → 200 with pod/settlement keys (regression)
  it("LSD-3: shipper GET own load settle → 200 with pod and settlement keys (regression)", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/settle`
    );
    const res = await callHandler(getSettle, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.loadId).toBe(loadId);
    expect(body.pod).toBeDefined();
    expect(body.settlement).toBeDefined();
  });

  // LSD-4: Assigned carrier GET settle → 200 (regression)
  it("LSD-4: assigned carrier GET settle → 200 (regression)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/settle`
    );
    const res = await callHandler(getSettle, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.loadId).toBe(loadId);
    expect(body.pod).toBeDefined();
    expect(body.settlement).toBeDefined();
  });

  // LSD-5: Admin GET settle → 200 (regression)
  it("LSD-5: admin GET settle → 200 (regression)", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/settle`
    );
    const res = await callHandler(getSettle, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.loadId).toBe(loadId);
  });

  // LSD-6: Unrelated shipper GET settle → 403
  it("LSD-6: unrelated shipper GET settle → 403", async () => {
    setAuthSession(otherShipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/settle`
    );
    const res = await callHandler(getSettle, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LSD-7: Unauthenticated GET settle → 401
  it("LSD-7: unauthenticated GET settle → 401", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/settle`
    );
    const res = await callHandler(getSettle, req, { id: loadId });

    expect(res.status).toBe(401);
  });
});

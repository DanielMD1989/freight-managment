// @jest-environment node
/**
 * Service Fee Dispatcher Bypass Tests (BUG-E2E-6)
 *
 * Route tested:
 * - GET /api/loads/[id]/service-fee
 *
 * Business rules verified:
 * - SFD-1: DISPATCHER with shipper-org GET service-fee → 404 (resource cloaking, BUG-E2E-6 fix)
 * - SFD-2: DISPATCHER with carrier-org GET service-fee → 404 (resource cloaking, BUG-E2E-6 fix)
 * - SFD-3: Shipper GET own load service-fee → 200 with serviceFee/corridor keys (regression)
 * - SFD-4: Assigned carrier GET service-fee → 200 (regression)
 * - SFD-5: Admin GET any load service-fee → 200 (regression)
 * - SFD-6: Unrelated shipper GET service-fee → 404 (resource cloaking)
 * - SFD-7: Unauthenticated GET service-fee → 401
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
const {
  GET: getServiceFee,
} = require("@/app/api/loads/[id]/service-fee/route");

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

// DISPATCHER with shipper-org (BUG-E2E-6 attack vector)
const dispatcherShipperOrgSession = createMockSession({
  userId: "sfd-disp-shpr-1",
  role: "DISPATCHER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

// DISPATCHER with carrier-org (BUG-E2E-6 attack vector)
const dispatcherCarrierOrgSession = createMockSession({
  userId: "sfd-disp-carr-1",
  role: "DISPATCHER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Service Fee Dispatcher Bypass — GET /api/loads/[id]/service-fee", () => {
  const loadId = "test-load-001";

  beforeAll(async () => {
    await seedTestData();

    // Assign truck to load so carrier access check works (SFD-4)
    await db.load.update({
      where: { id: loadId },
      data: {
        status: "IN_TRANSIT",
        assignedTruckId: "test-truck-001",
        assignedAt: new Date(),
      },
    });

    // Admin org + user for SFD-5
    await db.organization.create({
      data: {
        id: "sfd-admin-org-1",
        name: "SFD Admin Org",
        type: "PLATFORM",
        contactEmail: "sfd-admin@test.com",
        contactPhone: "+251911000120",
      },
    });
    await db.user.create({
      data: {
        id: "sfd-admin-user-1",
        email: "sfd-admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "SFD",
        lastName: "Admin",
        phone: "+251911000120",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "sfd-admin-org-1",
      },
    });

    // Other shipper org for SFD-6
    await db.organization.create({
      data: {
        id: "sfd-other-shpr-org-1",
        name: "SFD Other Shipper",
        type: "SHIPPER",
        contactEmail: "sfd-other-shpr@test.com",
        contactPhone: "+251911000121",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "sfd-other-shpr-1",
        email: "sfd-other-shpr@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "SFD",
        lastName: "OtherShipper",
        phone: "+251911000121",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "sfd-other-shpr-org-1",
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

  // SFD-1: DISPATCHER with shipper-org GET service-fee → 404 (resource cloaking, BUG-E2E-6 fix)
  it("SFD-1: DISPATCHER with shipper-org GET service-fee → 404 (BUG-E2E-6 fix)", async () => {
    setAuthSession(dispatcherShipperOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: loadId });
    const body = await parseResponse(res);

    // BUG-E2E-6 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 404 (resource cloaking)
    expect(res.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  // SFD-2: DISPATCHER with carrier-org GET service-fee → 404 (resource cloaking, BUG-E2E-6 fix)
  it("SFD-2: DISPATCHER with carrier-org GET service-fee → 404 (BUG-E2E-6 fix)", async () => {
    setAuthSession(dispatcherCarrierOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: loadId });
    const body = await parseResponse(res);

    // BUG-E2E-6 fix: DISPATCHER org matches carrierId but role is not CARRIER → 404 (resource cloaking)
    expect(res.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  // SFD-3: Shipper GET own load service-fee → 200 with serviceFee/corridor keys (regression)
  it("SFD-3: shipper GET own load service-fee → 200 with serviceFee and corridor keys", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.loadId).toBe(loadId);
    expect(body.serviceFee).toBeDefined();
  });

  // SFD-4: Assigned carrier GET service-fee → 200 (regression)
  it("SFD-4: assigned carrier GET service-fee → 200 (regression)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.loadId).toBe(loadId);
    expect(body.serviceFee).toBeDefined();
  });

  // SFD-5: Admin GET any load service-fee → 200 (regression)
  it("SFD-5: admin GET any load service-fee → 200 (regression)", async () => {
    const adminSession = createMockSession({
      userId: "sfd-admin-user-1",
      role: "ADMIN",
      organizationId: "sfd-admin-org-1",
      status: "ACTIVE",
    });
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.loadId).toBe(loadId);
  });

  // SFD-6: Unrelated shipper GET service-fee → 404 (resource cloaking)
  it("SFD-6: unrelated shipper GET service-fee → 404 (resource cloaking)", async () => {
    const otherShipperSession = createMockSession({
      userId: "sfd-other-shpr-1",
      role: "SHIPPER",
      organizationId: "sfd-other-shpr-org-1",
      status: "ACTIVE",
    });
    setAuthSession(otherShipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  // SFD-7: Unauthenticated GET service-fee → 401
  it("SFD-7: unauthenticated GET service-fee → 401", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: loadId });

    expect(res.status).toBe(401);
  });
});

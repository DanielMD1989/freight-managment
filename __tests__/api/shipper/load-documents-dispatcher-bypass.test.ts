// @jest-environment node
/**
 * Load Documents Dispatcher Bypass Tests (BUG-E2E-4, BUG-E2E-5)
 *
 * Routes tested:
 * - GET  /api/loads/[id]/documents  → list documents
 * - POST /api/loads/[id]/documents  → upload document
 *
 * Business rules verified:
 * - LDB-1: DISPATCHER with shipper-org GET documents → 403 (BUG-E2E-4 fix)
 * - LDB-2: DISPATCHER with carrier-org GET documents → 403 (BUG-E2E-4 fix)
 * - LDB-3: Shipper GET own load documents → 200 (regression)
 * - LDB-4: Assigned carrier GET documents → 200 (regression)
 * - LDB-5: Admin GET any load documents → 200 (regression)
 * - LDB-6: DISPATCHER with shipper-org POST document → 403 (BUG-E2E-5 fix)
 * - LDB-7: DISPATCHER with carrier-org POST document → 403 (BUG-E2E-5 fix)
 * - LDB-8: Unrelated shipper GET documents → 403
 * - LDB-9: Unauthenticated GET documents → 401
 *
 * Note: POST 403 tests (LDB-6/LDB-7) — the access check precedes formData parsing,
 * so auth-failure paths return before file processing. No real file needed for 403/401 tests.
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
  GET: listDocuments,
  POST: uploadDocument,
} = require("@/app/api/loads/[id]/documents/route");

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

// DISPATCHER with shipper-org (BUG-E2E-4/5 attack vector)
const dispatcherShipperOrgSession = createMockSession({
  userId: "ldb-disp-shpr-1",
  role: "DISPATCHER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

// DISPATCHER with carrier-org (BUG-E2E-4/5 attack vector)
const dispatcherCarrierOrgSession = createMockSession({
  userId: "ldb-disp-carr-1",
  role: "DISPATCHER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Load Documents Dispatcher Bypass — GET/POST /api/loads/[id]/documents", () => {
  const loadId = "test-load-001";

  beforeAll(async () => {
    await seedTestData();

    // Assign truck to load so carrier access check works (LDB-4)
    await db.load.update({
      where: { id: loadId },
      data: {
        status: "IN_TRANSIT",
        assignedTruckId: "test-truck-001",
        assignedAt: new Date(),
      },
    });

    // Admin org + user for LDB-5
    await db.organization.create({
      data: {
        id: "ldb-admin-org-1",
        name: "LDB Admin Org",
        type: "PLATFORM",
        contactEmail: "ldb-admin@test.com",
        contactPhone: "+251911000110",
      },
    });
    await db.user.create({
      data: {
        id: "ldb-admin-user-1",
        email: "ldb-admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "LDB",
        lastName: "Admin",
        phone: "+251911000110",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "ldb-admin-org-1",
      },
    });

    // Other shipper org for LDB-8
    await db.organization.create({
      data: {
        id: "ldb-other-shpr-org-1",
        name: "LDB Other Shipper",
        type: "SHIPPER",
        contactEmail: "ldb-other-shpr@test.com",
        contactPhone: "+251911000111",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "ldb-other-shpr-1",
        email: "ldb-other-shpr@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "LDB",
        lastName: "OtherShipper",
        phone: "+251911000111",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "ldb-other-shpr-org-1",
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

  // ─── GET tests ──────────────────────────────────────────────────────────────

  // LDB-1: DISPATCHER with shipper-org GET documents → 403 (BUG-E2E-4 fix)
  it("LDB-1: DISPATCHER with shipper-org GET documents → 403 (BUG-E2E-4 fix)", async () => {
    setAuthSession(dispatcherShipperOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents`
    );
    const res = await callHandler(listDocuments, req, { id: loadId });
    const body = await parseResponse(res);

    // BUG-E2E-4 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LDB-2: DISPATCHER with carrier-org GET documents → 403 (BUG-E2E-4 fix)
  it("LDB-2: DISPATCHER with carrier-org GET documents → 403 (BUG-E2E-4 fix)", async () => {
    setAuthSession(dispatcherCarrierOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents`
    );
    const res = await callHandler(listDocuments, req, { id: loadId });
    const body = await parseResponse(res);

    // BUG-E2E-4 fix: DISPATCHER org matches carrierId but role is not CARRIER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LDB-3: Shipper GET own load documents → 200 (regression)
  it("LDB-3: shipper GET own load documents → 200 (regression)", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents`
    );
    const res = await callHandler(listDocuments, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.documents).toBeDefined();
    expect(Array.isArray(body.documents)).toBe(true);
  });

  // LDB-4: Assigned carrier GET documents → 200 (regression)
  it("LDB-4: assigned carrier GET documents → 200 (regression)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents`
    );
    const res = await callHandler(listDocuments, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.documents).toBeDefined();
    expect(Array.isArray(body.documents)).toBe(true);
  });

  // LDB-5: Admin GET any load documents → 200 (regression)
  it("LDB-5: admin GET any load documents → 200 (regression)", async () => {
    const adminSession = createMockSession({
      userId: "ldb-admin-user-1",
      role: "ADMIN",
      organizationId: "ldb-admin-org-1",
      status: "ACTIVE",
    });
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents`
    );
    const res = await callHandler(listDocuments, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.documents).toBeDefined();
  });

  // LDB-8: Unrelated shipper GET documents → 403
  it("LDB-8: unrelated shipper GET documents → 403", async () => {
    const otherShipperSession = createMockSession({
      userId: "ldb-other-shpr-1",
      role: "SHIPPER",
      organizationId: "ldb-other-shpr-org-1",
      status: "ACTIVE",
    });
    setAuthSession(otherShipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents`
    );
    const res = await callHandler(listDocuments, req, { id: loadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LDB-9: Unauthenticated GET documents → 401
  it("LDB-9: unauthenticated GET documents → 401", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${loadId}/documents`
    );
    const res = await callHandler(listDocuments, req, { id: loadId });

    expect(res.status).toBe(401);
  });

  // ─── POST tests ─────────────────────────────────────────────────────────────

  // LDB-6: DISPATCHER with shipper-org POST document → 403 (BUG-E2E-5 fix)
  // The access check (lines 146-156) precedes formData parsing — auth-failure returns
  // before file processing, so no real file is needed for the 403 path.
  it("LDB-6: DISPATCHER with shipper-org POST document → 403 (BUG-E2E-5 fix)", async () => {
    setAuthSession(dispatcherShipperOrgSession);

    const req = createRequest(
      "POST",
      `http://localhost/api/loads/${loadId}/documents`
    );
    const res = await callHandler(uploadDocument, req, { id: loadId });
    const body = await parseResponse(res);

    // BUG-E2E-5 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LDB-7: DISPATCHER with carrier-org POST document → 403 (BUG-E2E-5 fix)
  it("LDB-7: DISPATCHER with carrier-org POST document → 403 (BUG-E2E-5 fix)", async () => {
    setAuthSession(dispatcherCarrierOrgSession);

    const req = createRequest(
      "POST",
      `http://localhost/api/loads/${loadId}/documents`
    );
    const res = await callHandler(uploadDocument, req, { id: loadId });
    const body = await parseResponse(res);

    // BUG-E2E-5 fix: DISPATCHER org matches carrierId but role is not CARRIER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });
});

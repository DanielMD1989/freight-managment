// @jest-environment node
/**
 * Load Edit/Delete Dispatcher Bypass Tests (BUG-E2E-7, BUG-E2E-8)
 *
 * Routes tested:
 * - PATCH  /api/loads/[id]  → edit load
 * - DELETE /api/loads/[id]  → delete load
 *
 * Business rules verified:
 * - LED-1: DISPATCHER with shipper-org PATCH load → 403 (BUG-E2E-7 fix)
 * - LED-2: Shipper PATCH own load (valid body) → 200 (regression)
 * - LED-3: Non-owner shipper PATCH load → 403
 * - LED-4: Admin PATCH any load → 200 (regression)
 * - LED-5: DISPATCHER with shipper-org DELETE load → 403 (BUG-E2E-8 fix)
 * - LED-6: Shipper DELETE own load → 200 (regression)
 * - LED-7: Admin DELETE any load → 200 (regression)
 * - LED-8: Unauthenticated PATCH → 401
 *
 * Note: canEdit/canDelete check precedes body parsing for denied paths —
 * empty body is sufficient for 403/401 tests.
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

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Route handlers AFTER mocks
const {
  PATCH: patchLoad,
  DELETE: deleteLoad,
} = require("@/app/api/loads/[id]/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

// DISPATCHER with shipper-org (BUG-E2E-7/8 attack vector)
const dispatcherSession = createMockSession({
  userId: "led-disp-1",
  role: "DISPATCHER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

// Non-owner shipper from different org (for LED-3)
const otherShipperSession = createMockSession({
  userId: "led-other-shpr-1",
  role: "SHIPPER",
  organizationId: "led-other-shpr-org-1",
  status: "ACTIVE",
});

const adminSession = createMockSession({
  userId: "led-admin-1",
  role: "ADMIN",
  organizationId: "led-admin-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Load Edit/Delete Dispatcher Bypass — PATCH & DELETE /api/loads/[id]", () => {
  const patchLoadId = "test-load-001";
  const deleteShprLoadId = "led-delete-shpr-001";
  const deleteAdminLoadId = "led-delete-admin-001";

  beforeAll(async () => {
    await seedTestData();

    // Separate DRAFT loads for destructive DELETE tests (DELETE removes the record)
    await db.load.create({
      data: {
        id: deleteShprLoadId,
        status: "DRAFT",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "LED shipper delete test load",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    await db.load.create({
      data: {
        id: deleteAdminLoadId,
        status: "DRAFT",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "LED admin delete test load",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
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

  // ─── PATCH tests ──────────────────────────────────────────────────────────

  // LED-1: DISPATCHER with shipper-org PATCH load → 403 (BUG-E2E-7 fix)
  it("LED-1: DISPATCHER with shipper-org PATCH load → 403 (BUG-E2E-7 fix)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${patchLoadId}`
    );
    const res = await callHandler(patchLoad, req, { id: patchLoadId });
    const body = await parseResponse(res);

    // BUG-E2E-7 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LED-2: Shipper PATCH own load (valid body) → 200 (regression)
  it("LED-2: shipper PATCH own load → 200 (regression)", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${patchLoadId}`,
      {
        body: { cargoDescription: "Updated cargo description" },
      }
    );
    const res = await callHandler(patchLoad, req, { id: patchLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.load).toBeDefined();
    expect(body.load.id).toBe(patchLoadId);
  });

  // LED-3: Non-owner shipper PATCH load → 403
  it("LED-3: non-owner shipper PATCH load → 403", async () => {
    setAuthSession(otherShipperSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${patchLoadId}`,
      {
        body: { cargoDescription: "Attempted hijack" },
      }
    );
    const res = await callHandler(patchLoad, req, { id: patchLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LED-4: Admin PATCH any load → 200 (regression)
  it("LED-4: admin PATCH any load → 200 (regression)", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${patchLoadId}`,
      {
        body: { cargoDescription: "Admin correction" },
      }
    );
    const res = await callHandler(patchLoad, req, { id: patchLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.load).toBeDefined();
  });

  // LED-8: Unauthenticated PATCH → 401
  it("LED-8: unauthenticated PATCH → 401", async () => {
    setAuthSession(null);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${patchLoadId}`
    );
    const res = await callHandler(patchLoad, req, { id: patchLoadId });

    expect(res.status).toBe(401);
  });

  // ─── DELETE tests ─────────────────────────────────────────────────────────

  // LED-5: DISPATCHER with shipper-org DELETE load → 403 (BUG-E2E-8 fix)
  it("LED-5: DISPATCHER with shipper-org DELETE load → 403 (BUG-E2E-8 fix)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/loads/${patchLoadId}`
    );
    const res = await callHandler(deleteLoad, req, { id: patchLoadId });
    const body = await parseResponse(res);

    // BUG-E2E-8 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // LED-6: Shipper DELETE own load → 200 (regression) — uses separate load
  it("LED-6: shipper DELETE own load → 200 (regression)", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/loads/${deleteShprLoadId}`
    );
    const res = await callHandler(deleteLoad, req, { id: deleteShprLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.message).toMatch(/deleted/i);
  });

  // LED-7: Admin DELETE any load → 200 (regression) — uses separate load
  it("LED-7: admin DELETE any load → 200 (regression)", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/loads/${deleteAdminLoadId}`
    );
    const res = await callHandler(deleteLoad, req, { id: deleteAdminLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.message).toMatch(/deleted/i);
  });
});

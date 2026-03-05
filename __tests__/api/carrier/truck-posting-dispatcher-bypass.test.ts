// @jest-environment node
/**
 * Truck Posting Dispatcher Bypass Tests (BUG-E2E-10, BUG-E2E-11)
 *
 * Routes tested:
 * - PATCH  /api/truck-postings/[id]  → update posting
 * - DELETE /api/truck-postings/[id]  → cancel posting
 *
 * Business rules verified:
 * - TPD-1: DISPATCHER with carrier-org PATCH posting → 404 (BUG-E2E-10 fix)
 * - TPD-2: Carrier PATCH own posting → 200 (regression)
 * - TPD-3: Admin PATCH posting → 200 (regression)
 * - TPD-4: Non-owner carrier PATCH → 404 (cross-org cloaking)
 * - TPD-5: DISPATCHER with carrier-org DELETE posting → 404 (BUG-E2E-11 fix)
 * - TPD-6: Carrier DELETE own posting → 200 (regression)
 * - TPD-7: Admin DELETE posting → 200 (regression)
 * - TPD-8: Unauthenticated PATCH → 401
 *
 * Note: Ownership check returns 404 (resource cloaking), not 403, for non-owners.
 * Separate posting records are used for destructive DELETE tests.
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
  PATCH: patchPosting,
  DELETE: deletePosting,
} = require("@/app/api/truck-postings/[id]/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

// DISPATCHER with carrier-org (BUG-E2E-10/11 attack vector)
const dispatcherSession = createMockSession({
  userId: "tpd-disp-1",
  role: "DISPATCHER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

const carrierSession = createMockSession({
  userId: "carrier-user-1",
  role: "CARRIER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

const adminSession = createMockSession({
  userId: "tpd-admin-1",
  role: "ADMIN",
  organizationId: "tpd-admin-org-1",
  status: "ACTIVE",
});

// Non-owner carrier from different org (for TPD-4)
const otherCarrierSession = createMockSession({
  userId: "tpd-other-carr-1",
  role: "CARRIER",
  organizationId: "tpd-other-carr-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Truck Posting Dispatcher Bypass — PATCH & DELETE /api/truck-postings/[id]", () => {
  const patchPostingId = "test-posting-001";
  const deleteCarrPostingId = "tpd-delete-carr-001";
  const deleteAdminPostingId = "tpd-delete-admin-001";

  beforeAll(async () => {
    await seedTestData();

    // Separate ACTIVE postings for destructive DELETE tests
    await db.truckPosting.create({
      data: {
        id: deleteCarrPostingId,
        truckId: "test-truck-001",
        carrierId: "carrier-org-1",
        originCityId: "city-addis",
        originCityName: "Addis Ababa",
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "TPD Carrier",
        contactPhone: "+251911000150",
      },
    });

    await db.truckPosting.create({
      data: {
        id: deleteAdminPostingId,
        truckId: "test-truck-001",
        carrierId: "carrier-org-1",
        originCityId: "city-addis",
        originCityName: "Addis Ababa",
        availableFrom: new Date(),
        status: "ACTIVE",
        fullPartial: "FULL",
        contactName: "TPD Admin Target",
        contactPhone: "+251911000151",
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

  // TPD-1: DISPATCHER with carrier-org PATCH posting → 404 (BUG-E2E-10 fix)
  it("TPD-1: DISPATCHER with carrier-org PATCH posting → 404 (BUG-E2E-10 fix)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/truck-postings/${patchPostingId}`,
      { body: { notes: "Dispatcher attempted update" } }
    );
    const res = await callHandler(patchPosting, req, { id: patchPostingId });
    const body = await parseResponse(res);

    // BUG-E2E-10 fix: DISPATCHER org matches carrierId but role is not CARRIER → 404 (resource cloaking)
    expect(res.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  // TPD-2: Carrier PATCH own posting → 200 (regression)
  it("TPD-2: carrier PATCH own posting → 200 (regression)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/truck-postings/${patchPostingId}`,
      { body: { notes: "Updated by carrier" } }
    );
    const res = await callHandler(patchPosting, req, { id: patchPostingId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.id).toBe(patchPostingId);
  });

  // TPD-3: Admin PATCH posting → 200 (regression)
  it("TPD-3: admin PATCH posting → 200 (regression)", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/truck-postings/${patchPostingId}`,
      { body: { notes: "Admin correction" } }
    );
    const res = await callHandler(patchPosting, req, { id: patchPostingId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.id).toBe(patchPostingId);
  });

  // TPD-4: Non-owner carrier PATCH → 404 (cross-org cloaking)
  it("TPD-4: non-owner carrier PATCH posting → 404 (cross-org cloaking)", async () => {
    setAuthSession(otherCarrierSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/truck-postings/${patchPostingId}`,
      { body: { notes: "Cross-org attempt" } }
    );
    const res = await callHandler(patchPosting, req, { id: patchPostingId });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  // TPD-8: Unauthenticated PATCH → 401
  it("TPD-8: unauthenticated PATCH → 401", async () => {
    setAuthSession(null);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/truck-postings/${patchPostingId}`,
      { body: { notes: "No auth" } }
    );
    const res = await callHandler(patchPosting, req, { id: patchPostingId });

    expect(res.status).toBe(401);
  });

  // ─── DELETE tests ─────────────────────────────────────────────────────────

  // TPD-5: DISPATCHER with carrier-org DELETE posting → 404 (BUG-E2E-11 fix)
  it("TPD-5: DISPATCHER with carrier-org DELETE posting → 404 (BUG-E2E-11 fix)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/truck-postings/${patchPostingId}`
    );
    const res = await callHandler(deletePosting, req, { id: patchPostingId });
    const body = await parseResponse(res);

    // BUG-E2E-11 fix: DISPATCHER org matches carrierId but role is not CARRIER → 404
    expect(res.status).toBe(404);
    expect(body.error).toBeDefined();
  });

  // TPD-6: Carrier DELETE own posting → 200 (regression) — uses separate posting
  it("TPD-6: carrier DELETE own posting → 200 (regression)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/truck-postings/${deleteCarrPostingId}`
    );
    const res = await callHandler(deletePosting, req, {
      id: deleteCarrPostingId,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.message).toMatch(/cancelled/i);
    expect(body.posting).toBeDefined();
  });

  // TPD-7: Admin DELETE posting → 200 (regression) — uses separate posting
  it("TPD-7: admin DELETE posting → 200 (regression)", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/truck-postings/${deleteAdminPostingId}`
    );
    const res = await callHandler(deletePosting, req, {
      id: deleteAdminPostingId,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.message).toMatch(/cancelled/i);
    expect(body.posting).toBeDefined();
  });
});

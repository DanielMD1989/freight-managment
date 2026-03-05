// @jest-environment node
/**
 * Truck Requests Dispatcher Bypass Tests (BUG-E2E-1 + BUG-E2E-2)
 *
 * Routes tested:
 * - GET  /api/truck-requests/[id]
 * - DELETE /api/truck-requests/[id]
 *
 * Business rules verified:
 * - TR-D1: DISPATCHER with shipper-org GET request → 404 (BUG-E2E-1 fix)
 * - TR-D2: DISPATCHER with carrier-org GET request → 404 (BUG-E2E-1 fix)
 * - TR-D3: Shipper GET own request → 200 (regression)
 * - TR-D4: Carrier GET request for their truck → 200 (regression)
 * - TR-D5: Admin GET any request → 200 (regression)
 * - TR-D6: Unrelated shipper GET → 404 (cross-org)
 * - TR-D7: DISPATCHER with shipper-org DELETE → 404 (BUG-E2E-2 fix)
 * - TR-D8: DISPATCHER with carrier-org DELETE → 404
 * - TR-D9: Shipper DELETE own PENDING request → 200 (regression)
 * - TR-D10: Carrier DELETE shipper's request → 404 (cross-role)
 * - TR-D11: Admin DELETE any PENDING request → 200 (regression)
 * - TR-D12: DELETE non-PENDING request → 400
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
  GET: getTruckRequest,
  DELETE: deleteTruckRequest,
} = require("@/app/api/truck-requests/[id]/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

// DISPATCHER whose org matches the shipper org (BUG-E2E-1/2 attack vector)
const dispatcherShipperOrgSession = createMockSession({
  userId: "trbyp-disp-shpr-1",
  role: "DISPATCHER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

// DISPATCHER whose org matches the carrier org (BUG-E2E-1 attack vector for GET)
const dispatcherCarrierOrgSession = createMockSession({
  userId: "trbyp-disp-carr-1",
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
  userId: "trbyp-admin-1",
  role: "ADMIN",
  organizationId: "trbyp-admin-org-1",
  status: "ACTIVE",
});

const otherShipperSession = createMockSession({
  userId: "trbyp-other-shpr-1",
  role: "SHIPPER",
  organizationId: "trbyp-other-shpr-org-1",
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Truck Request Dispatcher Bypass — GET & DELETE /api/truck-requests/[id]", () => {
  let seed: SeedData;
  const truckRequestId = "tr-bypass-001";

  beforeAll(async () => {
    seed = await seedTestData();

    // Insert dispatcher users in DB (org-match bypass scenario)
    await db.user.create({
      data: {
        id: "trbyp-disp-shpr-1",
        email: "trbyp-disp-shpr@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Bypass",
        lastName: "DispShpr",
        phone: "+251911000090",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "shipper-org-1",
      },
    });

    await db.user.create({
      data: {
        id: "trbyp-disp-carr-1",
        email: "trbyp-disp-carr@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Bypass",
        lastName: "DispCarr",
        phone: "+251911000091",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "carrier-org-1",
      },
    });

    // Admin user (no org needed in in-mem DB)
    await db.user.create({
      data: {
        id: "trbyp-admin-1",
        email: "trbyp-admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Bypass",
        lastName: "Admin",
        phone: "+251911000092",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "trbyp-admin-org-1",
      },
    });

    // Other shipper (cross-org)
    await db.organization.create({
      data: {
        id: "trbyp-other-shpr-org-1",
        name: "Other Bypass Shipper",
        type: "SHIPPER",
        contactEmail: "trbyp-other-shpr@test.com",
        contactPhone: "+251911000093",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    await db.user.create({
      data: {
        id: "trbyp-other-shpr-1",
        email: "trbyp-other-shpr@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Other",
        lastName: "Shipper",
        phone: "+251911000093",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "trbyp-other-shpr-org-1",
      },
    });

    // Seed truck request: shipper-org-1 → carrier-org-1
    await db.truckRequest.create({
      data: {
        id: truckRequestId,
        loadId: seed.load.id,
        truckId: seed.truck.id,
        shipperId: seed.shipperOrg.id, // "shipper-org-1"
        carrierId: seed.carrierOrg.id, // "carrier-org-1"
        requestedById: seed.shipperUser.id,
        notes: "Bypass test request",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Non-PENDING request for TR-D12
    await db.truckRequest.create({
      data: {
        id: "tr-bypass-non-pending-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        shipperId: seed.shipperOrg.id,
        carrierId: seed.carrierOrg.id,
        requestedById: seed.shipperUser.id,
        status: "ACCEPTED",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
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

  // ─── GET tests ───────────────────────────────────────────────────────────

  // TR-D1: DISPATCHER with shipper-org GET request → 404 (BUG-E2E-1 fix)
  it("TR-D1: DISPATCHER with shipper-org GET request → 404 (BUG-E2E-1 fix)", async () => {
    setAuthSession(dispatcherShipperOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(getTruckRequest, req, { id: truckRequestId });
    const body = await parseResponse(res);

    // BUG-E2E-1 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 404
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // TR-D2: DISPATCHER with carrier-org GET request → 404 (BUG-E2E-1 fix)
  it("TR-D2: DISPATCHER with carrier-org GET request → 404 (BUG-E2E-1 fix)", async () => {
    setAuthSession(dispatcherCarrierOrgSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(getTruckRequest, req, { id: truckRequestId });
    const body = await parseResponse(res);

    // BUG-E2E-1 fix: DISPATCHER org matches carrierId but role is not CARRIER → 404
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // TR-D3: Shipper GET own request → 200 (regression)
  it("TR-D3: shipper GET own request → 200 (regression)", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(getTruckRequest, req, { id: truckRequestId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request).toBeDefined();
    expect(body.request.id).toBe(truckRequestId);
  });

  // TR-D4: Carrier GET request for their truck → 200 (regression)
  it("TR-D4: carrier GET request for their truck → 200 (regression)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(getTruckRequest, req, { id: truckRequestId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request).toBeDefined();
    expect(body.request.id).toBe(truckRequestId);
  });

  // TR-D5: Admin GET any request → 200 (regression)
  it("TR-D5: admin GET any request → 200 (regression)", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(getTruckRequest, req, { id: truckRequestId });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.request).toBeDefined();
  });

  // TR-D6: Unrelated shipper GET → 404 (cross-org)
  it("TR-D6: unrelated shipper GET → 404 (cross-org cloaking)", async () => {
    setAuthSession(otherShipperSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(getTruckRequest, req, { id: truckRequestId });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // ─── DELETE tests ────────────────────────────────────────────────────────

  // TR-D7: DISPATCHER with shipper-org DELETE → 404 (BUG-E2E-2 fix)
  it("TR-D7: DISPATCHER with shipper-org DELETE → 404 (BUG-E2E-2 fix)", async () => {
    setAuthSession(dispatcherShipperOrgSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(deleteTruckRequest, req, {
      id: truckRequestId,
    });
    const body = await parseResponse(res);

    // BUG-E2E-2 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 404
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // TR-D8: DISPATCHER with carrier-org DELETE → 404
  it("TR-D8: DISPATCHER with carrier-org DELETE → 404", async () => {
    setAuthSession(dispatcherCarrierOrgSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(deleteTruckRequest, req, {
      id: truckRequestId,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // TR-D9: Shipper DELETE own PENDING request → 200 (regression)
  it("TR-D9: shipper DELETE own PENDING request → 200 (regression)", async () => {
    // Create a fresh PENDING request for this test
    const cancelableReq = await db.truckRequest.create({
      data: {
        id: "tr-bypass-cancel-shpr-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        shipperId: seed.shipperOrg.id,
        carrierId: seed.carrierOrg.id,
        requestedById: seed.shipperUser.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    setAuthSession(shipperSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/truck-requests/${cancelableReq.id}`
    );
    const res = await callHandler(deleteTruckRequest, req, {
      id: cancelableReq.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.request.status).toBe("CANCELLED");
  });

  // TR-D10: Carrier DELETE shipper's request → 404 (cross-role)
  it("TR-D10: carrier DELETE shipper's request → 404 (cross-role)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(deleteTruckRequest, req, {
      id: truckRequestId,
    });
    const body = await parseResponse(res);

    // Carrier is not the requester, not isShipper (different org check after role guard),
    // not admin → 404
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // TR-D11: Admin DELETE any PENDING request → 200 (regression)
  it("TR-D11: admin DELETE any PENDING request → 200 (regression)", async () => {
    const cancelableReq = await db.truckRequest.create({
      data: {
        id: "tr-bypass-cancel-admin-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        shipperId: seed.shipperOrg.id,
        carrierId: seed.carrierOrg.id,
        requestedById: seed.shipperUser.id,
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    setAuthSession(adminSession);

    const req = createRequest(
      "DELETE",
      `http://localhost/api/truck-requests/${cancelableReq.id}`
    );
    const res = await callHandler(deleteTruckRequest, req, {
      id: cancelableReq.id,
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.request.status).toBe("CANCELLED");
  });

  // TR-D12: DELETE non-PENDING request → 400
  it("TR-D12: DELETE non-PENDING (ACCEPTED) request → 400", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "DELETE",
      "http://localhost/api/truck-requests/tr-bypass-non-pending-001"
    );
    const res = await callHandler(deleteTruckRequest, req, {
      id: "tr-bypass-non-pending-001",
    });
    const body = await parseResponse(res);

    expect(res.status).toBe(400);
    expect(body.error).toBeDefined();
  });
});

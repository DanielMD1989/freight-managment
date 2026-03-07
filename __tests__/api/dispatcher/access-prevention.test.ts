// @jest-environment node
/**
 * Dispatcher Access Prevention Tests
 *
 * Verifies dispatcher CANNOT perform actions reserved for shipper/carrier,
 * and confirms regressions from rounds 3–4 still hold.
 *
 * Routes tested:
 * - POST /api/disputes                (AP-1: BUG-R3-1 regression)
 * - GET  /api/disputes/[id]           (AP-2: BUG-R3-3 regression)
 * - DELETE /api/truck-requests/[id]   (AP-3: BUG-E2E-2 regression)
 * - GET  /api/truck-requests/[id]     (AP-4: BUG-E2E-1 regression)
 * - GET  /api/loads/[id]/documents/[documentId]/download (AP-5: BUG-E2E-3 regression)
 * - POST /api/trucks                  (AP-6: permission denied)
 * - POST /api/loads/[id]/pod          (AP-7: carrier-only)
 * - GET  /api/loads                   (AP-8: intentionally allowed)
 * - POST /api/match-proposals         (AP-9: intentionally allowed)
 * - GET  /api/load-requests           (AP-10: BUG-D regression — no-org → 400)
 */

// Mock fs modules for AP-5 (download route uses fs)
jest.mock("fs", () => ({
  existsSync: jest.fn(() => true),
}));

jest.mock("fs/promises", () => ({
  readFile: jest.fn(async () => Buffer.from("mock content")),
}));

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
  getAuthSession,
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
  zodErrorResponse: jest.fn((_err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Route handlers AFTER mocks
const { POST: createDispute } = require("@/app/api/disputes/route");
const { GET: getDispute } = require("@/app/api/disputes/[id]/route");
const {
  GET: getTruckRequest,
  DELETE: deleteTruckRequest,
} = require("@/app/api/truck-requests/[id]/route");
const {
  GET: downloadDocument,
} = require("@/app/api/loads/[id]/documents/[documentId]/download/route");
const { POST: createTruck } = require("@/app/api/trucks/route");
const { POST: uploadPod } = require("@/app/api/loads/[id]/pod/route");
const { GET: listLoads } = require("@/app/api/loads/route");
const {
  POST: createMatchProposal,
} = require("@/app/api/match-proposals/route");
const { GET: listLoadRequests } = require("@/app/api/load-requests/route");

// ─── Permissions: DISPATCHER-allowed permission keys ─────────────────────────
// Used to make requirePermission role-aware for AP-6 (trucks POST)

const DISPATCHER_ALLOWED_PERMISSIONS = new Set([
  "view_all_loads",
  "view_loads",
  "view_dispatch_queue",
  "propose_match",
  "view_unassigned_loads",
  "view_rejected_loads",
  "view_all_trucks",
  "view_trucks",
  "view_exceptions",
  "escalate_to_admin",
  "view_rules",
  "view_all_gps",
  "view_wallet",
]);

// ─── Sessions ─────────────────────────────────────────────────────────────────

// DISPATCHER whose org matches shipper-org-1 (org-match bypass scenario)
const dispatcherSession = createMockSession({
  userId: "ap-disp-user-1",
  role: "DISPATCHER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

// DISPATCHER with no org (for AP-10)
const dispatcherNoOrgSession = createMockSession({
  userId: "ap-disp-no-org-1",
  role: "DISPATCHER",
  organizationId: undefined,
  status: "ACTIVE",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Dispatcher Access Prevention", () => {
  let disputeId: string;
  const truckRequestId = "ap-truck-request-001";
  const documentId = "ap-document-001";
  const assignedLoadId = "ap-load-assigned-001";
  const deliveredLoadId = "ap-load-delivered-001";

  beforeAll(async () => {
    await seedTestData();

    // Override requirePermission to be role-aware for DISPATCHER (needed for AP-6)
    const rbacModule = require("@/lib/rbac");
    rbacModule.requirePermission.mockImplementation(
      async (permission: string) => {
        const session = getAuthSession();
        if (!session) throw new Error("Unauthorized");
        if (
          session.role === "DISPATCHER" &&
          !DISPATCHER_ALLOWED_PERMISSIONS.has(permission)
        ) {
          const error = new Error(
            "Forbidden: You do not have permission to perform this action"
          );
          (error as any).name = "ForbiddenError";
          throw error;
        }
        return session;
      }
    );

    // Insert dispatcher users
    await db.user.create({
      data: {
        id: "ap-disp-user-1",
        email: "ap-disp@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "AP",
        lastName: "Dispatcher",
        phone: "+251911000100",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "shipper-org-1",
      },
    });

    await db.user.create({
      data: {
        id: "ap-disp-no-org-1",
        email: "ap-disp-no-org@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "AP",
        lastName: "DispNoOrg",
        phone: "+251911000101",
        role: "DISPATCHER",
        status: "ACTIVE",
        // no organizationId
      },
    });

    // Create ASSIGNED load for AP-1/AP-2 (disputes require ASSIGNED loads)
    await db.load.create({
      data: {
        id: assignedLoadId,
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 86400000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 10 * 86400000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Assigned load for AP tests",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        assignedTruckId: "test-truck-001",
        assignedAt: new Date(),
        postedAt: new Date(),
      },
    });

    // Seed a dispute on the assigned load for AP-2
    const dispute = await db.dispute.create({
      data: {
        type: "PAYMENT_ISSUE",
        description: "AP test dispute",
        status: "OPEN",
        loadId: assignedLoadId,
        createdById: "shipper-user-1",
        disputedOrgId: "carrier-org-1",
      },
    });
    disputeId = dispute.id;

    // Seed truck request for AP-3/AP-4 (shipperId matches dispatcherSession.organizationId)
    await db.truckRequest.create({
      data: {
        id: truckRequestId,
        loadId: "test-load-001",
        truckId: "test-truck-001",
        shipperId: "shipper-org-1", // matches dispatcherSession.organizationId
        carrierId: "carrier-org-1",
        requestedById: "shipper-user-1",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    // Create DELIVERED load with assigned truck for AP-7 (POD upload requires DELIVERED status)
    await db.load.create({
      data: {
        id: deliveredLoadId,
        status: "DELIVERED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 3 * 86400000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() - 1 * 86400000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Delivered load for AP-7 POD test",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        assignedTruckId: "test-truck-001",
        assignedAt: new Date(Date.now() - 4 * 86400000),
        podSubmitted: false,
        postedAt: new Date(Date.now() - 5 * 86400000),
      },
    });

    // Seed document for AP-5 (loadId shipperId matches dispatcherSession.organizationId)
    await db.document.create({
      data: {
        id: documentId,
        loadId: "test-load-001",
        fileName: "ap-document.pdf",
        fileUrl: "uploads/ap-document.pdf",
        mimeType: "application/pdf",
        fileSize: 5678,
        uploadedById: "shipper-user-1",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Note: jest.clearAllMocks() clears call tracking but NOT mockImplementation —
    // the role-aware requirePermission override set in beforeAll persists.
    setAuthSession(null);
  });

  // AP-1: DISPATCHER POST /api/disputes → 404 (BUG-R3-1 regression)
  it("AP-1: DISPATCHER POST /api/disputes → 404 (BUG-R3-1 regression)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest("POST", "http://localhost/api/disputes", {
      body: {
        loadId: assignedLoadId,
        type: "PAYMENT_ISSUE",
        description: "Dispatcher trying to create dispute",
      },
    });
    const res = await createDispute(req);
    const body = await parseResponse(res);

    // BUG-R3-1 fix: DISPATCHER is not SHIPPER/CARRIER → 404
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // AP-2: DISPATCHER GET /api/disputes/[id] → 404 (BUG-R3-3 regression)
  it("AP-2: DISPATCHER GET /api/disputes/[id] → 404 (BUG-R3-3 regression)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/disputes/${disputeId}`
    );
    const res = await callHandler(getDispute, req, { id: disputeId });
    const body = await parseResponse(res);

    // BUG-R3-3 fix: DISPATCHER org matches shipper-org but role is not SHIPPER → 404
    expect(res.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // AP-3: DISPATCHER DELETE /api/truck-requests/[id] via org-match → 404 (BUG-E2E-2)
  it("AP-3: DISPATCHER DELETE truck-request via org-match → 404 (BUG-E2E-2)", async () => {
    setAuthSession(dispatcherSession);

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

  // AP-4: DISPATCHER GET /api/truck-requests/[id] → 200 (blueprint §5: full visibility)
  // G-A8-5 fix: blueprint grants Dispatchers full read visibility across the platform.
  // Only accept/reject is blocked — viewing a request detail is intentionally allowed.
  it("AP-4: DISPATCHER GET truck-request → 200 (full visibility, G-A8-5)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/truck-requests/${truckRequestId}`
    );
    const res = await callHandler(getTruckRequest, req, {
      id: truckRequestId,
    });
    const body = await parseResponse(res);

    // G-A8-5: blueprint §5 — Dispatcher sees ALL loads and trucks; 200 is correct
    expect(res.status).toBe(200);
    expect(body.request).toBeDefined();
  });

  // AP-5: DISPATCHER GET document download via org-match → 403 (BUG-E2E-3)
  it("AP-5: DISPATCHER GET document download via org-match → 403 (BUG-E2E-3)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/test-load-001/documents/${documentId}/download`
    );
    const res = await callHandler(downloadDocument, req, {
      id: "test-load-001",
      documentId,
    });
    const body = await parseResponse(res);

    // BUG-E2E-3 fix: DISPATCHER org matches shipperId but role is not SHIPPER → 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // AP-6: DISPATCHER POST /api/trucks → 403 (permission denied)
  it("AP-6: DISPATCHER POST /api/trucks → 403 (no CREATE_TRUCK permission)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest("POST", "http://localhost/api/trucks", {
      body: {
        licensePlate: "AP-99999",
        truckType: "DRY_VAN",
        capacity: 10000,
      },
    });
    const res = await createTruck(req);
    const body = await parseResponse(res);

    // requirePermission(CREATE_TRUCK) throws ForbiddenError for DISPATCHER
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // AP-7: DISPATCHER POST /api/loads/[id]/pod → 403 (carrier-only)
  it("AP-7: DISPATCHER POST /api/loads/[id]/pod → 403 (carrier-only)", async () => {
    setAuthSession(dispatcherSession);

    // Use deliveredLoadId — POD route first checks load.status === "DELIVERED" (400 if not),
    // then checks role === "CARRIER" (403 if not). Must use DELIVERED load to reach role check.
    const req = createRequest(
      "POST",
      `http://localhost/api/loads/${deliveredLoadId}/pod`,
      {
        headers: { "Content-Type": "multipart/form-data" },
      }
    );
    // Provide minimal formData mock (DISPATCHER blocked before form parsing)
    (req as any).formData = jest.fn(async () => ({
      get: jest.fn(() => null),
    }));
    const res = await callHandler(uploadPod, req, { id: deliveredLoadId });
    const body = await parseResponse(res);

    // POD POST requires role === "CARRIER" explicitly → DISPATCHER gets 403
    expect(res.status).toBe(403);
    expect(body.error).toBeDefined();
  });

  // AP-8: DISPATCHER GET /api/loads → 200 (intentionally allowed)
  it("AP-8: DISPATCHER GET /api/loads → 200 (intentionally allowed)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest("GET", "http://localhost/api/loads");
    const res = await listLoads(req);

    // DISPATCHER is allowed to view all loads for coordination
    expect(res.status).toBe(200);
  });

  // AP-9: DISPATCHER POST /api/match-proposals → allowed (not 403 from role check)
  it("AP-9: DISPATCHER POST /api/match-proposals → not denied (intentionally allowed)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest("POST", "http://localhost/api/match-proposals", {
      body: {
        loadId: "test-load-001",
        truckId: "test-truck-001",
        notes: "Good match",
        expiresInHours: 24,
      },
    });
    const res = await createMatchProposal(req);

    // DISPATCHER can create proposals — may return 201, 400 (wrong status), or 409
    // but MUST NOT return 403 (which would mean role is denied)
    expect(res.status).not.toBe(403);
    expect([200, 201, 400, 404, 409]).toContain(res.status);
  });

  // AP-10: DISPATCHER GET /api/load-requests → 200 with full visibility (G-A9-4)
  // G-A9-4: Dispatchers have full platform visibility — org filter removed (blueprint §5).
  it("AP-10: DISPATCHER GET /api/load-requests → 200 (G-A9-4 full visibility)", async () => {
    setAuthSession(dispatcherNoOrgSession);

    const req = createRequest("GET", "http://localhost/api/load-requests");
    const res = await listLoadRequests(req);

    // G-A9-4: All dispatchers (with or without org) get full visibility
    expect(res.status).toBe(200);
  });
});

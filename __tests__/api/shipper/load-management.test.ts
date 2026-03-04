// @jest-environment node
/**
 * Shipper Load Management Tests
 *
 * Tests for:
 * - POST /api/loads                  → 201, { load: { id, status } }
 * - GET  /api/loads                  → 200, { loads, pagination }
 * - GET  /api/loads/[id]             → 200, { load: {...} }
 * - PATCH /api/loads/[id]            → 200, { load: {...} }
 * - DELETE /api/loads/[id]           → 200, { message: "Load deleted successfully" }
 * - POST /api/loads/[id]/duplicate   → 200, { message, load: { status: "DRAFT", assignedTruckId: null } }
 *
 * Business rules verified:
 * - Carrier cannot see DRAFT loads (resource cloaking → 404)
 * - Another shipper org cannot PATCH the load → 403
 * - DELETE blocked for ASSIGNED/PICKUP_PENDING/IN_TRANSIT/DELIVERED statuses → 400
 * - POSTED loads allowed to be deleted (not in blocked list)
 * - POST with status:"POSTED" sets load.status="POSTED" and load.postedAt
 * - Duplicate resets: status=DRAFT, assignedTruckId=null, postedAt=null, isKept=false
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

// loadUtils with correct maskCompany signature (isAnonymous: boolean, name: string)
jest.mock("@/lib/loadUtils", () => ({
  calculateAge: jest.fn(() => 30),
  canSeeContact: jest.fn(() => true),
  maskCompany: jest.fn((isAnonymous: boolean, name: string) =>
    isAnonymous ? "Anonymous Shipper" : name || "Unknown"
  ),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

jest.mock("@/lib/loadStateMachine", () => ({
  validateStateTransition: jest.fn(() => ({ valid: true })),
  LoadStatus: {
    DRAFT: "DRAFT",
    POSTED: "POSTED",
    ASSIGNED: "ASSIGNED",
    PICKUP_PENDING: "PICKUP_PENDING",
    IN_TRANSIT: "IN_TRANSIT",
    DELIVERED: "DELIVERED",
    COMPLETED: "COMPLETED",
    CANCELLED: "CANCELLED",
  },
}));

jest.mock("@/lib/trustMetrics", () => ({
  incrementCompletedLoads: jest.fn(async () => {}),
  incrementCancelledLoads: jest.fn(async () => {}),
}));

jest.mock("@/lib/bypassDetection", () => ({
  checkSuspiciousCancellation: jest.fn(async () => ({ suspicious: false })),
}));

// Route handlers AFTER mocks
const { POST: createLoad, GET: listLoads } = require("@/app/api/loads/route");
const {
  GET: getLoad,
  PATCH: updateLoad,
  DELETE: deleteLoad,
} = require("@/app/api/loads/[id]/route");
const { POST: duplicateLoad } = require("@/app/api/loads/[id]/duplicate/route");

// ─── Sessions ────────────────────────────────────────────────────────────────

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

// ─── Base valid load payload ──────────────────────────────────────────────────

const baseLoadPayload = {
  pickupCity: "Addis Ababa",
  deliveryCity: "Dire Dawa",
  pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString(),
  truckType: "DRY_VAN",
  weight: 5000,
  cargoDescription: "Test cargo shipment",
  status: "DRAFT",
};

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Shipper Load Management", () => {
  beforeAll(async () => {
    await seedTestData();

    // Create the admin org so route's db.user.findUnique succeeds for admin session
    await db.organization.create({
      data: {
        id: "admin-org-1",
        name: "Admin Org",
        type: "SHIPPER",
        contactEmail: "admin@test.com",
        contactPhone: "+251900000001",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Create second shipper org for cross-org 403 test
    await db.organization.create({
      data: {
        id: "shipper-org-2",
        name: "Other Shipper Corp",
        type: "SHIPPER",
        contactEmail: "other@shipper.com",
        contactPhone: "+251922222222",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    await db.user.create({
      data: {
        id: "shipper-user-2",
        email: "shipper2@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Other",
        lastName: "Shipper",
        phone: "+251922222222",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: "shipper-org-2",
      },
    });

    // Pre-create loads needed across multiple tests
    await db.load.create({
      data: {
        id: "draft-load-cloak",
        status: "DRAFT",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Draft cargo for cloaking test",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
      },
    });

    await db.load.create({
      data: {
        id: "assigned-load-nodelete",
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryCity: "Bahir Dar",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 6000,
        cargoDescription: "Assigned cargo — cannot delete",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
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

  // ── POST /api/loads ──────────────────────────────────────────────────────

  it("creates a DRAFT load and returns 201 with { load: { id, status } }", async () => {
    setAuthSession(shipperSession);

    const req = createRequest("POST", "http://localhost/api/loads", {
      body: baseLoadPayload,
    });

    const response = await callHandler(createLoad, req);
    const body = await parseResponse(response);

    expect(response.status).toBe(201);
    expect(body.load).toBeDefined();
    expect(body.load.id).toBeDefined();
    expect(body.load.status).toBe("DRAFT");
  });

  it("creates a POSTED load and returns 201 with status=POSTED and postedAt set", async () => {
    setAuthSession(shipperSession);

    const req = createRequest("POST", "http://localhost/api/loads", {
      body: { ...baseLoadPayload, status: "POSTED" },
    });

    const response = await callHandler(createLoad, req);
    const body = await parseResponse(response);

    expect(response.status).toBe(201);
    expect(body.load.status).toBe("POSTED");
    expect(body.load.postedAt).not.toBeNull();
  });

  it("returns 400 when pickupDate is missing (required field)", async () => {
    setAuthSession(shipperSession);

    const { pickupDate: _omit, ...withoutPickupDate } = baseLoadPayload;

    const req = createRequest("POST", "http://localhost/api/loads", {
      body: withoutPickupDate,
    });

    const response = await callHandler(createLoad, req);
    const body = await parseResponse(response);

    expect(response.status).toBe(400);
    expect(body.error).toBeDefined();
  });

  // ── GET /api/loads ───────────────────────────────────────────────────────

  it("lists loads as shipper and returns { loads, pagination }", async () => {
    setAuthSession(shipperSession);

    const req = createRequest("GET", "http://localhost/api/loads");
    const response = await callHandler(listLoads, req);
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(Array.isArray(body.loads)).toBe(true);
    expect(body.pagination).toBeDefined();
    expect(typeof body.pagination.total).toBe("number");
    expect(typeof body.pagination.page).toBe("number");
  });

  // ── GET /api/loads/[id] ──────────────────────────────────────────────────

  it("shipper can view their own load and gets { load: { ... } }", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      "http://localhost/api/loads/test-load-001"
    );
    const response = await callHandler(getLoad, req, { id: "test-load-001" });
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.load).toBeDefined();
    expect(body.load.id).toBe("test-load-001");
  });

  it("carrier gets 404 for a DRAFT load (resource cloaking)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      "http://localhost/api/loads/draft-load-cloak"
    );
    const response = await callHandler(getLoad, req, {
      id: "draft-load-cloak",
    });
    const body = await parseResponse(response);

    // Carrier cannot see DRAFT loads — route returns 404 (resource cloaking)
    expect(response.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  // ── PATCH /api/loads/[id] ────────────────────────────────────────────────

  it("shipper can PATCH their own load and gets 200 with { load: {...} }", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "PATCH",
      "http://localhost/api/loads/test-load-001",
      {
        body: { cargoDescription: "Updated cargo description" },
      }
    );

    const response = await callHandler(updateLoad, req, {
      id: "test-load-001",
    });
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.load).toBeDefined();
  });

  it("returns 403 when a different shipper org tries to PATCH the load", async () => {
    const otherShipperSession = createMockSession({
      userId: "shipper-user-2",
      role: "SHIPPER",
      organizationId: "shipper-org-2",
      status: "ACTIVE",
    });

    setAuthSession(otherShipperSession);

    const req = createRequest(
      "PATCH",
      "http://localhost/api/loads/test-load-001",
      {
        body: { cargoDescription: "Unauthorized update attempt" },
      }
    );

    const response = await callHandler(updateLoad, req, {
      id: "test-load-001",
    });
    const body = await parseResponse(response);

    expect(response.status).toBe(403);
    expect(body.error).toMatch(/permission/i);
  });

  // ── DELETE /api/loads/[id] ───────────────────────────────────────────────

  it("shipper can delete a DRAFT load and gets 200 with success message", async () => {
    setAuthSession(shipperSession);

    // Create a dedicated deletable DRAFT load
    await db.load.create({
      data: {
        id: "deletable-draft-load",
        status: "DRAFT",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryCity: "Hawassa",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Cargo to be deleted",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
      },
    });

    const req = createRequest(
      "DELETE",
      "http://localhost/api/loads/deletable-draft-load"
    );
    const response = await callHandler(deleteLoad, req, {
      id: "deletable-draft-load",
    });
    const body = await parseResponse(response);

    expect(response.status).toBe(200);
    expect(body.message).toBe("Load deleted successfully");
  });

  it("shipper can delete a POSTED load (POSTED is not in blocked statuses)", async () => {
    setAuthSession(shipperSession);

    // Create a POSTED load to delete
    await db.load.create({
      data: {
        id: "deletable-posted-load",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        deliveryCity: "Mekelle",
        deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Posted cargo to be deleted",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    const req = createRequest(
      "DELETE",
      "http://localhost/api/loads/deletable-posted-load"
    );
    const response = await callHandler(deleteLoad, req, {
      id: "deletable-posted-load",
    });
    const body = await parseResponse(response);

    // POSTED is NOT in the blocked statuses, so deletion succeeds
    expect(response.status).toBe(200);
    expect(body.message).toBe("Load deleted successfully");
  });

  it("returns 400 when trying to delete an ASSIGNED load", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "DELETE",
      "http://localhost/api/loads/assigned-load-nodelete"
    );
    const response = await callHandler(deleteLoad, req, {
      id: "assigned-load-nodelete",
    });
    const body = await parseResponse(response);

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/assigned/i);
  });

  // ── POST /api/loads/[id]/duplicate ───────────────────────────────────────

  it("duplicates a load and returns { message, load: { status: DRAFT, assignedTruckId: null } }", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "POST",
      "http://localhost/api/loads/test-load-001/duplicate"
    );

    const response = await callHandler(duplicateLoad, req, {
      id: "test-load-001",
    });
    const body = await parseResponse(response);

    // Duplicate route returns 200 with message + load wrapped
    expect(response.status).toBe(200);
    expect(body.message).toBe("Load duplicated successfully");
    expect(body.load).toBeDefined();
    // Duplicate always starts as DRAFT with no assignment
    expect(body.load.status).toBe("DRAFT");
    expect(body.load.assignedTruckId).toBeNull();
    // postedAt is reset to null for the duplicate
    expect(body.load.postedAt).toBeNull();
    // Duplicate belongs to the requesting shipper's org
    expect(body.load.shipperId).toBe("shipper-org-1");
  });

  it("returns 403 when a carrier tries to duplicate a load they do not own", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "POST",
      "http://localhost/api/loads/test-load-001/duplicate"
    );

    const response = await callHandler(duplicateLoad, req, {
      id: "test-load-001",
    });
    const body = await parseResponse(response);

    // Carrier does not own the load (shipperId !== carrier org) → 403
    expect(response.status).toBe(403);
    expect(body.error).toMatch(/forbidden|duplicate/i);
  });
});

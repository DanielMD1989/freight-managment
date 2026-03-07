// @jest-environment node
/**
 * Load Edit State Guard Tests (G-A5-1)
 *
 * PATCH /api/loads/[id] — structural field edit enforcement by load status
 *
 * Three-tier state guard:
 *   TIER 1 — Terminal (COMPLETED, CANCELLED, EXPIRED):
 *     All modifications blocked → 409
 *   TIER 2 — Operational (ASSIGNED, PICKUP_PENDING, IN_TRANSIT, DELIVERED, EXCEPTION):
 *     All modifications blocked (trip in progress) → 409
 *   TIER 3 — Live marketplace (POSTED, SEARCHING, OFFERED):
 *     Structural field edits blocked; status-only transitions allowed → 409 / 200
 *   EDITABLE (DRAFT, UNPOSTED):
 *     All edits allowed → 200
 *   ADMIN bypass:
 *     Admin can edit any load regardless of status → 200
 *
 * Tests E-GUARD-1 through E-GUARD-16
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

// State machine mock — allow any transition so guards can be tested in isolation
jest.mock("@/lib/loadStateMachine", () => ({
  validateStateTransition: jest.fn(() => ({ valid: true })),
  LoadStatus: {
    DRAFT: "DRAFT",
    POSTED: "POSTED",
    UNPOSTED: "UNPOSTED",
    SEARCHING: "SEARCHING",
    OFFERED: "OFFERED",
    ASSIGNED: "ASSIGNED",
    PICKUP_PENDING: "PICKUP_PENDING",
    IN_TRANSIT: "IN_TRANSIT",
    DELIVERED: "DELIVERED",
    COMPLETED: "COMPLETED",
    EXCEPTION: "EXCEPTION",
    CANCELLED: "CANCELLED",
    EXPIRED: "EXPIRED",
  },
}));

// Route handler AFTER mocks
const { PATCH: patchLoad } = require("@/app/api/loads/[id]/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

const adminSession = createMockSession({
  userId: "esg-admin-1",
  role: "ADMIN",
  organizationId: "esg-admin-org-1",
  status: "ACTIVE",
});

// ─── Helper: structural edit payload ──────────────────────────────────────────

const structuralEdit = { cargoDescription: "Structural edit attempt" };
const statusOnlyUnpost = { status: "UNPOSTED" };
const statusOnlyCancel = { status: "CANCELLED" };

// ─── Helper: seed load by status ─────────────────────────────────────────────

async function seedLoadWithStatus(
  id: string,
  status: string,
  shipperId: string,
  createdById: string
) {
  return db.load.create({
    data: {
      id,
      status,
      pickupCity: "Addis Ababa",
      pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      deliveryCity: "Dire Dawa",
      deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 5000,
      cargoDescription: `State guard test — ${status}`,
      shipperId,
      createdById,
    },
  });
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Load Edit State Guard (G-A5-1) — PATCH /api/loads/[id]", () => {
  let seed: SeedData;

  const loadIds = {
    draft: "esg-load-draft",
    unposted: "esg-load-unposted",
    posted: "esg-load-posted",
    searching: "esg-load-searching",
    offered: "esg-load-offered",
    assigned: "esg-load-assigned",
    pickupPending: "esg-load-pickup-pending",
    inTransit: "esg-load-in-transit",
    delivered: "esg-load-delivered",
    exception: "esg-load-exception",
    completed: "esg-load-completed",
    cancelled: "esg-load-cancelled",
    expired: "esg-load-expired",
    // Admin bypass test uses the POSTED load
  };

  beforeAll(async () => {
    seed = await seedTestData();

    const shipperId = seed.shipperOrg.id;
    const createdById = seed.shipperUser.id;

    await seedLoadWithStatus(loadIds.draft, "DRAFT", shipperId, createdById);
    await seedLoadWithStatus(
      loadIds.unposted,
      "UNPOSTED",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(loadIds.posted, "POSTED", shipperId, createdById);
    await seedLoadWithStatus(
      loadIds.searching,
      "SEARCHING",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(
      loadIds.offered,
      "OFFERED",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(
      loadIds.assigned,
      "ASSIGNED",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(
      loadIds.pickupPending,
      "PICKUP_PENDING",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(
      loadIds.inTransit,
      "IN_TRANSIT",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(
      loadIds.delivered,
      "DELIVERED",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(
      loadIds.exception,
      "EXCEPTION",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(
      loadIds.completed,
      "COMPLETED",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(
      loadIds.cancelled,
      "CANCELLED",
      shipperId,
      createdById
    );
    await seedLoadWithStatus(
      loadIds.expired,
      "EXPIRED",
      shipperId,
      createdById
    );
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  // ── Tier 0: Editable states ───────────────────────────────────────────────

  it("E-GUARD-1: DRAFT + structural edit → 200 (all edits allowed)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.draft}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.draft });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.load).toBeDefined();
  });

  it("E-GUARD-2: UNPOSTED + structural edit → 200 (all edits allowed)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.unposted}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.unposted });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.load).toBeDefined();
  });

  // ── Tier 3: Live marketplace states ──────────────────────────────────────

  it("E-GUARD-3: POSTED + structural edit → 409, error mentions UNPOSTED", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.posted}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.posted });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/UNPOSTED/i);
  });

  it("E-GUARD-4: POSTED + status-only { status: UNPOSTED } → 200 (unpost allowed)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.posted}`,
      { body: statusOnlyUnpost }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.posted });
    expect(res.status).toBe(200);
  });

  it("E-GUARD-5: POSTED + status-only { status: CANCELLED } → 200 (cancel allowed from POSTED)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.posted}`,
      { body: statusOnlyCancel }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.posted });
    expect(res.status).toBe(200);
  });

  it("E-GUARD-6: SEARCHING + structural edit → 409 (live marketplace lock)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.searching}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.searching });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/marketplace|UNPOSTED/i);
  });

  it("E-GUARD-7: OFFERED + structural edit → 409 (live marketplace lock)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.offered}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.offered });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/marketplace|UNPOSTED/i);
  });

  // ── Tier 2: Operational states (trip in progress) ────────────────────────

  it("E-GUARD-8: ASSIGNED + structural edit → 409 (carrier contract locked)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.assigned}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.assigned });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/assigned/i);
  });

  it("E-GUARD-9: PICKUP_PENDING + structural edit → 409", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.pickupPending}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, {
      id: loadIds.pickupPending,
    });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/assigned/i);
  });

  it("E-GUARD-10: IN_TRANSIT + structural edit → 409", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.inTransit}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.inTransit });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/assigned/i);
  });

  it("E-GUARD-11: DELIVERED + structural edit → 409", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.delivered}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.delivered });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/assigned/i);
  });

  it("E-GUARD-12: EXCEPTION + structural edit → 409 (exception under review)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.exception}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.exception });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/assigned/i);
  });

  // ── Tier 1: Terminal states ────────────────────────────────────────────────

  it("E-GUARD-13: COMPLETED + structural edit → 409 (terminal state)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.completed}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.completed });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/completed|cancelled|expired/i);
  });

  it("E-GUARD-14: CANCELLED + structural edit → 409 (terminal state)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.cancelled}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.cancelled });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/completed|cancelled|expired/i);
  });

  it("E-GUARD-15: EXPIRED + structural edit → 409 (terminal state)", async () => {
    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.expired}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.expired });
    const body = await parseResponse(res);
    expect(res.status).toBe(409);
    expect(body.error).toMatch(/completed|cancelled|expired/i);
  });

  // ── Admin bypass ──────────────────────────────────────────────────────────

  it("E-GUARD-16: POSTED + structural edit as ADMIN → 200 (admin bypass)", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/loads/${loadIds.posted}`,
      { body: structuralEdit }
    );
    const res = await callHandler(patchLoad, req, { id: loadIds.posted });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.load).toBeDefined();
  });
});

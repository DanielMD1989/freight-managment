// @jest-environment node
/**
 * Dispatcher Load Status Update Tests — Round U1
 *
 * Verifies that DISPATCHER role is restricted to EXCEPTION-only on
 * PATCH /api/loads/[id]/status (Blueprint: "Propose Only" constraint).
 *
 * Tests:
 * DU-1 — DISPATCHER PATCH with IN_TRANSIT → 403
 * DU-2 — DISPATCHER PATCH with DELIVERED → 403
 * DU-3 — DISPATCHER PATCH with COMPLETED → 403
 * DU-4 — DISPATCHER PATCH with CANCELLED → 403
 * DU-5 — DISPATCHER PATCH with EXCEPTION → 200 (allowed coordination action)
 * DU-6 — ADMIN PATCH with IN_TRANSIT → 200 (ADMIN unaffected by fix)
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

jest.mock("@/lib/automationRules", () => ({
  evaluateRulesForTrigger: jest.fn(async () => []),
}));
jest.mock("@/lib/automationActions", () => ({
  executeAndRecordRuleActions: jest.fn(async () => {}),
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

// Import handler AFTER mocks
const { PATCH: updateStatus } = require("@/app/api/loads/[id]/status/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const dispatcherSession = createMockSession({
  userId: "du-dispatcher-1",
  email: "du-dispatcher@test.com",
  role: "DISPATCHER",
  status: "ACTIVE",
  organizationId: "du-dispatcher-org-1",
});

const adminSession = createMockSession({
  userId: "du-admin-1",
  email: "du-admin@test.com",
  role: "ADMIN",
  status: "ACTIVE",
  organizationId: "du-admin-org-1",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Dispatcher Load Status Update — Round U1", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    await db.user.create({
      data: {
        id: "du-dispatcher-1",
        email: "du-dispatcher@test.com",
        role: "DISPATCHER",
        organizationId: "du-dispatcher-org-1",
        firstName: "Dispatcher",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "du-admin-1",
        email: "du-admin@test.com",
        role: "ADMIN",
        organizationId: "du-admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── DU-1 ─────────────────────────────────────────────────────────

  it("DU-1 — DISPATCHER PATCH with IN_TRANSIT → 403", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${seed.load.id}/status`,
      { body: { status: "IN_TRANSIT" } }
    );

    const res = await callHandler(updateStatus, req, { id: seed.load.id });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(/Dispatchers can only set status to EXCEPTION/);
  });

  // ─── DU-2 ─────────────────────────────────────────────────────────

  it("DU-2 — DISPATCHER PATCH with DELIVERED → 403", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${seed.load.id}/status`,
      { body: { status: "DELIVERED" } }
    );

    const res = await callHandler(updateStatus, req, { id: seed.load.id });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(/Dispatchers can only set status to EXCEPTION/);
  });

  // ─── DU-3 ─────────────────────────────────────────────────────────

  it("DU-3 — DISPATCHER PATCH with COMPLETED → 403", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${seed.load.id}/status`,
      { body: { status: "COMPLETED" } }
    );

    const res = await callHandler(updateStatus, req, { id: seed.load.id });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(/Dispatchers can only set status to EXCEPTION/);
  });

  // ─── DU-4 ─────────────────────────────────────────────────────────

  it("DU-4 — DISPATCHER PATCH with CANCELLED → 403", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${seed.load.id}/status`,
      { body: { status: "CANCELLED" } }
    );

    const res = await callHandler(updateStatus, req, { id: seed.load.id });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(/Dispatchers can only set status to EXCEPTION/);
  });

  // ─── DU-5 ─────────────────────────────────────────────────────────

  it("DU-5 — DISPATCHER PATCH with EXCEPTION → 200 (allowed coordination action)", async () => {
    setAuthSession(dispatcherSession);

    // Create a fresh load in POSTED state for this transition
    const exceptionLoad = await db.load.create({
      data: {
        id: "du5-load-001",
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(Date.now() + 86400000),
        deliveryDate: new Date(Date.now() + 172800000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "DU-5 exception test cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        originLat: 9.02,
        originLon: 38.75,
        destinationLat: 7.05,
        destinationLon: 38.47,
      },
    });

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${exceptionLoad.id}/status`,
      { body: { status: "EXCEPTION" } }
    );

    const res = await callHandler(updateStatus, req, { id: exceptionLoad.id });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.load).toBeDefined();
    expect(data.load.status).toBe("EXCEPTION");
  });

  // ─── DU-6 ─────────────────────────────────────────────────────────

  it("DU-6 — ADMIN PATCH with IN_TRANSIT → 200 (ADMIN unaffected by G-U1-2 fix)", async () => {
    setAuthSession(adminSession);

    // Create a fresh load for the admin to update
    const adminLoad = await db.load.create({
      data: {
        id: "du6-load-001",
        status: "POSTED",
        pickupCity: "Dire Dawa",
        deliveryCity: "Mekelle",
        pickupDate: new Date(Date.now() + 86400000),
        deliveryDate: new Date(Date.now() + 172800000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "DU-6 admin status test cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        originLat: 9.59,
        originLon: 41.86,
        destinationLat: 13.5,
        destinationLon: 39.47,
      },
    });

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${adminLoad.id}/status`,
      { body: { status: "IN_TRANSIT" } }
    );

    const res = await callHandler(updateStatus, req, { id: adminLoad.id });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.load).toBeDefined();
    expect(data.load.status).toBe("IN_TRANSIT");
  });
});

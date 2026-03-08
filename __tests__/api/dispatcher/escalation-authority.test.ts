// @jest-environment node
/**
 * Dispatcher Escalation Authority Tests — Round U2
 *
 * Verifies that DISPATCHER role cannot RESOLVE/CLOSE/ASSIGN escalations
 * (admin-authority actions) but can set status to ESCALATED and update
 * coordination fields (notes, priority).
 *
 * Tests:
 * DU-7  — DISPATCHER PATCH status=RESOLVED → 403
 * DU-8  — DISPATCHER PATCH status=CLOSED → 403
 * DU-9  — DISPATCHER PATCH status=ESCALATED → 200 (allowed coordination)
 * DU-10 — DISPATCHER PATCH notes+priority only → 200 (allowed coordination)
 * DU-11 — ADMIN PATCH status=RESOLVED → 200 (ADMIN unaffected)
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
const { PATCH: updateEscalation } = require("@/app/api/escalations/[id]/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const dispatcherSession = createMockSession({
  userId: "du2-dispatcher-1",
  email: "du2-dispatcher@test.com",
  role: "DISPATCHER",
  status: "ACTIVE",
  organizationId: "du2-dispatcher-org-1",
});

const adminSession = createMockSession({
  userId: "du2-admin-1",
  email: "du2-admin@test.com",
  role: "ADMIN",
  status: "ACTIVE",
  organizationId: "du2-admin-org-1",
});

const shipperSession = createMockSession({
  userId: "du2-shipper-1",
  email: "du2-shipper@test.com",
  role: "SHIPPER",
  status: "ACTIVE",
  organizationId: "du2-shipper-org-1",
});

const carrierSession = createMockSession({
  userId: "du2-carrier-1",
  email: "du2-carrier@test.com",
  role: "CARRIER",
  status: "ACTIVE",
  organizationId: "du2-carrier-org-1",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Dispatcher Escalation Authority — Round U2", () => {
  let seed: SeedData;
  let escalationId: string;

  beforeAll(async () => {
    seed = await seedTestData();

    await db.user.create({
      data: {
        id: "du2-dispatcher-1",
        email: "du2-dispatcher@test.com",
        role: "DISPATCHER",
        organizationId: "du2-dispatcher-org-1",
        firstName: "Dispatcher",
        lastName: "U2",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "du2-admin-1",
        email: "du2-admin@test.com",
        role: "ADMIN",
        organizationId: "du2-admin-org-1",
        firstName: "Admin",
        lastName: "U2",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "du2-shipper-1",
        email: "du2-shipper@test.com",
        role: "SHIPPER",
        organizationId: "du2-shipper-org-1",
        firstName: "Shipper",
        lastName: "U2",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    await db.user.create({
      data: {
        id: "du2-carrier-1",
        email: "du2-carrier@test.com",
        role: "CARRIER",
        organizationId: "du2-carrier-org-1",
        firstName: "Carrier",
        lastName: "U2",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Create a load escalation in the in-memory store
    const esc = await db.loadEscalation.create({
      data: {
        id: "du2-escalation-001",
        title: "Late pickup escalation",
        escalationType: "LATE_PICKUP",
        priority: "MEDIUM",
        status: "OPEN",
        createdBy: seed.carrierUser.id,
        loadId: seed.load.id,
      },
    });
    escalationId = esc.id;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── DU-7 ────────────────────────────────────────────────────────────────────

  it("DU-7 — DISPATCHER PATCH status=RESOLVED → 403", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { status: "RESOLVED" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(
      /Dispatchers can only set escalation status to ESCALATED/
    );
  });

  // ─── DU-8 ────────────────────────────────────────────────────────────────────

  it("DU-8 — DISPATCHER PATCH status=CLOSED → 403", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { status: "CLOSED" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(
      /Dispatchers can only set escalation status to ESCALATED/
    );
  });

  // ─── DU-9 ────────────────────────────────────────────────────────────────────

  it("DU-9 — DISPATCHER PATCH status=ESCALATED → 200 (allowed coordination action)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { status: "ESCALATED" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.escalation).toBeDefined();
    expect(data.escalation.status).toBe("ESCALATED");
  });

  // ─── DU-10 ───────────────────────────────────────────────────────────────────

  it("DU-10 — DISPATCHER PATCH notes+priority only → 200 (allowed coordination fields)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { notes: "Driver confirmed late", priority: "CRITICAL" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.escalation).toBeDefined();
    expect(data.escalation.priority).toBe("CRITICAL");
  });

  // ─── DU-11 ───────────────────────────────────────────────────────────────────

  it("DU-11 — ADMIN PATCH status=RESOLVED → 200 (ADMIN unaffected by G-U2-1 fix)", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { status: "RESOLVED", resolution: "Issue addressed by admin" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.escalation).toBeDefined();
    expect(data.escalation.status).toBe("RESOLVED");
  });

  // ─── EA-12 ───────────────────────────────────────────────────────────────────

  it("EA-12 — DISPATCHER PATCH { resolution } → 403 (cannot set resolution)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { resolution: "Fixed it" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(/Dispatchers cannot set escalation resolution/);
  });

  // ─── EA-13 ───────────────────────────────────────────────────────────────────

  it("EA-13 — DISPATCHER PATCH { assignedTo } → 403 (cannot assign escalations)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { assignedTo: "some-user-id" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(/Dispatchers cannot assign escalations/);
  });

  // ─── EA-14 ───────────────────────────────────────────────────────────────────

  it("EA-14 — DISPATCHER PATCH { status: IN_PROGRESS } → 403 (in forbidden list)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { status: "IN_PROGRESS" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(
      /Dispatchers can only set escalation status to ESCALATED/
    );
  });

  // ─── EA-15 ───────────────────────────────────────────────────────────────────

  it("EA-15 — SHIPPER PATCH escalation → 403 (not dispatcher or admin)", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { notes: "Shipper notes" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(
      /Only dispatchers and admins can update escalations/
    );
  });

  // ─── EA-16 ───────────────────────────────────────────────────────────────────

  it("EA-16 — CARRIER PATCH escalation → 403 (not dispatcher or admin)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/escalations/${escalationId}`,
      { body: { notes: "Carrier notes" } }
    );

    const res = await callHandler(updateEscalation, req, { id: escalationId });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(
      /Only dispatchers and admins can update escalations/
    );
  });
});

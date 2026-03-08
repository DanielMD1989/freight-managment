// @jest-environment node
/**
 * Escalations Queue Tests — Round U2-FULL
 *
 * Full 5-role permission matrix for GET /api/escalations and
 * org-scoping matrix for GET /api/escalations/[id].
 *
 * Tests EQ-1 to EQ-12.
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

// Module-level mocks BEFORE handler require
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
// Custom dispatcherPermissions mock that includes canViewSystemDashboard
jest.mock("@/lib/dispatcherPermissions", () => ({
  canViewAllTrucks: jest.fn(() => true),
  hasElevatedPermissions: jest.fn(() => false),
  canRequestTruck: jest.fn(() => false),
  canApproveRequests: jest.fn(() => false),
  canProposeMatch: jest.fn(() => false),
  canPropose: jest.fn(() => false),
  canAssignLoads: jest.fn(() => false),
  canViewSystemDashboard: jest.fn((user: any) => {
    return ["DISPATCHER", "ADMIN", "SUPER_ADMIN"].includes(user?.role);
  }),
}));
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

// Import handlers AFTER mocks
const { GET: listEscalations } = require("@/app/api/escalations/route");
const { GET: getEscalation } = require("@/app/api/escalations/[id]/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const dispatcherSession = createMockSession({
  userId: "eq-dispatcher-1",
  email: "eq-dispatcher@test.com",
  role: "DISPATCHER",
  status: "ACTIVE",
  organizationId: "eq-dispatcher-org",
});

const adminSession = createMockSession({
  userId: "eq-admin-1",
  email: "eq-admin@test.com",
  role: "ADMIN",
  status: "ACTIVE",
  organizationId: "eq-admin-org",
});

const superAdminSession = createMockSession({
  userId: "eq-superadmin-1",
  email: "eq-superadmin@test.com",
  role: "SUPER_ADMIN",
  status: "ACTIVE",
  organizationId: "eq-superadmin-org",
});

const shipperSession = createMockSession({
  userId: "eq-shipper-1",
  email: "eq-shipper@test.com",
  role: "SHIPPER",
  status: "ACTIVE",
  organizationId: "eq-shipper-org",
});

const carrierSession = createMockSession({
  userId: "eq-carrier-1",
  email: "eq-carrier@test.com",
  role: "CARRIER",
  status: "ACTIVE",
  organizationId: "eq-carrier-org",
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Escalations Queue — Round U2-FULL", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();

    // Create users that db.user.findUnique may look up for org resolution
    for (const [id, email, role, org] of [
      [
        "eq-dispatcher-1",
        "eq-dispatcher@test.com",
        "DISPATCHER",
        "eq-dispatcher-org",
      ],
      ["eq-admin-1", "eq-admin@test.com", "ADMIN", "eq-admin-org"],
      [
        "eq-superadmin-1",
        "eq-superadmin@test.com",
        "SUPER_ADMIN",
        "eq-superadmin-org",
      ],
      ["eq-shipper-1", "eq-shipper@test.com", "SHIPPER", seed.shipperOrg.id],
      ["eq-carrier-1", "eq-carrier@test.com", "CARRIER", seed.carrierOrg.id],
    ] as const) {
      await db.user.create({
        data: {
          id,
          email,
          role,
          organizationId: org,
          firstName: role,
          lastName: "EQ",
          status: "ACTIVE",
          passwordHash: "mock-hash",
        },
      });
    }

    // Seed escalations with different statuses and priorities
    await db.loadEscalation.create({
      data: {
        id: "eq-esc-open-critical",
        title: "Critical open escalation",
        escalationType: "LATE_PICKUP",
        priority: "CRITICAL",
        status: "OPEN",
        createdBy: seed.carrierUser.id,
        loadId: seed.load.id,
      },
    });

    await db.loadEscalation.create({
      data: {
        id: "eq-esc-resolved-medium",
        title: "Resolved medium escalation",
        escalationType: "LATE_PICKUP",
        priority: "MEDIUM",
        status: "RESOLVED",
        createdBy: seed.carrierUser.id,
        loadId: seed.load.id,
      },
    });

    // Create a second load assigned to the carrier org for carrier-owned escalation test
    await db.load.create({
      data: {
        id: "eq-load-carrier-own",
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "EQ carrier own test",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
      },
    });

    await db.loadEscalation.create({
      data: {
        id: "eq-esc-carrier-own",
        title: "Carrier-owned truck escalation",
        escalationType: "DAMAGE_CLAIM",
        priority: "HIGH",
        status: "OPEN",
        createdBy: seed.carrierUser.id,
        loadId: "eq-load-carrier-own",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── EQ-1: DISPATCHER → 200 ──────────────────────────────────────────────────

  it("EQ-1 — DISPATCHER GET /api/escalations → 200 with escalations + stats", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest("GET", "http://localhost:3000/api/escalations");

    const res = await callHandler(listEscalations, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(Array.isArray(data.escalations)).toBe(true);
    expect(typeof data.total).toBe("number");
    expect(data.stats).toBeDefined();
    expect(data.stats.byStatus).toBeDefined();
    expect(data.stats.byPriority).toBeDefined();
  });

  // ─── EQ-2: ADMIN → 200 ───────────────────────────────────────────────────────

  it("EQ-2 — ADMIN GET /api/escalations → 200", async () => {
    setAuthSession(adminSession);

    const req = createRequest("GET", "http://localhost:3000/api/escalations");

    const res = await callHandler(listEscalations, req);
    expect(res.status).toBe(200);
  });

  // ─── EQ-3: SUPER_ADMIN → 200 ─────────────────────────────────────────────────

  it("EQ-3 — SUPER_ADMIN GET /api/escalations → 200", async () => {
    setAuthSession(superAdminSession);

    const req = createRequest("GET", "http://localhost:3000/api/escalations");

    const res = await callHandler(listEscalations, req);
    expect(res.status).toBe(200);
  });

  // ─── EQ-4: SHIPPER → 403 ─────────────────────────────────────────────────────

  it("EQ-4 — SHIPPER GET /api/escalations → 403", async () => {
    setAuthSession(shipperSession);

    const req = createRequest("GET", "http://localhost:3000/api/escalations");

    const res = await callHandler(listEscalations, req);
    expect(res.status).toBe(403);
  });

  // ─── EQ-5: CARRIER → 403 ─────────────────────────────────────────────────────

  it("EQ-5 — CARRIER GET /api/escalations → 403", async () => {
    setAuthSession(carrierSession);

    const req = createRequest("GET", "http://localhost:3000/api/escalations");

    const res = await callHandler(listEscalations, req);
    expect(res.status).toBe(403);
  });

  // ─── EQ-6: status filter ──────────────────────────────────────────────────────

  it("EQ-6 — ?status=OPEN filter → only OPEN escalations returned", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/escalations?status=OPEN"
    );

    const res = await callHandler(listEscalations, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(Array.isArray(data.escalations)).toBe(true);
    // All returned escalations should have status OPEN
    for (const esc of data.escalations) {
      expect(esc.status).toBe("OPEN");
    }
  });

  // ─── EQ-7: priority filter ────────────────────────────────────────────────────

  it("EQ-7 — ?priority=CRITICAL filter → only CRITICAL escalations returned", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/escalations?priority=CRITICAL"
    );

    const res = await callHandler(listEscalations, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(Array.isArray(data.escalations)).toBe(true);
    for (const esc of data.escalations) {
      expect(esc.priority).toBe("CRITICAL");
    }
  });

  // ─── EQ-8: limit clamped to 100 ──────────────────────────────────────────────

  it("EQ-8 — ?limit=200 → clamped to max 100", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/escalations?limit=200"
    );

    const res = await callHandler(listEscalations, req);
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    // The route clamps to 100
    expect(data.limit).toBe(100);
  });

  // ─── EQ-9: DISPATCHER GET escalation for unrelated-org load → 200 ────────────

  it("EQ-9 — DISPATCHER GET escalation for unrelated-org load → 200 (platform-wide, no org scope)", async () => {
    setAuthSession(dispatcherSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/escalations/eq-esc-open-critical`
    );

    const res = await callHandler(getEscalation, req, {
      id: "eq-esc-open-critical",
    });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.escalation).toBeDefined();
    expect(data.escalation.id).toBe("eq-esc-open-critical");
  });

  // ─── EQ-10: SHIPPER GET own-org escalation → 200 ─────────────────────────────

  it("EQ-10 — SHIPPER GET own-org escalation → 200", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/escalations/eq-esc-open-critical`
    );

    const res = await callHandler(getEscalation, req, {
      id: "eq-esc-open-critical",
    });
    // The escalation's load.shipperId === seed.shipperOrg.id, and shipperSession.organizationId = seed.shipperOrg.id
    expect(res.status).toBe(200);
  });

  // ─── EQ-11: SHIPPER GET wrong-org escalation → 403 ───────────────────────────

  it("EQ-11 — SHIPPER GET wrong-org escalation → 403", async () => {
    // Create a new shipper session that doesn't own the load's shipper org
    const wrongShipperSession = createMockSession({
      userId: "eq-wrong-shipper",
      email: "wrong-shipper@test.com",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "eq-wrong-shipper-org",
    });

    await db.user.create({
      data: {
        id: "eq-wrong-shipper",
        email: "wrong-shipper@test.com",
        role: "SHIPPER",
        organizationId: "eq-wrong-shipper-org",
        firstName: "Wrong",
        lastName: "Shipper",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    setAuthSession(wrongShipperSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/escalations/eq-esc-open-critical`
    );

    const res = await callHandler(getEscalation, req, {
      id: "eq-esc-open-critical",
    });
    expect(res.status).toBe(403);
  });

  // ─── EQ-12: CARRIER GET own-org truck escalation → 200 ───────────────────────

  it("EQ-12 — CARRIER GET own-org truck escalation → 200", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      `http://localhost:3000/api/escalations/eq-esc-carrier-own`
    );

    const res = await callHandler(getEscalation, req, {
      id: "eq-esc-carrier-own",
    });
    // The escalation's load has assignedTruck.carrierId === seed.carrierOrg.id and carrierSession.organizationId = seed.carrierOrg.id
    expect(res.status).toBe(200);
  });
});

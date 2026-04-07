// @jest-environment node
/**
 * Admin Revenue By Organization Tests — Round A16
 *
 * Verifies that GET /api/admin/revenue/by-organization returns
 * per-shipper and per-carrier fee breakdowns filtered by time period.
 *
 * G-A16-1: per-Shipper revenue breakdown by time period
 * G-A16-2: per-Carrier revenue breakdown by time period (via truck chain)
 *
 * RB1 — 401 for unauthenticated
 * RB2 — 403 for SHIPPER role
 * RB3 — 403 for CARRIER role
 * RB4 — ?period=month returns byShipper with correct fee sums
 * RB5 — ?period=month returns byCarrier with correct fee sums via truck chain
 * RB6 — ?period=day excludes loads outside today's window
 * RB7 — ?period=year includes all loads in rolling year
 * RB8 — summary.totalRevenue = sum(byShipper) + sum(byCarrier)
 * RB9 — Loads with shipperFeeStatus != 'DEDUCTED' excluded from shipper breakdown
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
  parseResponse,
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
  mockApiErrors,
  mockLogger,
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
} from "../../utils/routeTestUtils";

// ─── Shared mocks ─────────────────────────────────────────────────────────────

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
mockApiErrors();
mockLogger();
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

// ─── RBAC mock — uses real hasPermission logic ────────────────────────────────
jest.mock("@/lib/rbac", () => {
  const actual = jest.requireActual("@/lib/rbac/permissions");
  return {
    requirePermission: jest.fn(async (permission: string) => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      const session = getAuthSession();
      if (!session) {
        const error = new Error("Unauthorized");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      if (!actual.hasPermission(session.role, permission)) {
        const error = new Error("Insufficient permissions");
        (error as any).name = "ForbiddenError";
        throw error;
      }
      return session;
    }),
    Permission: actual.Permission,
    hasPermission: actual.hasPermission,
    ForbiddenError: class ForbiddenError extends Error {
      constructor(msg = "Forbidden") {
        super(msg);
        this.name = "ForbiddenError";
      }
    },
  };
});

// ─── Handler (imported after mocks) ───────────────────────────────────────────

const {
  GET: getRevenueByOrg,
} = require("@/app/api/admin/revenue/by-organization/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const adminSession = createMockSession({
  userId: "rb-admin-user",
  role: "ADMIN",
  organizationId: "rb-admin-org",
});

const shipperSession = createMockSession({
  userId: "rb-shipper-user",
  role: "SHIPPER",
  organizationId: "rb-shipper-org-1",
});

const carrierSession = createMockSession({
  userId: "rb-carrier-user",
  role: "CARRIER",
  organizationId: "rb-carrier-org-1",
});

// ─── IDs ──────────────────────────────────────────────────────────────────────

const SHIPPER_ORG_1 = "rb-shipper-org-1";
const SHIPPER_ORG_2 = "rb-shipper-org-2";
const CARRIER_ORG_1 = "rb-carrier-org-1";
const TRUCK_1 = "rb-truck-01";
const LOAD_SHIPPER_1 = "rb-load-s1";
const LOAD_SHIPPER_2 = "rb-load-s2";
const LOAD_CARRIER_1 = "rb-load-c1";
const LOAD_PENDING = "rb-load-pending";

// ─── Date helpers ─────────────────────────────────────────────────────────────

const daysAgo = (n: number) => new Date(Date.now() - n * 24 * 60 * 60 * 1000);
const hoursAgo = (n: number) => new Date(Date.now() - n * 60 * 60 * 1000);

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedBase() {
  // Organizations
  await db.organization.create({
    data: { id: SHIPPER_ORG_1, name: "RB Shipper One", type: "SHIPPER" },
  });
  await db.organization.create({
    data: { id: SHIPPER_ORG_2, name: "RB Shipper Two", type: "SHIPPER" },
  });
  await db.organization.create({
    data: { id: CARRIER_ORG_1, name: "RB Carrier One", type: "CARRIER" },
  });

  // Truck linked to carrier org
  await db.truck.create({
    data: {
      id: TRUCK_1,
      licensePlate: "RB-TRUCK-01",
      truckType: "FLATBED",
      carrierId: CARRIER_ORG_1,
      status: "ACTIVE",
    },
  });
}

async function seedShipperLoads() {
  // Load 1: shipper 1, deducted 15 days ago (within month, week, year)
  await db.load.create({
    data: {
      id: LOAD_SHIPPER_1,
      shipperId: SHIPPER_ORG_1,
      shipperServiceFee: 100,
      shipperFeeStatus: "DEDUCTED",
      shipperFeeDeductedAt: daysAgo(15),
      status: "DELIVERED",
    },
  });

  // Load 2: shipper 2, deducted 15 days ago
  await db.load.create({
    data: {
      id: LOAD_SHIPPER_2,
      shipperId: SHIPPER_ORG_2,
      shipperServiceFee: 200,
      shipperFeeStatus: "DEDUCTED",
      shipperFeeDeductedAt: daysAgo(15),
      status: "DELIVERED",
    },
  });
}

async function seedCarrierLoad() {
  // Carrier load: deducted 15 days ago, assigned to truck pointing to carrier org
  await db.load.create({
    data: {
      id: LOAD_CARRIER_1,
      shipperId: SHIPPER_ORG_1,
      assignedTruckId: TRUCK_1,
      carrierServiceFee: 75,
      carrierFeeStatus: "DEDUCTED",
      carrierFeeDeductedAt: daysAgo(15),
      status: "DELIVERED",
    },
  });
}

async function seedPendingLoad() {
  // Non-DEDUCTED load: should NOT appear in shipper breakdown
  await db.load.create({
    data: {
      id: LOAD_PENDING,
      shipperId: SHIPPER_ORG_1,
      shipperServiceFee: 500,
      shipperFeeStatus: "PENDING",
      shipperFeeDeductedAt: null,
      status: "ASSIGNED",
    },
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("GET /api/admin/revenue/by-organization", () => {
  beforeEach(async () => {
    clearAllStores();
    await seedBase();
    setAuthSession(adminSession);
  });

  // RB1: 401 for unauthenticated
  it("RB1: returns 401 for unauthenticated requests", async () => {
    setAuthSession(null);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization"
    );
    const res = await callHandler(getRevenueByOrg, req);

    expect(res.status).toBe(401);
    const body = await parseResponse(res);
    expect(body.error).toBeDefined();
  });

  // RB2: 403 for SHIPPER role
  it("RB2: returns 403 for SHIPPER role", async () => {
    setAuthSession(shipperSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization"
    );
    const res = await callHandler(getRevenueByOrg, req);

    expect(res.status).toBe(403);
  });

  // RB3: 403 for CARRIER role
  it("RB3: returns 403 for CARRIER role", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization"
    );
    const res = await callHandler(getRevenueByOrg, req);

    expect(res.status).toBe(403);
  });

  // RB4: ?period=month returns byShipper with correct fee sums
  it("RB4: period=month returns byShipper with correct fee amounts", async () => {
    await seedShipperLoads();

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization?period=month"
    );
    const res = await callHandler(getRevenueByOrg, req);

    expect(res.status).toBe(200);
    const body = await parseResponse(res);

    expect(Array.isArray(body.byShipper)).toBe(true);
    expect(body.byShipper.length).toBe(2);

    const shipper1 = body.byShipper.find(
      (s: any) => s.organizationId === SHIPPER_ORG_1
    );
    const shipper2 = body.byShipper.find(
      (s: any) => s.organizationId === SHIPPER_ORG_2
    );

    expect(shipper1).toBeDefined();
    expect(shipper1.shipperFeeCollected).toBe(100);
    expect(shipper1.loadCount).toBe(1);
    expect(shipper1.name).toBe("RB Shipper One");

    expect(shipper2).toBeDefined();
    expect(shipper2.shipperFeeCollected).toBe(200);
    expect(shipper2.loadCount).toBe(1);
  });

  // RB5: ?period=month returns byCarrier with correct fee sums via truck chain
  it("RB5: period=month returns byCarrier via assignedTruck→carrier chain", async () => {
    await seedCarrierLoad();

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization?period=month"
    );
    const res = await callHandler(getRevenueByOrg, req);

    expect(res.status).toBe(200);
    const body = await parseResponse(res);

    expect(Array.isArray(body.byCarrier)).toBe(true);
    expect(body.byCarrier.length).toBe(1);

    const carrier = body.byCarrier[0];
    expect(carrier.organizationId).toBe(CARRIER_ORG_1);
    expect(carrier.name).toBe("RB Carrier One");
    expect(carrier.carrierFeeCollected).toBe(75);
    expect(carrier.loadCount).toBe(1);
  });

  // RB6: ?period=day excludes loads outside today's window
  it("RB6: period=day excludes loads deducted before today midnight", async () => {
    // Load deducted yesterday — should be EXCLUDED
    await db.load.create({
      data: {
        id: "rb-load-yesterday",
        shipperId: SHIPPER_ORG_1,
        shipperServiceFee: 999,
        shipperFeeStatus: "DEDUCTED",
        shipperFeeDeductedAt: daysAgo(1),
        status: "DELIVERED",
      },
    });

    // Load deducted "now" — always within [local-midnight-today, now] window.
    // Cannot use noon because at runs before 12:00 local, noon is in the future
    // (end = now), and cannot use hoursAgo(1) because runs between 00:00-00:59
    // local would land in yesterday.
    const todayNoon = new Date();
    await db.load.create({
      data: {
        id: "rb-load-today",
        shipperId: SHIPPER_ORG_2,
        shipperServiceFee: 50,
        shipperFeeStatus: "DEDUCTED",
        shipperFeeDeductedAt: todayNoon,
        status: "DELIVERED",
      },
    });

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization?period=day"
    );
    const res = await callHandler(getRevenueByOrg, req);

    expect(res.status).toBe(200);
    const body = await parseResponse(res);

    // Only the today load should appear
    const includeYesterday = body.byShipper.some(
      (s: any) =>
        s.organizationId === SHIPPER_ORG_1 && s.shipperFeeCollected === 999
    );
    expect(includeYesterday).toBe(false);

    const todayEntry = body.byShipper.find(
      (s: any) => s.organizationId === SHIPPER_ORG_2
    );
    expect(todayEntry).toBeDefined();
    expect(todayEntry.shipperFeeCollected).toBe(50);
  });

  // RB7: ?period=year includes loads deducted within past year
  it("RB7: period=year includes loads deducted within rolling year", async () => {
    // Load deducted 11 months ago — within year window
    await db.load.create({
      data: {
        id: "rb-load-11mo",
        shipperId: SHIPPER_ORG_1,
        shipperServiceFee: 300,
        shipperFeeStatus: "DEDUCTED",
        shipperFeeDeductedAt: daysAgo(330),
        status: "DELIVERED",
      },
    });

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization?period=year"
    );
    const res = await callHandler(getRevenueByOrg, req);

    expect(res.status).toBe(200);
    const body = await parseResponse(res);

    const entry = body.byShipper.find(
      (s: any) => s.organizationId === SHIPPER_ORG_1
    );
    expect(entry).toBeDefined();
    expect(entry.shipperFeeCollected).toBe(300);
  });

  // RB8: summary.totalRevenue = sum(byShipper) + sum(byCarrier)
  it("RB8: summary.totalRevenue equals sum of shipper and carrier fees", async () => {
    await seedShipperLoads();
    await seedCarrierLoad();

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization?period=month"
    );
    const res = await callHandler(getRevenueByOrg, req);

    expect(res.status).toBe(200);
    const body = await parseResponse(res);

    const { totalShipperFees, totalCarrierFees, totalRevenue } = body.summary;

    expect(totalShipperFees).toBe(300); // 100 + 200
    expect(totalCarrierFees).toBe(75);
    expect(totalRevenue).toBe(375); // 300 + 75
  });

  // RB9: Loads with shipperFeeStatus != 'DEDUCTED' excluded from shipper breakdown
  it("RB9: loads with PENDING shipperFeeStatus are excluded from shipper breakdown", async () => {
    await seedPendingLoad();

    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/revenue/by-organization?period=month"
    );
    const res = await callHandler(getRevenueByOrg, req);

    expect(res.status).toBe(200);
    const body = await parseResponse(res);

    // byShipper should be empty — no DEDUCTED loads
    expect(body.byShipper).toHaveLength(0);
    expect(body.summary.totalShipperFees).toBe(0);
  });
});

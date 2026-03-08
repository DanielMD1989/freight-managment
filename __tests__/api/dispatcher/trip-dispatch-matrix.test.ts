// @jest-environment node
/**
 * Trip Dispatch Matrix Tests — Round U2-FULL
 *
 * Full role × status matrix for PATCH /api/trips/[tripId].
 *
 * Tests TDM-1 to TDM-8.
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
  SeedData,
} from "../../utils/routeTestUtils";

// ─── Module-level mocks ───────────────────────────────────────────────────────

mockAuth();
mockCsrf();

jest.mock("@/lib/rateLimit", () => ({
  checkRpsLimit: jest.fn(async () => ({
    allowed: true,
    limit: 100,
    remaining: 99,
  })),
  checkRateLimit: jest.fn(async () => ({
    allowed: true,
    success: true,
    limit: 100,
    remaining: 99,
    retryAfter: 0,
    resetTime: Date.now() + 3600000,
  })),
  addRateLimitHeaders: jest.fn((res: unknown) => res),
  withRpsLimit: jest.fn((_config: unknown, handler: unknown) => handler),
  RPS_CONFIGS: { write: { rps: 10, burst: 20 } },
}));

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

// Use real trip state machine so transition + role rules are exercised end-to-end
jest.mock("@/lib/tripStateMachine", () => ({
  ...jest.requireActual("@/lib/tripStateMachine"),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Prisma client mock: include EXCEPTION in both TripStatus and LoadStatus enums
jest.mock("@prisma/client", () => ({
  TripStatus: {
    ASSIGNED: "ASSIGNED",
    PICKUP_PENDING: "PICKUP_PENDING",
    IN_TRANSIT: "IN_TRANSIT",
    DELIVERED: "DELIVERED",
    COMPLETED: "COMPLETED",
    EXCEPTION: "EXCEPTION",
    CANCELLED: "CANCELLED",
  },
  LoadStatus: {
    DRAFT: "DRAFT",
    POSTED: "POSTED",
    ASSIGNED: "ASSIGNED",
    PICKUP_PENDING: "PICKUP_PENDING",
    IN_TRANSIT: "IN_TRANSIT",
    DELIVERED: "DELIVERED",
    COMPLETED: "COMPLETED",
    EXCEPTION: "EXCEPTION",
    CANCELLED: "CANCELLED",
  },
  Prisma: {
    Decimal: class Decimal {
      constructor(public value: number) {}
      toString() {
        return String(this.value);
      }
      toNumber() {
        return this.value;
      }
    },
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      clientVersion: string;
      constructor(
        message: string,
        { code, clientVersion }: { code: string; clientVersion: string }
      ) {
        super(message);
        this.name = "PrismaClientKnownRequestError";
        this.code = code;
        this.clientVersion = clientVersion;
      }
    },
  },
}));

jest.mock("@/lib/serviceFeeManagement", () => ({
  validateWalletBalancesForTrip: jest.fn(async () => ({
    valid: true,
    errors: [],
  })),
  deductServiceFees: jest.fn(async () => ({ success: true })),
  deductServiceFee: jest.fn(async () => ({ success: true })),
  refundServiceFee: jest.fn(async () => ({ success: true })),
}));

// RBAC mock that respects role-based getAccessRoles for trip access control
jest.mock("@/lib/rbac", () => ({
  requirePermission: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  requireRole: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    return getAuthSession();
  }),
  requireAnyPermission: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    return getAuthSession();
  }),
  Permission: new Proxy({}, { get: (_t: any, p: any) => String(p) }),
  UnauthorizedError: class UnauthorizedError extends Error {
    constructor(msg = "Unauthorized") {
      super(msg);
      this.name = "UnauthorizedError";
    }
  },
  ForbiddenError: class ForbiddenError extends Error {
    constructor(msg = "Forbidden") {
      super(msg);
      this.name = "ForbiddenError";
    }
  },
  getCurrentUserRole: jest.fn(async () => null),
  hasRole: jest.fn(() => true),
  hasAnyRole: jest.fn(() => true),
  hasPermission: jest.fn(() => true),
  hasAnyPermission: jest.fn(() => true),
  hasAllPermissions: jest.fn(() => true),
  isAdmin: jest.fn(() => false),
  isOps: jest.fn(() => false),
  isSuperAdmin: jest.fn(() => false),
  canManageOrganization: jest.fn(() => true),
  getAccessRoles: jest.fn((session: any, opts: any) => {
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isShipper = session.role === "SHIPPER";
    const isCarrier = session.role === "CARRIER";
    const isDispatcher = session.role === "DISPATCHER";
    const hasAccess =
      isAdmin ||
      isDispatcher ||
      (isShipper && session.organizationId === opts?.shipperOrgId) ||
      (isCarrier && session.organizationId === opts?.carrierOrgId);
    return { isShipper, isCarrier, isAdmin, isDispatcher, hasAccess };
  }),
  canView: jest.fn(() => true),
  canModify: jest.fn(() => true),
  isAdminRole: jest.fn(() => false),
  isSuperAdminRole: jest.fn(() => false),
}));

// Handler require AFTER mocks
const { PATCH: updateTrip } = require("@/app/api/trips/[tripId]/route");

// ─── Test suite ───────────────────────────────────────────────────────────────

describe("Trip Dispatch Matrix — Round U2-FULL", () => {
  let seed: SeedData;
  let counter = 0;

  function nextIds() {
    counter++;
    return {
      loadId: `tdm-load-${counter}`,
      tripId: `tdm-trip-${counter}`,
    };
  }

  // Sessions (set after seed to get real org IDs)
  let dispatcherScopedSession: ReturnType<typeof createMockSession>;
  let dispatcherUnscopedSession: ReturnType<typeof createMockSession>;
  let carrierOwnSession: ReturnType<typeof createMockSession>;
  let carrierWrongOrgSession: ReturnType<typeof createMockSession>;
  let shipperSession: ReturnType<typeof createMockSession>;
  let adminSession: ReturnType<typeof createMockSession>;

  // Helper: create trip with a given status
  async function createTrip(
    status: string,
    overrides: Record<string, unknown> = {}
  ) {
    const { loadId, tripId } = nextIds();
    await db.load.create({
      data: {
        id: loadId,
        status:
          status === "EXCEPTION"
            ? "EXCEPTION"
            : status === "ASSIGNED"
              ? "ASSIGNED"
              : "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: `TDM test cargo ${counter}`,
        weight: 5000,
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
        shipperFeeStatus: "PENDING",
      },
    });
    await db.trip.create({
      data: {
        id: tripId,
        loadId,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status,
        trackingEnabled: true,
        ...overrides,
      },
    });
    return { loadId, tripId };
  }

  beforeAll(async () => {
    seed = await seedTestData();

    // Sessions scoped to actual seed org IDs
    dispatcherScopedSession = createMockSession({
      userId: "tdm-dispatcher-scoped",
      email: "dispatcher-scoped@tdm.test",
      role: "DISPATCHER",
      organizationId: seed.carrierOrg.id, // scoped to carrier org
    });

    dispatcherUnscopedSession = createMockSession({
      userId: "tdm-dispatcher-unscoped",
      email: "dispatcher-unscoped@tdm.test",
      role: "DISPATCHER",
      organizationId: "tdm-unscoped-org", // not carrier or shipper
    });

    carrierOwnSession = createMockSession({
      userId: "tdm-carrier-own",
      email: "carrier-own@tdm.test",
      role: "CARRIER",
      organizationId: seed.carrierOrg.id,
    });

    carrierWrongOrgSession = createMockSession({
      userId: "tdm-carrier-wrong",
      email: "carrier-wrong@tdm.test",
      role: "CARRIER",
      organizationId: "tdm-wrong-carrier-org",
    });

    shipperSession = createMockSession({
      userId: "tdm-shipper-1",
      email: "shipper@tdm.test",
      role: "SHIPPER",
      organizationId: seed.shipperOrg.id,
    });

    adminSession = createMockSession({
      userId: "tdm-admin-1",
      email: "admin@tdm.test",
      role: "ADMIN",
      organizationId: "tdm-admin-org",
    });

    // Create users required by requireActiveUser / db lookups
    for (const u of [
      dispatcherScopedSession,
      dispatcherUnscopedSession,
      carrierOwnSession,
      carrierWrongOrgSession,
      shipperSession,
      adminSession,
    ]) {
      await db.user.create({
        data: {
          id: u.userId,
          email: u.email,
          role: u.role,
          organizationId: u.organizationId,
          firstName: u.role,
          lastName: "TDM",
          status: "ACTIVE",
          passwordHash: "mock-hash",
        },
      });
    }
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ─── TDM-1: Scoped DISPATCHER PATCH EXCEPTION → 200 ─────────────────────────

  it("TDM-1 — DISPATCHER (org = carrierId) PATCH status=EXCEPTION → 200", async () => {
    const { tripId } = await createTrip("IN_TRANSIT");
    setAuthSession(dispatcherScopedSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${tripId}`,
      { body: { status: "EXCEPTION" } }
    );

    const res = await callHandler(updateTrip, req, { tripId });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.trip.status).toBe("EXCEPTION");
  });

  // ─── TDM-2: Scoped DISPATCHER PATCH CANCELLED → 200 ─────────────────────────

  it("TDM-2 — DISPATCHER (org = carrierId) PATCH status=CANCELLED from ASSIGNED → 200", async () => {
    const { tripId } = await createTrip("ASSIGNED");
    setAuthSession(dispatcherScopedSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${tripId}`,
      { body: { status: "CANCELLED" } }
    );

    const res = await callHandler(updateTrip, req, { tripId });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.trip.status).toBe("CANCELLED");
  });

  // ─── TDM-3: Scoped DISPATCHER on EXCEPTION trip → ASSIGNED → 403 ─────────────

  it("TDM-3 — DISPATCHER (org = carrierId) on trip.status=EXCEPTION → resolve to ASSIGNED → 403", async () => {
    const { tripId } = await createTrip("EXCEPTION");
    setAuthSession(dispatcherScopedSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${tripId}`,
      { body: { status: "ASSIGNED" } }
    );

    const res = await callHandler(updateTrip, req, { tripId });
    expect(res.status).toBe(403);

    const data = await parseResponse(res);
    expect(data.error).toMatch(/only admins can resolve/i);
  });

  // ─── TDM-4: Unscoped DISPATCHER → 404 ────────────────────────────────────────

  it("TDM-4 — DISPATCHER (org ≠ carrierId AND ≠ shipperId) PATCH → 404", async () => {
    const { tripId } = await createTrip("ASSIGNED");
    setAuthSession(dispatcherUnscopedSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${tripId}`,
      { body: { status: "PICKUP_PENDING" } }
    );

    const res = await callHandler(updateTrip, req, { tripId });
    expect(res.status).toBe(404);
  });

  // ─── TDM-5: SHIPPER PATCH trip → 404 ─────────────────────────────────────────

  it("TDM-5 — SHIPPER PATCH trip status → 404 (no trip PATCH rights)", async () => {
    const { tripId } = await createTrip("ASSIGNED");
    setAuthSession(shipperSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${tripId}`,
      { body: { status: "PICKUP_PENDING" } }
    );

    const res = await callHandler(updateTrip, req, { tripId });
    expect(res.status).toBe(404);
  });

  // ─── TDM-6: CARRIER (own-org) PATCH IN_TRANSIT → 200 ────────────────────────

  it("TDM-6 — CARRIER (own-org) PATCH status=IN_TRANSIT → 200", async () => {
    const { tripId } = await createTrip("PICKUP_PENDING");
    setAuthSession(carrierOwnSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${tripId}`,
      { body: { status: "IN_TRANSIT" } }
    );

    const res = await callHandler(updateTrip, req, { tripId });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.trip.status).toBe("IN_TRANSIT");
  });

  // ─── TDM-7: CARRIER (wrong-org) PATCH → 404 ─────────────────────────────────

  it("TDM-7 — CARRIER (wrong-org) PATCH → 404", async () => {
    const { tripId } = await createTrip("PICKUP_PENDING");
    setAuthSession(carrierWrongOrgSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${tripId}`,
      { body: { status: "IN_TRANSIT" } }
    );

    const res = await callHandler(updateTrip, req, { tripId });
    expect(res.status).toBe(404);
  });

  // ─── TDM-8: ADMIN resolves EXCEPTION → IN_TRANSIT → 200 ─────────────────────

  it("TDM-8 — ADMIN PATCH trip.status=EXCEPTION → resolve to IN_TRANSIT → 200", async () => {
    const { tripId } = await createTrip("EXCEPTION");
    setAuthSession(adminSession);

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${tripId}`,
      { body: { status: "IN_TRANSIT" } }
    );

    const res = await callHandler(updateTrip, req, { tripId });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.trip.status).toBe("IN_TRANSIT");
  });
});

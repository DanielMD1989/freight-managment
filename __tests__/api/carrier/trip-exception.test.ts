// @jest-environment node
/**
 * Trip Exception Path Tests — Round A12
 *
 * Blueprint §7 exception path:
 *   IN_TRANSIT → EXCEPTION (Carrier / Dispatcher / Admin can raise)
 *   EXCEPTION  → ASSIGNED | IN_TRANSIT | CANCELLED | COMPLETED  (ADMIN only)
 *
 * Gaps fixed:
 *   G-A12-1: EXCEPTION resolution restricted to ADMIN only (DISPATCHER was allowed)
 *   G-A12-2: CARRIER can now raise EXCEPTION (was 403)
 *   G-A12-3: createNotificationForRole called for DISPATCHER on EXCEPTION
 *   G-A12-4: exceptionAt timestamp set when trip enters EXCEPTION
 *
 * Tests E1–E10.
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

// ─── Module-level mocks (must be before handler require) ─────────────────────

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

// Prisma client mock: include EXCEPTION in both TripStatus and LoadStatus
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

// Mock serviceFeeManagement for refund assertions (test E8)
jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFees: jest.fn(async () => ({ success: true })),
  deductServiceFee: jest.fn(async () => ({ success: true })),
  refundServiceFee: jest.fn(async () => ({ success: true })),
}));

// RBAC mock that respects role-based getAccessRoles (needed by GET handler)
jest.mock("@/lib/rbac", () => ({
  requirePermission: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  requireRole: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    return getAuthSession();
  }),
  requireAnyPermission: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
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

// ─── Test suite ──────────────────────────────────────────────────────────────

describe("Trip Exception Path — Round A12", () => {
  let seed: SeedData;

  // Counter for unique trip/load IDs across tests
  let counter = 0;
  function nextIds() {
    counter++;
    return {
      loadId: `exc-load-${counter}`,
      tripId: `exc-trip-${counter}`,
    };
  }

  // Sessions
  const carrierSession = createMockSession({
    userId: "exc-carrier-user",
    email: "carrier@exc.test",
    role: "CARRIER",
    organizationId: "exc-carrier-org", // set after seed
  });

  const adminSession = createMockSession({
    userId: "exc-admin-user",
    email: "admin@exc.test",
    role: "ADMIN",
    organizationId: "exc-admin-org",
  });

  // Dispatcher scoped to the carrier org (so isDispatcher check in route passes)
  let dispatcherScopedSession: ReturnType<typeof createMockSession>;

  // Helper: create a fresh IN_TRANSIT trip (default) or any status
  async function createExceptionTrip(
    status = "IN_TRANSIT",
    overrides: Record<string, unknown> = {}
  ) {
    const { loadId, tripId } = nextIds();
    await db.load.create({
      data: {
        id: loadId,
        status: status === "IN_TRANSIT" ? "IN_TRANSIT" : "EXCEPTION",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: `Exception test cargo ${counter}`,
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

    // Patch sessions to use actual seed org IDs
    (carrierSession as any).organizationId = seed.carrierOrg.id;
    dispatcherScopedSession = createMockSession({
      userId: "exc-dispatcher-user",
      email: "dispatcher@exc.test",
      role: "DISPATCHER",
      organizationId: seed.carrierOrg.id, // scoped to carrier org → passes isDispatcher guard
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  // ─── E1: Carrier can raise EXCEPTION (G-A12-2) ────────────────────────────

  describe("E1 — Carrier raises IN_TRANSIT → EXCEPTION", () => {
    it("returns 200 and sets trip status to EXCEPTION", async () => {
      const { tripId } = await createExceptionTrip("IN_TRANSIT");
      setAuthSession(carrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "EXCEPTION" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("EXCEPTION");
    });

    it("sets exceptionAt timestamp (G-A12-4)", async () => {
      const { tripId } = await createExceptionTrip("IN_TRANSIT");
      setAuthSession(carrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "EXCEPTION" },
        }
      );
      await callHandler(updateTrip, req, { tripId });

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.exceptionAt).not.toBeNull();
    });

    it("syncs load to LoadStatus.EXCEPTION (E10)", async () => {
      const { tripId, loadId } = await createExceptionTrip("IN_TRANSIT");
      setAuthSession(carrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "EXCEPTION" },
        }
      );
      await callHandler(updateTrip, req, { tripId });

      const load = await db.load.findUnique({ where: { id: loadId } });
      expect(load.status).toBe("EXCEPTION");
    });
  });

  // ─── E2: Dispatcher (scoped) can raise EXCEPTION ──────────────────────────

  describe("E2 — Dispatcher (scoped to carrier org) raises EXCEPTION", () => {
    it("returns 200", async () => {
      const { tripId } = await createExceptionTrip("IN_TRANSIT");
      setAuthSession(dispatcherScopedSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "EXCEPTION" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("EXCEPTION");
    });
  });

  // ─── E3: Admin can raise EXCEPTION ────────────────────────────────────────

  describe("E3 — Admin raises EXCEPTION", () => {
    it("returns 200", async () => {
      const { tripId } = await createExceptionTrip("IN_TRANSIT");
      setAuthSession(adminSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "EXCEPTION" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);
    });
  });

  // ─── E4: Carrier CANNOT resolve EXCEPTION (G-A12-1) ──────────────────────

  describe("E4 — Carrier cannot resolve EXCEPTION (not in role permissions)", () => {
    it("EXCEPTION → ASSIGNED blocked for CARRIER → 403", async () => {
      const { tripId } = await createExceptionTrip("EXCEPTION");
      setAuthSession(carrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "ASSIGNED" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      // canRoleSetTripStatus(CARRIER, ASSIGNED) = false → 403
      expect(res.status).toBe(403);
    });
  });

  // ─── E5: Dispatcher CANNOT resolve EXCEPTION → ASSIGNED (G-A12-1) ─────────

  describe("E5 — Dispatcher cannot resolve EXCEPTION (admin-only guard)", () => {
    it("EXCEPTION → ASSIGNED blocked for DISPATCHER → 403", async () => {
      const { tripId } = await createExceptionTrip("EXCEPTION");
      setAuthSession(dispatcherScopedSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "ASSIGNED" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/only admins can resolve/i);
    });
  });

  // ─── E6: Dispatcher CANNOT resolve EXCEPTION → CANCELLED (G-A12-1) ────────

  describe("E6 — Dispatcher cannot resolve EXCEPTION → CANCELLED", () => {
    it("blocked → 403 (DISPATCHER has CANCELLED in permissions but admin-only guard fires first)", async () => {
      const { tripId } = await createExceptionTrip("EXCEPTION");
      setAuthSession(dispatcherScopedSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "CANCELLED", cancelReason: "Test cancellation" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/only admins can resolve/i);
    });
  });

  // ─── E7: Admin CAN resolve EXCEPTION → ASSIGNED ───────────────────────────

  describe("E7 — Admin resolves EXCEPTION → ASSIGNED", () => {
    it("returns 200, trip=ASSIGNED, load synced to ASSIGNED", async () => {
      const { tripId, loadId } = await createExceptionTrip("EXCEPTION");
      // Load must be in EXCEPTION too so sync is valid
      await db.load.update({
        where: { id: loadId },
        data: { status: "EXCEPTION" },
      });
      setAuthSession(adminSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "ASSIGNED" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("ASSIGNED");

      const load = await db.load.findUnique({ where: { id: loadId } });
      expect(load.status).toBe("ASSIGNED");
    });
  });

  // ─── E8: Admin resolves EXCEPTION → CANCELLED, refund fires if DEDUCTED ───

  describe("E8 — Admin resolves EXCEPTION → CANCELLED, refundServiceFee if DEDUCTED", () => {
    it("calls refundServiceFee when shipperFeeStatus=DEDUCTED", async () => {
      const { refundServiceFee } = require("@/lib/serviceFeeManagement");
      const { tripId, loadId } = await createExceptionTrip("EXCEPTION");
      await db.load.update({
        where: { id: loadId },
        data: { status: "EXCEPTION", shipperFeeStatus: "DEDUCTED" },
      });
      setAuthSession(adminSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "CANCELLED", cancelReason: "Test cancellation" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);

      // Load reverts to POSTED on CANCELLED (blueprint §7)
      const load = await db.load.findUnique({ where: { id: loadId } });
      expect(load.status).toBe("POSTED");

      // Refund fires because fees were DEDUCTED before exception was raised
      expect(refundServiceFee).toHaveBeenCalledWith(loadId);
    });

    it("does NOT call refundServiceFee when shipperFeeStatus=PENDING", async () => {
      const { refundServiceFee } = require("@/lib/serviceFeeManagement");
      const { tripId, loadId } = await createExceptionTrip("EXCEPTION");
      await db.load.update({
        where: { id: loadId },
        data: { status: "EXCEPTION", shipperFeeStatus: "PENDING" },
      });
      setAuthSession(adminSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "CANCELLED", cancelReason: "Test cancellation" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);
      expect(refundServiceFee).not.toHaveBeenCalled();
    });
  });

  // ─── E10/E11: Dispatcher exceptions ──────────────────────────────────────────

  describe("E11 — Dispatcher (org-scoped) cannot resolve EXCEPTION → ASSIGNED", () => {
    it("Blueprint §7: only ADMIN can resolve from EXCEPTION — DISPATCHER blocked even when org-scoped → 403", async () => {
      const { tripId } = await createExceptionTrip("EXCEPTION");
      setAuthSession(dispatcherScopedSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "ASSIGNED" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/only admins can resolve/i);
    });
  });

  // ─── E9: DISPATCHER notified when trip enters EXCEPTION (G-A12-3) ─────────

  describe("E9 — DISPATCHER notification on EXCEPTION", () => {
    it("createNotificationForRole called with role=DISPATCHER when trip enters EXCEPTION", async () => {
      const { tripId } = await createExceptionTrip("IN_TRANSIT");
      setAuthSession(carrierSession);
      const { createNotificationForRole } = require("@/lib/notifications");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "EXCEPTION" },
        }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);

      expect(createNotificationForRole).toHaveBeenCalledWith(
        expect.objectContaining({
          role: "DISPATCHER",
          type: "EXCEPTION_CREATED",
          title: "Trip Exception Raised",
        })
      );
    });

    it("does NOT call createNotificationForRole on non-EXCEPTION transitions", async () => {
      const { tripId } = await createExceptionTrip("ASSIGNED");
      setAuthSession(carrierSession);
      const { createNotificationForRole } = require("@/lib/notifications");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        {
          body: { status: "PICKUP_PENDING" },
        }
      );
      await callHandler(updateTrip, req, { tripId });

      expect(createNotificationForRole).not.toHaveBeenCalled();
    });
  });
});

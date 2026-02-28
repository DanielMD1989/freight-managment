/**
 * Carrier Trip Edge-Case Tests
 *
 * Tests trip state machine boundary conditions:
 * - Backward transitions (DELIVERED→IN_TRANSIT, etc.)
 * - Skip-state transitions (ASSIGNED→IN_TRANSIT, ASSIGNED→DELIVERED)
 * - Terminal states (COMPLETED→any, CANCELLED→any)
 * - POD gate (DELIVERED→COMPLETED requires POD)
 * - Truck availability restore on COMPLETED/CANCELLED
 * - Role restrictions (shipper cannot transition)
 * - Self-transitions (ASSIGNED→ASSIGNED)
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
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks
mockAuth();
mockCsrf();
// Override rateLimit to include withRpsLimit for GPS route
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
  RPS_CONFIGS: {
    marketplace: { endpoint: "loads", rps: 50, burst: 100 },
    fleet: { endpoint: "trucks", rps: 30, burst: 60 },
    dashboard: { endpoint: "dashboard", rps: 5, burst: 10 },
    gps: { endpoint: "gps", rps: 30, burst: 60 },
  },
  RATE_LIMIT_TRUCK_POSTING: { maxRequests: 100, windowMs: 86400000 },
}));
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
// Override RBAC with getAccessRoles returning proper shape
jest.mock("@/lib/rbac", () => ({
  requirePermission: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  requireRole: jest.fn(async (allowedRoles: string[]) => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    if (!allowedRoles.includes(session.role)) {
      const error = new Error("Forbidden: Insufficient permissions");
      (error as any).name = "ForbiddenError";
      throw error;
    }
    return session;
  }),
  requireAnyPermission: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  Permission: new Proxy({}, { get: (_target: any, prop: any) => String(prop) }),
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
  getCurrentUserRole: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    const session = getAuthSession();
    return session ? session.role : null;
  }),
  hasRole: jest.fn(async () => true),
  hasAnyRole: jest.fn(async () => true),
  hasPermission: jest.fn(async () => true),
  hasAnyPermission: jest.fn(async () => true),
  hasAllPermissions: jest.fn(async () => true),
  isAdmin: jest.fn(async () => false),
  isOps: jest.fn(async () => false),
  isSuperAdmin: jest.fn(async () => false),
  canManageOrganization: jest.fn(async () => true),
  getAccessRoles: jest.fn((session: any, opts: any) => {
    const isShipper = session.role === "SHIPPER";
    const isCarrier = session.role === "CARRIER";
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isDispatcher = session.role === "DISPATCHER";
    const hasAccess =
      isAdmin ||
      isDispatcher ||
      (isShipper && session.organizationId === opts.shipperOrgId) ||
      (isCarrier && session.organizationId === opts.carrierOrgId);
    return { isShipper, isCarrier, isAdmin, isDispatcher, hasAccess };
  }),
  canView: jest.fn(() => true),
  canModify: jest.fn(() => true),
  isAdminRole: jest.fn(() => false),
  isSuperAdminRole: jest.fn(() => false),
}));
mockApiErrors();
mockLogger();

// Use REAL trip state machine for edge-case testing
jest.mock("@/lib/tripStateMachine", () => ({
  ...jest.requireActual("@/lib/tripStateMachine"),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

jest.mock("@prisma/client", () => ({
  TripStatus: {
    ASSIGNED: "ASSIGNED",
    PICKUP_PENDING: "PICKUP_PENDING",
    IN_TRANSIT: "IN_TRANSIT",
    DELIVERED: "DELIVERED",
    COMPLETED: "COMPLETED",
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
  },
}));

// Import handlers AFTER mocks
const { PATCH: updateTrip } = require("@/app/api/trips/[tripId]/route");

describe("Carrier Trip Edge Cases", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  // Helper to create a trip at a given status
  async function createTripAtStatus(
    status: string,
    overrides: Record<string, any> = {}
  ) {
    const loadId =
      overrides.loadId ||
      `edge-load-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const tripId =
      overrides.tripId ||
      `edge-trip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    // Create a load for the trip
    await db.load.create({
      data: {
        id: loadId,
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Edge case test cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        podSubmitted: overrides.podSubmitted || false,
        podVerified: overrides.podVerified || false,
      },
    });

    // Create the trip
    const trip = await db.trip.create({
      data: {
        id: tripId,
        loadId,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status,
        ...overrides,
      },
    });

    return { tripId, loadId, trip };
  }

  // ─── Backward Transitions ──────────────────────────────────────────────

  describe("Backward transitions", () => {
    it("DELIVERED→IN_TRANSIT returns 400", async () => {
      const { tripId } = await createTripAtStatus("DELIVERED");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "IN_TRANSIT" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("Invalid status transition");
    });

    it("DELIVERED→PICKUP_PENDING returns 400", async () => {
      const { tripId } = await createTripAtStatus("DELIVERED");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "PICKUP_PENDING" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
    });

    it("DELIVERED→ASSIGNED returns 400", async () => {
      const { tripId } = await createTripAtStatus("DELIVERED");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "ASSIGNED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
    });

    it("IN_TRANSIT→PICKUP_PENDING returns 400", async () => {
      const { tripId } = await createTripAtStatus("IN_TRANSIT");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "PICKUP_PENDING" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
    });

    it("IN_TRANSIT→ASSIGNED returns 400", async () => {
      const { tripId } = await createTripAtStatus("IN_TRANSIT");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "ASSIGNED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
    });

    it("PICKUP_PENDING→ASSIGNED returns 400", async () => {
      const { tripId } = await createTripAtStatus("PICKUP_PENDING");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "ASSIGNED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
    });
  });

  // ─── Skip-State Transitions ────────────────────────────────────────────

  describe("Skip-state transitions", () => {
    it("ASSIGNED→IN_TRANSIT returns 400 (skips PICKUP_PENDING)", async () => {
      const { tripId } = await createTripAtStatus("ASSIGNED");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "IN_TRANSIT" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("Invalid status transition");
    });

    it("ASSIGNED→DELIVERED returns 400 (skips two states)", async () => {
      const { tripId } = await createTripAtStatus("ASSIGNED");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "DELIVERED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
    });
  });

  // ─── Terminal States ───────────────────────────────────────────────────

  describe("Terminal state transitions", () => {
    it("COMPLETED→any returns 400 (no transitions allowed)", async () => {
      const { tripId } = await createTripAtStatus("COMPLETED");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "ASSIGNED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("Invalid status transition");
    });

    it("CANCELLED→any returns 400 (no transitions allowed)", async () => {
      const { tripId } = await createTripAtStatus("CANCELLED");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "ASSIGNED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
    });
  });

  // ─── POD Gate ──────────────────────────────────────────────────────────

  describe("POD gate for COMPLETED", () => {
    it("DELIVERED→COMPLETED without POD returns 400", async () => {
      const { tripId } = await createTripAtStatus("DELIVERED", {
        podSubmitted: false,
        podVerified: false,
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "COMPLETED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
      const data = await parseResponse(res);
      expect(data.error).toContain("POD");
    });

    it("DELIVERED→COMPLETED with POD submitted and verified returns 200", async () => {
      const { tripId } = await createTripAtStatus("DELIVERED", {
        podSubmitted: true,
        podVerified: true,
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "COMPLETED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.trip.status).toBe("COMPLETED");
    });
  });

  // ─── Truck Availability Restore ────────────────────────────────────────

  describe("Truck availability restore", () => {
    it("restores truck availability after COMPLETED", async () => {
      // Set truck as unavailable
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: false },
      });

      const { tripId } = await createTripAtStatus("DELIVERED", {
        podSubmitted: true,
        podVerified: true,
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "COMPLETED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);

      // Check truck is now available
      const truck = await db.truck.findUnique({ where: { id: seed.truck.id } });
      expect(truck.isAvailable).toBe(true);
    });

    it("restores truck availability after CANCELLED from IN_TRANSIT", async () => {
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: false },
      });

      const { tripId } = await createTripAtStatus("IN_TRANSIT");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "CANCELLED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);

      const truck = await db.truck.findUnique({ where: { id: seed.truck.id } });
      expect(truck.isAvailable).toBe(true);
    });
  });

  // ─── Role Restrictions ─────────────────────────────────────────────────

  describe("Role restrictions", () => {
    it("shipper cannot transition trip → 403", async () => {
      const { tripId } = await createTripAtStatus("ASSIGNED");

      setAuthSession(shipperSession);
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "PICKUP_PENDING" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(403);
    });

    it("carrier can transition own trip → 200", async () => {
      const { tripId } = await createTripAtStatus("ASSIGNED");

      setAuthSession(carrierSession);
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "PICKUP_PENDING" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);
    });
  });

  // ─── Self-Transitions ─────────────────────────────────────────────────

  describe("Self-transitions", () => {
    it("ASSIGNED→ASSIGNED returns 400", async () => {
      const { tripId } = await createTripAtStatus("ASSIGNED");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "ASSIGNED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
    });

    it("IN_TRANSIT→IN_TRANSIT returns 400", async () => {
      const { tripId } = await createTripAtStatus("IN_TRANSIT");

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "IN_TRANSIT" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(400);
    });
  });
});

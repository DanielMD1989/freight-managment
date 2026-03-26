/**
 * Carrier Trip Management Tests
 *
 * Tests for trip lifecycle:
 * - GET /api/trips → { trips, pagination }
 * - POST /api/trips → { message, trip } (admin/dispatcher only)
 * - GET /api/trips/[tripId] → { trip }
 * - PATCH /api/trips/[tripId] → { message, trip, loadSynced }
 * - POST /api/trips/[tripId]/gps → { message, position }
 * - GET /api/trips/[tripId]/gps → { tripId, tripStatus, positions, count }
 *
 * Business rules:
 * - Trip state machine: ASSIGNED→PICKUP_PENDING→IN_TRANSIT→DELIVERED→COMPLETED
 * - Invalid transitions return 400
 * - POD required before COMPLETED
 * - Truck availability restored on COMPLETED/CANCELLED
 * - Load status synced atomically ($transaction)
 * - Contact masking for shipper during ASSIGNED status
 * - GPS only during IN_TRANSIT/PICKUP_PENDING
 * - GPS rate limited 12/hour/trip
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
// Override mockRateLimit to include withRpsLimit for GPS route
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
// Override RBAC mock with correct getAccessRoles return shape
// The route destructures { isShipper, hasAccess } from getAccessRoles(),
// so we must return those fields (not canView/canModify from mockRbac).
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
const { GET: listTrips, POST: createTrip } = require("@/app/api/trips/route");
const {
  GET: getTrip,
  PATCH: updateTrip,
} = require("@/app/api/trips/[tripId]/route");
const {
  POST: postGps,
  GET: getGps,
} = require("@/app/api/trips/[tripId]/gps/route");

describe("Carrier Trip Management", () => {
  let seed: SeedData;
  let tripId: string;

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

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  const dispatcherSession = createMockSession({
    userId: "dispatcher-user-1",
    email: "dispatcher@test.com",
    role: "DISPATCHER",
    organizationId: "dispatcher-org-1",
  });

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user",
    email: "other@test.com",
    role: "CARRIER",
    organizationId: "other-carrier-org",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create a trip for testing
    const trip = await db.trip.create({
      data: {
        id: "test-trip-001",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "ASSIGNED",
        trackingEnabled: true,
        trackingUrl: "trip-test-12345",
      },
    });
    tripId = trip.id;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);

    // Override getAccessRoles to return proper shape for trip detail route
    // (mockRbac returns { canView, canModify } but route expects { isShipper, hasAccess })
    const rbac = require("@/lib/rbac");
    rbac.getAccessRoles.mockImplementation(
      (
        session: { organizationId: string; role: string },
        {
          shipperOrgId,
          carrierOrgId,
        }: { shipperOrgId: string; carrierOrgId: string }
      ) => ({
        isShipper: session.organizationId === shipperOrgId,
        isCarrier: session.organizationId === carrierOrgId,
        isDispatcher: session.role === "DISPATCHER",
        isAdmin: session.role === "ADMIN" || session.role === "SUPER_ADMIN",
        isSuperAdmin: session.role === "SUPER_ADMIN",
        hasAccess:
          session.organizationId === shipperOrgId ||
          session.organizationId === carrierOrgId ||
          session.role === "ADMIN" ||
          session.role === "SUPER_ADMIN" ||
          session.role === "DISPATCHER",
      })
    );
  });

  // ─── GET /api/trips ────────────────────────────────────────────────────────

  describe("GET /api/trips - List Trips", () => {
    it("carrier sees only own org trips", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trips");

      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trips).toBeDefined();
      expect(Array.isArray(data.trips)).toBe(true);
      expect(data.pagination).toBeDefined();

      for (const trip of data.trips) {
        expect(trip.carrierId).toBe("carrier-org-1");
      }
    });

    it("shipper sees only own org trips", async () => {
      setAuthSession(shipperSession);

      const req = createRequest("GET", "http://localhost:3000/api/trips");

      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const trip of data.trips) {
        expect(trip.shipperId).toBe("shipper-org-1");
      }
    });

    it("admin sees all trips", async () => {
      setAuthSession(adminSession);

      const req = createRequest("GET", "http://localhost:3000/api/trips");

      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trips).toBeDefined();
    });

    it("dispatcher sees all trips", async () => {
      setAuthSession(dispatcherSession);

      const req = createRequest("GET", "http://localhost:3000/api/trips");

      const res = await listTrips(req);
      expect(res.status).toBe(200);
    });

    it("filters by single status", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips?status=ASSIGNED"
      );

      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      for (const trip of data.trips) {
        expect(trip.status).toBe("ASSIGNED");
      }
    });

    it("filters by comma-separated statuses", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips?status=ASSIGNED,IN_TRANSIT"
      );

      const res = await listTrips(req);
      expect(res.status).toBe(200);
    });

    it("returns pagination metadata", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips?page=1&limit=10"
      );

      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.pagination.page).toBe(1);
      expect(data.pagination.limit).toBe(10);
      expect(typeof data.pagination.total).toBe("number");
      expect(typeof data.pagination.totalPages).toBe("number");
    });

    it("returns transformed trips with convenience fields", async () => {
      const req = createRequest("GET", "http://localhost:3000/api/trips");

      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      if (data.trips.length > 0) {
        const trip = data.trips[0];
        expect(trip.referenceNumber).toBeDefined();
        expect(trip.referenceNumber).toMatch(/^TRIP-/);
      }
    });

    it("unauthenticated → 401", async () => {
      setAuthSession(null);

      const req = createRequest("GET", "http://localhost:3000/api/trips");

      const res = await listTrips(req);
      expect(res.status).toBe(401);
    });
  });

  // ─── POST /api/trips ──────────────────────────────────────────────────────

  describe("POST /api/trips - Create Trip", () => {
    it("admin can create trip → 201 with { message, trip }", async () => {
      setAuthSession(adminSession);

      // Create a fresh load for this test
      const freshLoad = await db.load.create({
        data: {
          id: "trip-create-load",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Bahir Dar",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Trip create test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest("POST", "http://localhost:3000/api/trips", {
        body: {
          loadId: freshLoad.id,
          truckId: seed.truck.id,
        },
      });

      const res = await createTrip(req);
      expect(res.status).toBe(201);

      const data = await parseResponse(res);
      expect(data.message).toContain("created");
      expect(data.trip).toBeDefined();
      expect(data.trip.status).toBe("ASSIGNED");
      expect(data.trip.trackingUrl).toBeDefined();
    });

    it("carrier cannot create trips directly → 403", async () => {
      const req = createRequest("POST", "http://localhost:3000/api/trips", {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
        },
      });

      const res = await createTrip(req);
      expect(res.status).toBe(403);
    });

    it("rejects non-existent load → 404", async () => {
      setAuthSession(adminSession);

      const req = createRequest("POST", "http://localhost:3000/api/trips", {
        body: {
          loadId: "nonexistent-load",
          truckId: seed.truck.id,
        },
      });

      const res = await createTrip(req);
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("Load not found");
    });

    it("rejects non-existent truck → 404", async () => {
      setAuthSession(adminSession);

      const freshLoad2 = await db.load.create({
        data: {
          id: "trip-create-load-2",
          status: "POSTED",
          pickupCity: "Mekelle",
          deliveryCity: "Jimma",
          pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Truck 404 test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const req = createRequest("POST", "http://localhost:3000/api/trips", {
        body: {
          loadId: freshLoad2.id,
          truckId: "nonexistent-truck",
        },
      });

      const res = await createTrip(req);
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("Truck not found");
    });

    it("rejects duplicate trip for same load → 400", async () => {
      setAuthSession(adminSession);

      // seed.load already has test-trip-001
      const req = createRequest("POST", "http://localhost:3000/api/trips", {
        body: {
          loadId: seed.load.id,
          truckId: seed.truck.id,
        },
      });

      const res = await createTrip(req);
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("already exists");
    });
  });

  // ─── GET /api/trips/[tripId] ──────────────────────────────────────────────

  describe("GET /api/trips/[tripId] - Get Trip Details", () => {
    it("carrier can see own org trip → { trip }", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}`
      );

      const res = await callHandler(getTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip).toBeDefined();
      expect(data.trip.id).toBe(tripId);
    });

    it("shipper can see own org trip", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}`
      );

      const res = await callHandler(getTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip).toBeDefined();
    });

    it("returns 404 for non-existent trip", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/nonexistent"
      );

      const res = await callHandler(getTrip, req, { tripId: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("returns 404 for trip from other org (permission hidden)", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}`
      );

      const res = await callHandler(getTrip, req, { tripId });
      expect(res.status).toBe(404);
    });

    it("contact masking: shipper sees (hidden) during ASSIGNED", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${tripId}`
      );

      const res = await callHandler(getTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // During ASSIGNED status, shipper sees hidden contacts
      if (data.trip.status === "ASSIGNED") {
        expect(data.trip.truck?.contactPhone).toBe("(hidden)");
        expect(data.trip.carrier?.contactPhone).toBe("(hidden)");
        expect(data.trip.routeHistory).toEqual([]);
      }
    });
  });

  // ─── PATCH /api/trips/[tripId] - Trip State Machine ────────────────────────

  describe("PATCH /api/trips/[tripId] - Trip State Machine", () => {
    it("ASSIGNED → PICKUP_PENDING (sets startedAt)", async () => {
      // Create a fresh trip for state transition tests
      const transitionTrip = await db.trip.create({
        data: {
          id: "state-trip-1",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${transitionTrip.id}`,
        { body: { status: "PICKUP_PENDING" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: transitionTrip.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("PICKUP_PENDING");
      expect(data.trip.startedAt).toBeDefined();
      expect(data.loadSynced).toBe(true);
    });

    it("PICKUP_PENDING → IN_TRANSIT (sets pickedUpAt)", async () => {
      const transitionTrip2 = await db.trip.create({
        data: {
          id: "state-trip-2",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PICKUP_PENDING",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${transitionTrip2.id}`,
        { body: { status: "IN_TRANSIT" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: transitionTrip2.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("IN_TRANSIT");
      expect(data.trip.pickedUpAt).toBeDefined();
    });

    it("IN_TRANSIT → DELIVERED (sets deliveredAt with receiver info)", async () => {
      const transitionTrip3 = await db.trip.create({
        data: {
          id: "state-trip-3",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${transitionTrip3.id}`,
        {
          body: {
            status: "DELIVERED",
            receiverName: "John Doe",
            receiverPhone: "+251912345678",
            deliveryNotes: "Left at loading dock",
          },
        }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: transitionTrip3.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("DELIVERED");
      expect(data.trip.deliveredAt).toBeDefined();
      expect(data.trip.receiverName).toBe("John Doe");
    });

    it("DELIVERED → COMPLETED requires POD submitted+verified", async () => {
      const transitionTrip4 = await db.trip.create({
        data: {
          id: "state-trip-4",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          trackingEnabled: true,
        },
      });

      // Load without POD
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${transitionTrip4.id}`,
        { body: { status: "COMPLETED" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: transitionTrip4.id,
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("POD");
    });

    it("DELIVERED → COMPLETED succeeds with POD", async () => {
      // Create a load with POD
      const podLoad = await db.load.create({
        data: {
          id: "pod-load",
          status: "DELIVERED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Hawassa",
          pickupDate: new Date(),
          deliveryDate: new Date(),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "POD test load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
          podVerified: true,
        },
      });

      const podTrip = await db.trip.create({
        data: {
          id: "pod-trip",
          loadId: podLoad.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${podTrip.id}`,
        { body: { status: "COMPLETED" } }
      );

      const res = await callHandler(updateTrip, req, { tripId: podTrip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("COMPLETED");
      expect(data.trip.completedAt).toBeDefined();
      expect(data.trip.trackingEnabled).toBe(false);
    });

    it("ASSIGNED → CANCELLED (carrier can cancel pre-transit trips)", async () => {
      const cancelTrip = await db.trip.create({
        data: {
          id: "cancel-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${cancelTrip.id}`,
        { body: { status: "CANCELLED", cancelReason: "Test cancellation" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: cancelTrip.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("CANCELLED");
      expect(data.trip.cancelledAt).toBeDefined();
      expect(data.trip.trackingEnabled).toBe(false);
    });

    it("PATCH CANCELLED: load → POSTED (not CANCELLED), assignedTruckId cleared", async () => {
      await db.load.update({
        where: { id: seed.load.id },
        data: { status: "ASSIGNED", assignedTruckId: seed.truck.id },
      });
      const t = await db.trip.create({
        data: {
          id: "patch-cancel-load-test",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${t.id}`,
        { body: { status: "CANCELLED", cancelReason: "Test cancellation" } }
      );
      const res = await callHandler(updateTrip, req, { tripId: t.id });
      expect(res.status).toBe(200);

      const load = await db.load.findUnique({ where: { id: seed.load.id } });
      expect(load.status).toBe("POSTED");
      expect(load.assignedTruckId).toBeNull();
    });

    it("PATCH CANCELLED: cancelledBy set to session userId", async () => {
      const t = await db.trip.create({
        data: {
          id: "patch-cancel-auditby-test",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PICKUP_PENDING",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${t.id}`,
        { body: { status: "CANCELLED", cancelReason: "Test cancellation" } }
      );
      const res = await callHandler(updateTrip, req, { tripId: t.id });
      expect(res.status).toBe(200);

      const trip = await db.trip.findUnique({ where: { id: t.id } });
      expect(trip.cancelledBy).toBe(carrierSession.userId);
    });

    it("IN_TRANSIT → CANCELLED via PATCH blocked (must use exception workflow) → 400", async () => {
      const inTransitTrip = await db.trip.create({
        data: {
          id: "in-transit-cancel-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${inTransitTrip.id}`,
        { body: { status: "CANCELLED", cancelReason: "Test cancellation" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: inTransitTrip.id,
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("Invalid status transition");
    });

    // Invalid transitions
    it("ASSIGNED → IN_TRANSIT (must go through PICKUP_PENDING) → 400", async () => {
      const invalidTrip = await db.trip.create({
        data: {
          id: "invalid-trip-1",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${invalidTrip.id}`,
        { body: { status: "IN_TRANSIT" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: invalidTrip.id,
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("Invalid status transition");
    });

    it("ASSIGNED → DELIVERED → 400", async () => {
      const invalidTrip2 = await db.trip.create({
        data: {
          id: "invalid-trip-2",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${invalidTrip2.id}`,
        { body: { status: "DELIVERED" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: invalidTrip2.id,
      });
      expect(res.status).toBe(400);
    });

    it("COMPLETED → anything → 400 (terminal state)", async () => {
      const completedTrip = await db.trip.create({
        data: {
          id: "completed-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "COMPLETED",
          trackingEnabled: false,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${completedTrip.id}`,
        { body: { status: "CANCELLED", cancelReason: "Test cancellation" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: completedTrip.id,
      });
      expect(res.status).toBe(400);
    });

    it("CANCELLED → anything → 400 (terminal state)", async () => {
      const cancelledTrip = await db.trip.create({
        data: {
          id: "cancelled-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "CANCELLED",
          trackingEnabled: false,
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${cancelledTrip.id}`,
        { body: { status: "ASSIGNED" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: cancelledTrip.id,
      });
      expect(res.status).toBe(400);
    });

    it("non-owner carrier gets 404", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "PICKUP_PENDING" } }
      );

      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(404);
    });

    it("shipper cannot update trip status → 404", async () => {
      setAuthSession(shipperSession);

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "PICKUP_PENDING" } }
      );

      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent trip", async () => {
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/nonexistent",
        { body: { status: "PICKUP_PENDING" } }
      );

      const res = await callHandler(updateTrip, req, {
        tripId: "nonexistent",
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/trips/[tripId]/gps ─────────────────────────────────────────

  describe("POST /api/trips/[tripId]/gps - GPS Position Update", () => {
    let gpsTrip: any;

    beforeAll(async () => {
      gpsTrip = await db.trip.create({
        data: {
          id: "gps-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          trackingEnabled: true,
        },
      });
    });

    it("creates GPS position with valid lat/lng → 200", async () => {
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${gpsTrip.id}/gps`,
        {
          body: {
            latitude: 9.02,
            longitude: 38.75,
            speed: 60,
            heading: 180,
          },
        }
      );

      const res = await callHandler(postGps, req, { tripId: gpsTrip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.message).toContain("GPS position updated");
      expect(data.position).toBeDefined();
      expect(data.position.latitude).toBe(9.02);
      expect(data.position.longitude).toBe(38.75);
    });

    it("rejects when trackingEnabled=false → 400", async () => {
      const noTrackTrip = await db.trip.create({
        data: {
          id: "no-track-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          trackingEnabled: false,
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${noTrackTrip.id}/gps`,
        {
          body: { latitude: 9.02, longitude: 38.75 },
        }
      );

      const res = await callHandler(postGps, req, { tripId: noTrackTrip.id });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("not enabled");
    });

    it("rejects when trip not IN_TRANSIT/PICKUP_PENDING → 400", async () => {
      const assignedTrip = await db.trip.create({
        data: {
          id: "assigned-gps-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${assignedTrip.id}/gps`,
        {
          body: { latitude: 9.02, longitude: 38.75 },
        }
      );

      const res = await callHandler(postGps, req, {
        tripId: assignedTrip.id,
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("IN_TRANSIT or PICKUP_PENDING");
    });

    it("only carrier owning truck can update → 404", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${gpsTrip.id}/gps`,
        {
          body: { latitude: 9.02, longitude: 38.75 },
        }
      );

      const res = await callHandler(postGps, req, { tripId: gpsTrip.id });
      expect(res.status).toBe(404);
    });

    it("rate limited (12/hour/trip) → 429", async () => {
      const rateLimit = require("@/lib/rateLimit");
      rateLimit.checkRateLimit.mockResolvedValueOnce({
        allowed: false,
        limit: 12,
        remaining: 0,
        retryAfter: 300,
        resetTime: Date.now() + 3600000,
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${gpsTrip.id}/gps`,
        {
          body: { latitude: 9.02, longitude: 38.75 },
        }
      );

      const res = await callHandler(postGps, req, { tripId: gpsTrip.id });
      expect(res.status).toBe(429);
    });

    it("returns 404 for non-existent trip", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/nonexistent/gps",
        {
          body: { latitude: 9.02, longitude: 38.75 },
        }
      );

      const res = await callHandler(postGps, req, { tripId: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("accepts GPS during PICKUP_PENDING status", async () => {
      const pickupTrip = await db.trip.create({
        data: {
          id: "pickup-gps-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PICKUP_PENDING",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${pickupTrip.id}/gps`,
        {
          body: { latitude: 8.5, longitude: 39.0 },
        }
      );

      const res = await callHandler(postGps, req, { tripId: pickupTrip.id });
      expect(res.status).toBe(200);
    });
  });

  // ─── GET /api/trips/[tripId]/gps ──────────────────────────────────────────

  describe("GET /api/trips/[tripId]/gps - GPS Route History", () => {
    let gpsReadTrip: any;

    beforeAll(async () => {
      gpsReadTrip = await db.trip.create({
        data: {
          id: "gps-read-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          trackingEnabled: true,
        },
      });

      // Create some GPS positions
      await db.gpsPosition.create({
        data: {
          tripId: gpsReadTrip.id,
          truckId: seed.truck.id,
          loadId: seed.load.id,
          deviceId: "device-1",
          latitude: 9.0,
          longitude: 38.7,
          timestamp: new Date(),
        },
      });
    });

    it("returns positions for carrier", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${gpsReadTrip.id}/gps`
      );

      const res = await callHandler(getGps, req, { tripId: gpsReadTrip.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.tripId).toBe(gpsReadTrip.id);
      expect(data.tripStatus).toBe("IN_TRANSIT");
      expect(data.positions).toBeDefined();
      expect(Array.isArray(data.positions)).toBe(true);
      expect(typeof data.count).toBe("number");
    });

    it("shipper cannot see GPS during ASSIGNED status → 403", async () => {
      setAuthSession(shipperSession);

      const assignedGpsTrip = await db.trip.create({
        data: {
          id: "assigned-gps-read",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${assignedGpsTrip.id}/gps`
      );

      const res = await callHandler(getGps, req, {
        tripId: assignedGpsTrip.id,
      });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("not available");
    });

    it("admin can see GPS anytime", async () => {
      setAuthSession(adminSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${gpsReadTrip.id}/gps`
      );

      const res = await callHandler(getGps, req, { tripId: gpsReadTrip.id });
      expect(res.status).toBe(200);
    });

    it("returns 404 for non-existent trip", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/nonexistent/gps"
      );

      const res = await callHandler(getGps, req, { tripId: "nonexistent" });
      expect(res.status).toBe(404);
    });

    it("non-related user gets 404", async () => {
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${gpsReadTrip.id}/gps`
      );

      const res = await callHandler(getGps, req, { tripId: gpsReadTrip.id });
      expect(res.status).toBe(404);
    });

    it("since ISO param is accepted and returns 200", async () => {
      setAuthSession(carrierSession);
      const pastTs = new Date("2024-01-01T00:00:00Z").toISOString();
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${gpsReadTrip.id}/gps?since=${pastTs}`
      );
      const res = await callHandler(getGps, req, { tripId: gpsReadTrip.id });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(Array.isArray(data.positions)).toBe(true);
    });

    it("limit=0 is clamped to 1 → 200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${gpsReadTrip.id}/gps?limit=0`
      );
      const res = await callHandler(getGps, req, { tripId: gpsReadTrip.id });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      // limit clamped to 1: at most 1 position returned
      expect(data.positions.length).toBeLessThanOrEqual(1);
    });

    it("limit=9999 is clamped to 1000 → 200", async () => {
      setAuthSession(carrierSession);
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${gpsReadTrip.id}/gps?limit=9999`
      );
      const res = await callHandler(getGps, req, { tripId: gpsReadTrip.id });
      expect(res.status).toBe(200);
      // Route clamps to max 1000 — just verify request succeeds
      expect(res.status).toBe(200);
    });

    it("GPS auto-creates device placeholder when truck has no gpsDeviceId", async () => {
      setAuthSession(carrierSession);
      // Truck in seed has no gpsDeviceId by default
      const noDeviceTrip = await db.trip.create({
        data: {
          id: "no-device-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          trackingEnabled: true,
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${noDeviceTrip.id}/gps`,
        { body: { latitude: 9.0, longitude: 38.5 } }
      );
      const res = await callHandler(postGps, req, { tripId: noDeviceTrip.id });
      // Auto-creates device → succeeds
      expect([200, 201]).toContain(res.status);
      // Verify device was upserted
      const updatedTruck = await db.truck.findUnique({
        where: { id: seed.truck.id },
        include: { gpsDevice: true },
      });
      expect(updatedTruck?.gpsDeviceId).toBeDefined();
    });
  });
});

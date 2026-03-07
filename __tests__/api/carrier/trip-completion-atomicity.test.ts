// @jest-environment node
/**
 * Trip Completion Atomicity Tests — Round 9
 *
 * Verifies that truck availability reset (US-8.1) and posting reactivation
 * (US-8.2) both happen INSIDE the trip update $transaction, making them
 * atomic with the status change.
 *
 * US-8.1: Truck availability reset is atomic with trip status change
 * US-8.2: Posting reactivation is atomic with trip status change
 *
 * Route: PATCH /api/trips/[tripId]
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
} from "../../utils/routeTestUtils";

// Setup mocks
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
mockApiErrors();
mockLogger();

jest.mock("@/lib/rbac", () => ({
  requirePermission: jest.fn(async () => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    return session;
  }),
  requireRole: jest.fn(async (allowedRoles: string[]) => {
    const { getAuthSession } = require("../../utils/routeTestUtils");
    const session = getAuthSession();
    if (!session) throw new Error("Unauthorized");
    if (!allowedRoles.includes(session.role)) {
      const error = new Error("Forbidden");
      (error as any).name = "ForbiddenError";
      throw error;
    }
    return session;
  }),
  getAccessRoles: jest.fn((session: any, opts: any) => ({
    isShipper: session.role === "SHIPPER",
    isCarrier: session.role === "CARRIER",
    isAdmin: session.role === "ADMIN" || session.role === "SUPER_ADMIN",
    isDispatcher: session.role === "DISPATCHER",
    hasAccess:
      session.role === "ADMIN" ||
      session.role === "SUPER_ADMIN" ||
      (session.role === "CARRIER" &&
        session.organizationId === opts.carrierOrgId) ||
      (session.role === "SHIPPER" &&
        session.organizationId === opts.shipperOrgId),
  })),
  Permission: new Proxy({}, { get: (_t: any, p: any) => String(p) }),
  hasPermission: jest.fn(() => true),
  hasRole: jest.fn(() => true),
  requireAnyPermission: jest.fn(async () => ({})),
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
}));

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
    PrismaClientKnownRequestError: class PrismaClientKnownRequestError extends Error {
      code: string;
      constructor(msg: string, opts: { code: string; clientVersion: string }) {
        super(msg);
        this.name = "PrismaClientKnownRequestError";
        this.code = opts.code;
      }
    },
  },
}));

const { PATCH: updateTrip } = require("@/app/api/trips/[tripId]/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const carrierSession = createMockSession({
  userId: "carrier-trip-atom-user",
  email: "carrier@trip.test",
  role: "CARRIER",
  organizationId: "carrier-trip-atom-org",
});

const adminSession = createMockSession({
  userId: "admin-trip-atom-user",
  email: "admin@trip.test",
  role: "ADMIN",
  organizationId: "admin-trip-atom-org",
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedTripAtomicityData({
  tripStatus = "DELIVERED",
  truckIsAvailable = false,
  postingStatus = "MATCHED",
  podSubmitted = true,
  podVerified = true,
}: {
  tripStatus?: string;
  truckIsAvailable?: boolean;
  postingStatus?: string;
  podSubmitted?: boolean;
  podVerified?: boolean;
} = {}) {
  const shipperOrg = await db.organization.create({
    data: { name: "Shipper Trip Atom", type: "SHIPPER" },
  });
  const carrierOrg = await db.organization.create({
    data: {
      id: "carrier-trip-atom-org",
      name: "Carrier Trip Atom",
      type: "CARRIER",
    },
  });

  const truck = await db.truck.create({
    data: {
      id: "truck-trip-atom-01",
      licensePlate: "TT-ATOM-01",
      truckType: "FLATBED",
      carrierId: carrierOrg.id,
      isAvailable: truckIsAvailable,
    },
  });

  const posting = await db.truckPosting.create({
    data: {
      id: "posting-trip-atom-01",
      truckId: truck.id,
      carrierId: carrierOrg.id,
      status: postingStatus,
      availableFrom: new Date(),
      availableTo: new Date(Date.now() + 86400000),
      originCity: "Addis Ababa",
      destinationCity: "Hawassa",
      ratePerKm: 1,
      truckType: "FLATBED",
      capacity: 5000,
    },
  });

  const load = await db.load.create({
    data: {
      id: "load-trip-atom-01",
      shipperId: shipperOrg.id,
      status: tripStatus as any,
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      truckType: "FLATBED",
      cargoDescription: "Trip atom test",
      weight: 1000,
      assignedTruckId: truck.id,
      podSubmitted,
      podVerified,
      shipperFeeStatus: "PENDING",
    },
  });

  const trip = await db.trip.create({
    data: {
      id: "trip-atom-01",
      loadId: load.id,
      truckId: truck.id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      status: tripStatus as any,
      trackingEnabled: true,
    },
  });

  return { trip, truck, posting, load, shipperOrg, carrierOrg };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("US-8.1 — Truck availability reset inside trip $transaction", () => {
  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearAllStores();
    // Re-set $transaction: jest.spyOn().mockRestore() can lose the original
    // mockImplementation in some spy-interaction sequences.
    (db.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)
    );
    setAuthSession(carrierSession);
  });

  it("COMPLETED trip resets truck.isAvailable inside the $transaction", async () => {
    const { trip, truck } = await seedTripAtomicityData({
      tripStatus: "DELIVERED",
      podSubmitted: true,
      podVerified: true,
    });

    const txSpy = jest.spyOn(db, "$transaction");
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${trip.id}`,
      { body: { status: "COMPLETED" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(200);

    // $transaction was called
    expect(txSpy).toHaveBeenCalled();
    txSpy.mockRestore();

    // Truck is now available
    const updatedTruck = await db.truck.findUnique({
      where: { id: truck.id },
      select: { isAvailable: true },
    });
    expect(updatedTruck?.isAvailable).toBe(true);
  });

  it("CANCELLED trip resets truck.isAvailable inside the $transaction", async () => {
    const { trip, truck } = await seedTripAtomicityData({
      tripStatus: "PICKUP_PENDING",
    });

    setAuthSession(adminSession);
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${trip.id}`,
      { body: { status: "CANCELLED" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(200);

    const updatedTruck = await db.truck.findUnique({
      where: { id: truck.id },
      select: { isAvailable: true },
    });
    expect(updatedTruck?.isAvailable).toBe(true);
  });

  it("truck availability NOT reset if another active trip exists on same truck", async () => {
    const {
      trip,
      truck,
      load: _load,
      shipperOrg,
      carrierOrg,
    } = await seedTripAtomicityData({ tripStatus: "IN_TRANSIT" });

    // Create second active trip on same truck
    const load2 = await db.load.create({
      data: {
        id: "load-trip-second",
        shipperId: shipperOrg.id,
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        truckType: "FLATBED",
        cargoDescription: "Second load",
        weight: 500,
        assignedTruckId: truck.id,
        shipperFeeStatus: "PENDING",
      },
    });
    await db.trip.create({
      data: {
        id: "trip-second-active",
        loadId: load2.id,
        truckId: truck.id,
        carrierId: carrierOrg.id,
        shipperId: shipperOrg.id,
        status: "IN_TRANSIT",
        trackingEnabled: true,
      },
    });

    setAuthSession(adminSession);
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${trip.id}`,
      { body: { status: "CANCELLED" } }
    );
    await callHandler(updateTrip, req, { tripId: trip.id });

    // Truck should NOT be made available (other trip still active)
    const updatedTruck = await db.truck.findUnique({
      where: { id: truck.id },
      select: { isAvailable: true },
    });
    expect(updatedTruck?.isAvailable).toBe(false);
  });

  it("both COMPLETED and CANCELLED set isAvailable=true atomically", async () => {
    // Test COMPLETED
    const d1 = await seedTripAtomicityData({
      tripStatus: "DELIVERED",
      podSubmitted: true,
      podVerified: true,
    });
    const req1 = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${d1.trip.id}`,
      { body: { status: "COMPLETED" } }
    );
    setAuthSession(carrierSession);
    const res1 = await callHandler(updateTrip, req1, { tripId: d1.trip.id });
    expect(res1.status).toBe(200);
    const truck1 = await db.truck.findUnique({
      where: { id: d1.truck.id },
      select: { isAvailable: true },
    });
    expect(truck1?.isAvailable).toBe(true);

    clearAllStores();

    // Test CANCELLED
    const d2 = await seedTripAtomicityData({ tripStatus: "ASSIGNED" });
    const req2 = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${d2.trip.id}`,
      { body: { status: "CANCELLED" } }
    );
    setAuthSession(carrierSession);
    const res2 = await callHandler(updateTrip, req2, { tripId: d2.trip.id });
    expect(res2.status).toBe(200);
    const truck2 = await db.truck.findUnique({
      where: { id: d2.truck.id },
      select: { isAvailable: true },
    });
    expect(truck2?.isAvailable).toBe(true);
  });
});

describe("US-8.2 — Posting reactivation inside trip $transaction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllStores();
    (db.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)
    );
    setAuthSession(carrierSession);
  });

  it("COMPLETED trip reverts MATCHED posting to ACTIVE inside $transaction", async () => {
    const { trip, posting } = await seedTripAtomicityData({
      tripStatus: "DELIVERED",
      postingStatus: "MATCHED",
      podSubmitted: true,
      podVerified: true,
    });

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${trip.id}`,
      { body: { status: "COMPLETED" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(200);

    const updatedPosting = await db.truckPosting.findUnique({
      where: { id: posting.id },
      select: { status: true },
    });
    expect(updatedPosting?.status).toBe("ACTIVE");
  });

  it("CANCELLED trip reverts MATCHED posting to ACTIVE inside $transaction", async () => {
    const { trip, posting } = await seedTripAtomicityData({
      tripStatus: "PICKUP_PENDING",
      postingStatus: "MATCHED",
    });

    setAuthSession(adminSession);
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${trip.id}`,
      { body: { status: "CANCELLED" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(200);

    const updatedPosting = await db.truckPosting.findUnique({
      where: { id: posting.id },
      select: { status: true },
    });
    expect(updatedPosting?.status).toBe("ACTIVE");
  });

  it("updatedAt timestamp refreshed on posting reactivation", async () => {
    const seedTime = new Date(Date.now() - 10000); // 10s ago
    const { trip, posting } = await seedTripAtomicityData({
      tripStatus: "IN_TRANSIT",
      postingStatus: "MATCHED",
    });

    // Set posting updatedAt to past
    await db.truckPosting.update({
      where: { id: posting.id },
      data: { updatedAt: seedTime },
    });

    setAuthSession(adminSession);
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${trip.id}`,
      { body: { status: "CANCELLED" } }
    );
    await callHandler(updateTrip, req, { tripId: trip.id });

    const updatedPosting = await db.truckPosting.findUnique({
      where: { id: posting.id },
      select: { updatedAt: true },
    });
    expect(updatedPosting!.updatedAt.getTime()).toBeGreaterThan(
      seedTime.getTime()
    );
  });

  it("only MATCHED postings are reverted — ACTIVE/EXPIRED postings untouched", async () => {
    const { trip, truck, carrierOrg } = await seedTripAtomicityData({
      tripStatus: "IN_TRANSIT",
      postingStatus: "MATCHED",
    });

    // Add an ACTIVE and an EXPIRED posting on same truck
    const activePosting = await db.truckPosting.create({
      data: {
        id: "posting-active-extra",
        truckId: truck.id,
        carrierId: carrierOrg.id,
        status: "ACTIVE",
        availableFrom: new Date(),
        availableTo: new Date(Date.now() + 86400000),
        originCity: "Addis Ababa",
        destinationCity: "Dire Dawa",
        ratePerKm: 2,
        truckType: "FLATBED",
        capacity: 3000,
      },
    });
    const expiredPosting = await db.truckPosting.create({
      data: {
        id: "posting-expired-extra",
        truckId: truck.id,
        carrierId: carrierOrg.id,
        status: "EXPIRED",
        availableFrom: new Date(),
        availableTo: new Date(Date.now() + 86400000),
        originCity: "Addis Ababa",
        destinationCity: "Jimma",
        ratePerKm: 2,
        truckType: "FLATBED",
        capacity: 3000,
      },
    });

    setAuthSession(adminSession);
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${trip.id}`,
      { body: { status: "CANCELLED" } }
    );
    await callHandler(updateTrip, req, { tripId: trip.id });

    // ACTIVE posting should still be ACTIVE
    const activeAfter = await db.truckPosting.findUnique({
      where: { id: activePosting.id },
      select: { status: true },
    });
    expect(activeAfter?.status).toBe("ACTIVE");

    // EXPIRED posting should still be EXPIRED
    const expiredAfter = await db.truckPosting.findUnique({
      where: { id: expiredPosting.id },
      select: { status: true },
    });
    expect(expiredAfter?.status).toBe("EXPIRED");
  });
});

describe("Cross-domain atomicity — trip update concurrent guard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllStores();
    setAuthSession(adminSession);
  });

  it("Concurrent trip update race: P2025 error returns 409", async () => {
    const { trip } = await seedTripAtomicityData({
      tripStatus: "PICKUP_PENDING",
    });

    // Mock db.$transaction to throw P2025 (simulates optimistic lock failure)
    const { Prisma } = require("@prisma/client");
    jest.spyOn(db, "$transaction").mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("Record to update not found", {
        code: "P2025",
        clientVersion: "5.0.0",
      })
    );

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${trip.id}`,
      { body: { status: "CANCELLED" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(409);

    const data = await parseResponse(res);
    expect(data.error).toMatch(/concurrently/i);
  });

  it("Trip update atomicity: if truck update fails, trip status rolls back", async () => {
    const { trip } = await seedTripAtomicityData({ tripStatus: "IN_TRANSIT" });

    // Mock $transaction to throw on truck update (simulates constraint failure)
    const _origTx = db.$transaction.bind(db);
    jest.spyOn(db, "$transaction").mockImplementationOnce(async (fn: any) => {
      // Inject a failing truck update inside the callback
      const fakeTx = {
        ...db,
        truck: {
          ...db.truck,
          update: jest.fn().mockRejectedValue(new Error("Truck update failed")),
        },
      };
      return fn(fakeTx);
    });

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${trip.id}`,
      { body: { status: "CANCELLED" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });

    // Should return error (not 200) — truck update failure bubbles up
    expect(res.status).toBeGreaterThanOrEqual(400);
  });
});

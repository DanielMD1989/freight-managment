// @jest-environment node
/**
 * POD Completion Tests — Round A14
 *
 * Tests:
 * PC1 - PATCH /trips/[tripId] COMPLETED, pod submitted → deductServiceFee called
 * PC2 - PATCH /trips/[tripId] COMPLETED → load.settlementStatus=PAID
 * PC3 - PATCH /trips/[tripId] COMPLETED, no other trips → truck.isAvailable=true
 * PC4 - PATCH /trips/[tripId] COMPLETED, other active trip → truck stays false
 * PC5 - PATCH /trips/[tripId] COMPLETED, fee fails → 400
 * PC6 - PATCH /trips/[tripId] COMPLETED → createNotification called for shipper (DELIVERY_CONFIRMED)
 * PC7 - PUT /loads/[id]/pod (shipper verify) → trip.status becomes COMPLETED
 * PC8 - PUT /loads/[id]/pod (shipper verify) → truck.isAvailable=true
 * PC9 - PUT /loads/[id]/pod (shipper verify) → MATCHED posting → ACTIVE
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

// All mocks BEFORE require()
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

// Controllable deductServiceFee mock
const mockDeductFee = jest.fn(async () => ({
  success: true,
  serviceFee: 150,
  shipperFee: 100,
  carrierFee: 50,
  totalPlatformFee: 150,
  platformRevenue: 150,
  transactionId: "txn-pod-test",
  details: {
    shipper: { fee: 100, status: "DEDUCTED" },
    carrier: { fee: 50, status: "DEDUCTED" },
  },
}));

jest.mock("@/lib/serviceFeeManagement", () => ({
  validateWalletBalancesForTrip: jest.fn(async () => ({
    valid: true,
    shipperFee: "100.00",
    carrierFee: "50.00",
    errors: [],
  })),
  deductServiceFees: jest.fn(async () => ({ success: true })),
  deductServiceFee: (...args: unknown[]) => mockDeductFee(...args),
  refundServiceFee: jest.fn(async () => ({
    success: true,
    serviceFee: 150,
    shipperBalance: 900,
    carrierBalance: 450,
  })),
}));

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
        session.organizationId === opts?.carrierOrgId) ||
      (session.role === "SHIPPER" &&
        session.organizationId === opts?.shipperOrgId),
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
const { PUT: verifyPod } = require("@/app/api/loads/[id]/pod/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

const carrierSession = createMockSession({
  userId: "carrier-pod-comp-user",
  email: "carrier@pod.test",
  role: "CARRIER",
  organizationId: "carrier-pod-comp-org",
});

const shipperSession = createMockSession({
  userId: "shipper-pod-comp-user",
  email: "shipper@pod.test",
  role: "SHIPPER",
  organizationId: "shipper-pod-comp-org",
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedPodCompletionData({
  tripStatus = "DELIVERED",
  truckIsAvailable = false,
  postingStatus = "MATCHED",
  podSubmitted = true,
  shipperFeeStatus = "PENDING",
}: {
  tripStatus?: string;
  truckIsAvailable?: boolean;
  postingStatus?: string;
  podSubmitted?: boolean;
  shipperFeeStatus?: string;
} = {}) {
  const shipperOrg = await db.organization.create({
    data: {
      id: "shipper-pod-comp-org",
      name: "Shipper POD Comp",
      type: "SHIPPER",
    },
  });
  const shipperUser = await db.user.create({
    data: {
      id: "shipper-pod-comp-user",
      email: "shipper@pod.test",
      name: "Shipper POD User",
      role: "SHIPPER",
      organizationId: shipperOrg.id,
      status: "ACTIVE",
    },
  });
  const carrierOrg = await db.organization.create({
    data: {
      id: "carrier-pod-comp-org",
      name: "Carrier POD Comp",
      type: "CARRIER",
    },
  });
  const truck = await db.truck.create({
    data: {
      id: "truck-pod-comp-01",
      licensePlate: "PC-COMP-01",
      truckType: "FLATBED",
      carrierId: carrierOrg.id,
      isAvailable: truckIsAvailable,
    },
  });
  const posting = await db.truckPosting.create({
    data: {
      id: "posting-pod-comp-01",
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
      id: "load-pod-comp-01",
      shipperId: shipperOrg.id,
      status: tripStatus as any,
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      truckType: "FLATBED",
      cargoDescription: "POD comp test",
      weight: 1000,
      assignedTruckId: truck.id,
      podSubmitted,
      shipperFeeStatus: shipperFeeStatus as any,
    },
  });
  const trip = await db.trip.create({
    data: {
      id: "trip-pod-comp-01",
      loadId: load.id,
      truckId: truck.id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
      status: tripStatus as any,
      trackingEnabled: true,
    },
  });

  return { trip, truck, posting, load, shipperOrg, carrierOrg, shipperUser };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PC1–PC6 — PATCH /trips/[tripId] COMPLETED (carrier-initiated)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllStores();
    (db.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)
    );
    setAuthSession(carrierSession);
  });

  afterAll(() => {
    clearAllStores();
  });

  it("PC1 — COMPLETED → deductServiceFee called once", async () => {
    const { trip } = await seedPodCompletionData({ podSubmitted: true });

    const req = createRequest(
      "PATCH",
      `http://localhost/api/trips/${trip.id}`,
      {
        body: { status: "COMPLETED" },
      }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(200);
    expect(mockDeductFee).toHaveBeenCalledTimes(1);
    expect(mockDeductFee).toHaveBeenCalledWith(trip.loadId);
  });

  it("PC2 — COMPLETED → load.settlementStatus=PAID", async () => {
    const { trip, load } = await seedPodCompletionData({ podSubmitted: true });

    const req = createRequest(
      "PATCH",
      `http://localhost/api/trips/${trip.id}`,
      {
        body: { status: "COMPLETED" },
      }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(200);

    const updatedLoad = await db.load.findUnique({
      where: { id: load.id },
      select: { settlementStatus: true },
    });
    expect(updatedLoad?.settlementStatus).toBe("PAID");
  });

  it("PC3 — COMPLETED, no other active trips → truck.isAvailable=true", async () => {
    const { trip, truck } = await seedPodCompletionData({
      podSubmitted: true,
      truckIsAvailable: false,
    });

    const req = createRequest(
      "PATCH",
      `http://localhost/api/trips/${trip.id}`,
      {
        body: { status: "COMPLETED" },
      }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(200);

    const updatedTruck = await db.truck.findUnique({
      where: { id: truck.id },
      select: { isAvailable: true },
    });
    expect(updatedTruck?.isAvailable).toBe(true);
  });

  it("PC4 — COMPLETED, another active trip exists → truck stays false", async () => {
    const {
      trip,
      truck,
      load: _load,
      shipperOrg,
      carrierOrg,
    } = await seedPodCompletionData({
      podSubmitted: true,
      truckIsAvailable: false,
    });

    // Second active trip on same truck
    const load2 = await db.load.create({
      data: {
        id: "load-pod-comp-02",
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
        id: "trip-pod-comp-02",
        loadId: load2.id,
        truckId: truck.id,
        carrierId: carrierOrg.id,
        shipperId: shipperOrg.id,
        status: "IN_TRANSIT",
        trackingEnabled: true,
      },
    });

    const req = createRequest(
      "PATCH",
      `http://localhost/api/trips/${trip.id}`,
      {
        body: { status: "COMPLETED" },
      }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(200);

    const updatedTruck = await db.truck.findUnique({
      where: { id: truck.id },
      select: { isAvailable: true },
    });
    expect(updatedTruck?.isAvailable).toBe(false);
  });

  it("PC5 — COMPLETED, fee deduction fails → 400", async () => {
    mockDeductFee.mockResolvedValueOnce({
      success: false,
      error: "Insufficient balance",
      serviceFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      totalPlatformFee: 0,
      platformRevenue: 0,
      transactionId: "",
      details: {},
    } as any);

    const { trip } = await seedPodCompletionData({ podSubmitted: true });

    const req = createRequest(
      "PATCH",
      `http://localhost/api/trips/${trip.id}`,
      {
        body: { status: "COMPLETED" },
      }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(400);

    const data = await parseResponse(res);
    expect(data.error).toMatch(/fee deduction failed/i);
  });

  it("PC6 — COMPLETED → createNotification called for shipper with DELIVERY_CONFIRMED", async () => {
    const { trip } = await seedPodCompletionData({ podSubmitted: true });

    const notifModule = require("@/lib/notifications");

    const req = createRequest(
      "PATCH",
      `http://localhost/api/trips/${trip.id}`,
      {
        body: { status: "COMPLETED" },
      }
    );
    const res = await callHandler(updateTrip, req, { tripId: trip.id });
    expect(res.status).toBe(200);

    expect(notifModule.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "DELIVERY_CONFIRMED",
        userId: "shipper-pod-comp-user",
      })
    );
  });
});

describe("PC7–PC9 — PUT /loads/[id]/pod (shipper verifies POD)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAllStores();
    (db.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)
    );
    setAuthSession(shipperSession);
  });

  afterAll(() => {
    clearAllStores();
  });

  it("PC7 — shipper PUT /loads/[id]/pod → trip.status becomes COMPLETED", async () => {
    const { load, trip } = await seedPodCompletionData({
      tripStatus: "DELIVERED",
      podSubmitted: true,
    });

    const req = createRequest(
      "PUT",
      `http://localhost/api/loads/${load.id}/pod`,
      {
        body: {},
      }
    );
    const res = await callHandler(verifyPod, req, { id: load.id });
    expect(res.status).toBe(200);

    const updatedTrip = await db.trip.findUnique({
      where: { id: trip.id },
      select: { status: true },
    });
    expect(updatedTrip?.status).toBe("COMPLETED");
  });

  it("PC8 — shipper PUT /loads/[id]/pod → truck.isAvailable=true", async () => {
    const { load, truck } = await seedPodCompletionData({
      tripStatus: "DELIVERED",
      podSubmitted: true,
      truckIsAvailable: false,
    });

    const req = createRequest(
      "PUT",
      `http://localhost/api/loads/${load.id}/pod`,
      {
        body: {},
      }
    );
    const res = await callHandler(verifyPod, req, { id: load.id });
    expect(res.status).toBe(200);

    const updatedTruck = await db.truck.findUnique({
      where: { id: truck.id },
      select: { isAvailable: true },
    });
    expect(updatedTruck?.isAvailable).toBe(true);
  });

  it("PC9 — shipper PUT /loads/[id]/pod → MATCHED posting → ACTIVE", async () => {
    const { load, posting } = await seedPodCompletionData({
      tripStatus: "DELIVERED",
      podSubmitted: true,
      postingStatus: "MATCHED",
    });

    const req = createRequest(
      "PUT",
      `http://localhost/api/loads/${load.id}/pod`,
      {
        body: {},
      }
    );
    const res = await callHandler(verifyPod, req, { id: load.id });
    expect(res.status).toBe(200);

    const updatedPosting = await db.truckPosting.findUnique({
      where: { id: posting.id },
      select: { status: true },
    });
    expect(updatedPosting?.status).toBe("ACTIVE");
  });
});

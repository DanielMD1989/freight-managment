/**
 * Driver Trip Operations Tests — Task 27B
 *
 * Tests driver-specific trip operations: status transitions, POD, messaging,
 * GPS, and cancel denial.
 */
import {
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
  mockStorage,
  setAuthSession,
  createMockSession,
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  clearAllStores,
} from "../../utils/routeTestUtils";
import { db } from "@/lib/db";

// ─── Mocks ───────────────────────────────────────────────────────────────────
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
// Use real getAccessRoles — the mock returns { canView, canModify } which
// doesn't match the route's destructuring of { isShipper, isDriver, ... }.
jest.mock("@/lib/rbac", () => {
  const real = jest.requireActual("@/lib/rbac/accessHelpers");
  return {
    getAccessRoles: real.getAccessRoles,
    canView: real.canView,
    canModify: real.canModify,
    isAdminRole: real.isAdminRole,
    isSuperAdminRole: real.isSuperAdminRole,
    Permission: {
      VIEW_LOADS: "view_loads",
      VIEW_TRUCKS: "view_trucks",
      UPDATE_TRIP_STATUS: "update_trip_status",
      UPLOAD_POD: "upload_pod",
      VIEW_POD: "view_pod",
      VIEW_GPS: "view_gps",
      VIEW_LIVE_TRACKING: "view_live_tracking",
      UPLOAD_DOCUMENTS: "upload_documents",
      VIEW_DOCUMENTS: "view_documents",
    },
    UnauthorizedError: class extends Error {
      constructor(m = "Unauthorized") {
        super(m);
        this.name = "UnauthorizedError";
      }
    },
    ForbiddenError: class extends Error {
      constructor(m = "Forbidden") {
        super(m);
        this.name = "ForbiddenError";
      }
    },
    requirePermission: jest.fn(async () => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      return getAuthSession();
    }),
    requireRole: jest.fn(async () => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      return getAuthSession();
    }),
    getCurrentUserRole: jest.fn(async () => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      const s = getAuthSession();
      return s?.role ?? null;
    }),
    hasRole: jest.fn(async () => true),
    hasAnyRole: jest.fn(async () => true),
    hasPermission: jest.fn(async () => true),
    hasAnyPermission: jest.fn(async () => true),
    hasAllPermissions: jest.fn(async () => true),
    isAdmin: jest.fn(async () => false),
    isOps: jest.fn(async () => false),
    isSuperAdmin: jest.fn(async () => false),
    canManageOrganization: jest.fn(async () => false),
    requireAnyPermission: jest.fn(async () => {
      const { getAuthSession } = require("../../utils/routeTestUtils");
      return getAuthSession();
    }),
  };
});
mockStorage();

// Mock service fee (needed by PATCH trip COMPLETED/DELIVERED paths)
jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFee: jest.fn(async () => ({
    success: true,
    shipperFee: 100,
    carrierFee: 50,
    totalPlatformFee: 150,
    platformRevenue: { greaterThan: () => true },
    transactionId: "tx-mock",
  })),
  refundServiceFee: jest.fn(async () => ({ success: true })),
}));

jest.mock("@/lib/trustMetrics", () => ({
  incrementCompletedLoads: jest.fn(async () => {}),
}));

jest.mock("@/lib/walletGate", () => ({
  checkWalletGate: jest.fn(async () => null),
}));

// ─── Route handlers ──────────────────────────────────────────────────────────
const {
  PATCH: updateTrip,
  GET: getTrip,
} = require("@/app/api/trips/[tripId]/route");
const { POST: cancelTrip } = require("@/app/api/trips/[tripId]/cancel/route");
const { GET: listTrips } = require("@/app/api/trips/route");
const {
  POST: sendMessage,
  GET: getMessages,
} = require("@/app/api/trips/[tripId]/messages/route");

// GPS uses withRpsLimit which is mocked to passthrough
const {
  POST: postGps,
  GET: getGps,
} = require("@/app/api/trips/[tripId]/gps/route");

// ─── Sessions ────────────────────────────────────────────────────────────────
const DRIVER_SESSION = createMockSession({
  userId: "driver-ops-1",
  email: "driver-ops@test.com",
  role: "DRIVER",
  status: "ACTIVE",
  organizationId: "carrier-org-1",
  firstName: "Ops",
  lastName: "Driver",
});

const OTHER_DRIVER_SESSION = createMockSession({
  userId: "driver-ops-other",
  role: "DRIVER",
  status: "ACTIVE",
  organizationId: "carrier-org-1",
});

// ─── Setup ───────────────────────────────────────────────────────────────────
const TRIP_ID = "trip-ops-test";

beforeAll(async () => {
  await seedTestData();

  // Create driver user
  await db.user.create({
    data: {
      id: "driver-ops-1",
      email: "driver-ops@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Ops",
      lastName: "Driver",
      phone: "+251911660001",
      role: "DRIVER",
      status: "ACTIVE",
      organizationId: "carrier-org-1",
    },
  });
  await db.driverProfile.create({
    data: { id: "dp-ops-1", userId: "driver-ops-1", isAvailable: true },
  });

  // Other driver (for isolation test)
  await db.user.create({
    data: {
      id: "driver-ops-other",
      email: "driver-ops-other@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Other",
      lastName: "Driver",
      phone: "+251911660002",
      role: "DRIVER",
      status: "ACTIVE",
      organizationId: "carrier-org-1",
    },
  });

  // Trip assigned to our driver
  await db.trip.create({
    data: {
      id: TRIP_ID,
      status: "ASSIGNED",
      truckId: "test-truck-001",
      carrierId: "carrier-org-1",
      shipperId: "shipper-org-1",
      loadId: "test-load-001",
      driverId: "driver-ops-1",
      trackingEnabled: true,
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
    },
  });
});

afterAll(() => {
  clearAllStores();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Driver Trip Status Transitions", () => {
  test("DRIVER can view their assigned trip", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/trips/${TRIP_ID}`
    );
    const res = await callHandler(getTrip, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);
  });

  test("DRIVER sees only their trips in list", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest("GET", "http://localhost:3000/api/trips");
    const res = await callHandler(listTrips, req);
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.trips).toBeDefined();
    // All trips should have driverId = our driver
    for (const trip of body.trips) {
      expect(trip.driverId).toBe("driver-ops-1");
    }
  });

  test("DRIVER can update trip status to PICKUP_PENDING", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${TRIP_ID}`,
      { body: { status: "PICKUP_PENDING" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);
  });

  test("DRIVER can update trip status to IN_TRANSIT", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${TRIP_ID}`,
      { body: { status: "IN_TRANSIT" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);
  });

  test("DRIVER can update trip status to DELIVERED", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${TRIP_ID}`,
      { body: { status: "DELIVERED" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);
  });

  test("DRIVER cannot cancel trip via cancel route", async () => {
    // Reset to a cancellable state first
    await db.trip.update({
      where: { id: TRIP_ID },
      data: { status: "ASSIGNED" },
    });

    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${TRIP_ID}/cancel`,
      { body: { reason: "I want to cancel" } }
    );
    const res = await callHandler(cancelTrip, req, { tripId: TRIP_ID });
    expect(res.status).toBe(403);
    const body = await parseResponse(res);
    expect(body.error).toContain("Drivers cannot cancel");
  });

  test("DRIVER cannot cancel via PATCH status=CANCELLED", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/trips/${TRIP_ID}`,
      { body: { status: "CANCELLED", cancelReason: "test" } }
    );
    const res = await callHandler(updateTrip, req, { tripId: TRIP_ID });
    expect(res.status).toBe(403);
    const body = await parseResponse(res);
    // canRoleSetTripStatus fires first (DRIVER has no CANCELLED in permissions),
    // before the belt-and-suspenders check reaches "Drivers cannot cancel"
    expect(body.error).toMatch(/DRIVER.*CANCELLED|Drivers cannot cancel/);
  });

  test("DRIVER cannot view another driver's trip", async () => {
    setAuthSession(OTHER_DRIVER_SESSION);
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/trips/${TRIP_ID}`
    );
    const res = await callHandler(getTrip, req, { tripId: TRIP_ID });
    expect(res.status).toBe(404);
  });
});

describe("Driver Messaging", () => {
  test("DRIVER can send message with senderRole=DRIVER", async () => {
    // Set trip to active status for messaging
    await db.trip.update({
      where: { id: TRIP_ID },
      data: { status: "IN_TRANSIT" },
    });

    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${TRIP_ID}/messages`,
      { body: { content: "Approaching pickup location" } }
    );
    const res = await callHandler(sendMessage, req, { tripId: TRIP_ID });
    expect(res.status).toBe(201);
    const body = await parseResponse(res);
    expect(body.message).toBeDefined();
    expect(body.message.senderRole).toBe("DRIVER");
  });

  test("DRIVER can read messages on their trip", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/trips/${TRIP_ID}/messages`
    );
    const res = await callHandler(getMessages, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.messages).toBeDefined();
    expect(Array.isArray(body.messages)).toBe(true);
  });
});

describe("Driver GPS", () => {
  test("DRIVER can post GPS to their trip", async () => {
    // Trip must be IN_TRANSIT for GPS
    await db.trip.update({
      where: { id: TRIP_ID },
      data: { status: "IN_TRANSIT" },
    });

    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${TRIP_ID}/gps`,
      {
        body: {
          latitude: 9.02,
          longitude: 38.75,
          speed: 60,
          heading: 90,
          timestamp: new Date().toISOString(),
        },
      }
    );
    const res = await callHandler(postGps, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);
  });

  test("GPS position has source=MOBILE_DRIVER and driverId set", async () => {
    // Check the GPS position created in the previous test
    const positions = Array.from(
      ((db as any).__stores?.gpsPositions ?? new Map()).values()
    );
    const driverPositions = positions.filter(
      (p: any) => p.driverId === "driver-ops-1"
    );
    expect(driverPositions.length).toBeGreaterThanOrEqual(1);

    const pos = driverPositions[0] as any;
    expect(pos.source).toBe("MOBILE_DRIVER");
    expect(pos.driverId).toBe("driver-ops-1");
    expect(pos.deviceId).toBeNull();
  });

  test("DRIVER can view GPS history for their trip", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "GET",
      `http://localhost:3000/api/trips/${TRIP_ID}/gps`
    );
    const res = await callHandler(getGps, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.positions).toBeDefined();
  });
});

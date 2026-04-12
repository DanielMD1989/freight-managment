/**
 * Driver Trip Assignment Tests — Task 27B
 *
 * Tests assign-driver, unassign-driver, and conflict detection.
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
mockRbac();

// ─── Route handlers ──────────────────────────────────────────────────────────
const {
  POST: assignDriver,
} = require("@/app/api/trips/[tripId]/assign-driver/route");
const {
  POST: unassignDriver,
} = require("@/app/api/trips/[tripId]/unassign-driver/route");

// ─── Sessions ────────────────────────────────────────────────────────────────
const CARRIER_SESSION = createMockSession({
  userId: "carrier-user-1",
  email: "carrier@test.com",
  role: "CARRIER",
  status: "ACTIVE",
  organizationId: "carrier-org-1",
});

const DRIVER_SESSION = createMockSession({
  userId: "driver-assign-1",
  role: "DRIVER",
  status: "ACTIVE",
  organizationId: "carrier-org-1",
});

const SHIPPER_SESSION = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  status: "ACTIVE",
  organizationId: "shipper-org-1",
});

// ─── Setup ───────────────────────────────────────────────────────────────────
let tripId: string;
let driver2Id: string;

beforeAll(async () => {
  await seedTestData();

  // Driver 1: available, in carrier org
  await db.user.create({
    data: {
      id: "driver-assign-1",
      email: "driver-assign-1@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Assign",
      lastName: "Driver1",
      phone: "+251911770001",
      role: "DRIVER",
      status: "ACTIVE",
      organizationId: "carrier-org-1",
    },
  });
  await db.driverProfile.create({
    data: {
      id: "dp-assign-1",
      userId: "driver-assign-1",
      isAvailable: true,
    },
  });

  // Driver 2: available, in carrier org (for conflict test)
  driver2Id = "driver-assign-2";
  await db.user.create({
    data: {
      id: driver2Id,
      email: "driver-assign-2@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Assign",
      lastName: "Driver2",
      phone: "+251911770002",
      role: "DRIVER",
      status: "ACTIVE",
      organizationId: "carrier-org-1",
    },
  });
  await db.driverProfile.create({
    data: {
      id: "dp-assign-2",
      userId: driver2Id,
      isAvailable: true,
    },
  });

  // Driver 3: unavailable
  await db.user.create({
    data: {
      id: "driver-unavailable",
      email: "driver-unavail@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Unavail",
      lastName: "Driver",
      phone: "+251911770003",
      role: "DRIVER",
      status: "ACTIVE",
      organizationId: "carrier-org-1",
    },
  });
  await db.driverProfile.create({
    data: {
      id: "dp-unavail",
      userId: "driver-unavailable",
      isAvailable: false,
    },
  });

  // Driver 4: different org
  await db.user.create({
    data: {
      id: "driver-other-org",
      email: "driver-other@test.com",
      passwordHash: "hashed_Test1234!",
      firstName: "Other",
      lastName: "Org",
      phone: "+251911770004",
      role: "DRIVER",
      status: "ACTIVE",
      organizationId: "shipper-org-1",
    },
  });

  // Trip for assignment tests
  const trip = await db.trip.create({
    data: {
      id: "trip-assign-test",
      status: "ASSIGNED",
      truckId: "test-truck-001",
      carrierId: "carrier-org-1",
      shipperId: "shipper-org-1",
      loadId: "test-load-001",
      trackingEnabled: true,
    },
  });
  tripId = trip.id;

  // Second trip (to test conflict — driver2 already has this active trip)
  await db.trip.create({
    data: {
      id: "trip-conflict",
      status: "IN_TRANSIT",
      truckId: "test-truck-001",
      carrierId: "carrier-org-1",
      shipperId: "shipper-org-1",
      driverId: driver2Id,
      trackingEnabled: true,
    },
  });
});

afterAll(() => {
  clearAllStores();
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Trip Driver Assignment", () => {
  test("CARRIER can assign driver to ASSIGNED trip", async () => {
    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/assign-driver`,
      { body: { driverId: "driver-assign-1" } }
    );
    const res = await callHandler(assignDriver, req, { tripId });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.success).toBe(true);
    expect(body.driverId).toBe("driver-assign-1");
  });

  test("CARRIER can assign driver to PICKUP_PENDING trip", async () => {
    // Set trip to PICKUP_PENDING
    await db.trip.update({
      where: { id: tripId },
      data: { status: "PICKUP_PENDING", driverId: null },
    });

    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/assign-driver`,
      { body: { driverId: "driver-assign-1" } }
    );
    const res = await callHandler(assignDriver, req, { tripId });
    expect(res.status).toBe(200);
  });

  test("Cannot assign driver to IN_TRANSIT trip", async () => {
    await db.trip.update({
      where: { id: tripId },
      data: { status: "IN_TRANSIT" },
    });

    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/assign-driver`,
      { body: { driverId: "driver-assign-1" } }
    );
    const res = await callHandler(assignDriver, req, { tripId });
    expect(res.status).toBe(400);

    // Reset for subsequent tests
    await db.trip.update({
      where: { id: tripId },
      data: { status: "ASSIGNED", driverId: null },
    });
  });

  test("Cannot assign driver from different org", async () => {
    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/assign-driver`,
      { body: { driverId: "driver-other-org" } }
    );
    const res = await callHandler(assignDriver, req, { tripId });
    expect(res.status).toBe(400);
    const body = await parseResponse(res);
    expect(body.error).toContain("same carrier");
  });

  test("Cannot assign unavailable driver", async () => {
    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/assign-driver`,
      { body: { driverId: "driver-unavailable" } }
    );
    const res = await callHandler(assignDriver, req, { tripId });
    expect(res.status).toBe(400);
    const body = await parseResponse(res);
    expect(body.error).toContain("not available");
  });

  test("Cannot assign driver with active trip (conflict)", async () => {
    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/assign-driver`,
      { body: { driverId: driver2Id } }
    );
    const res = await callHandler(assignDriver, req, { tripId });
    expect(res.status).toBe(400);
    const body = await parseResponse(res);
    expect(body.error).toContain("active trip");
  });

  test("CARRIER can unassign driver from ASSIGNED trip", async () => {
    // First assign a driver
    await db.trip.update({
      where: { id: tripId },
      data: { driverId: "driver-assign-1" },
    });

    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/unassign-driver`
    );
    const res = await callHandler(unassignDriver, req, { tripId });
    expect(res.status).toBe(200);
    const body = await parseResponse(res);
    expect(body.removedDriverId).toBe("driver-assign-1");
  });

  test("Cannot unassign from IN_TRANSIT trip", async () => {
    await db.trip.update({
      where: { id: tripId },
      data: { status: "IN_TRANSIT", driverId: "driver-assign-1" },
    });

    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/unassign-driver`
    );
    const res = await callHandler(unassignDriver, req, { tripId });
    expect(res.status).toBe(400);
    const body = await parseResponse(res);
    expect(body.error).toContain("ASSIGNED");

    // Reset
    await db.trip.update({
      where: { id: tripId },
      data: { status: "ASSIGNED", driverId: null },
    });
  });

  test("Cannot unassign when no driver assigned", async () => {
    setAuthSession(CARRIER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/unassign-driver`
    );
    const res = await callHandler(unassignDriver, req, { tripId });
    expect(res.status).toBe(400);
    const body = await parseResponse(res);
    expect(body.error).toContain("No driver");
  });

  test("DRIVER cannot assign drivers", async () => {
    setAuthSession(DRIVER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/assign-driver`,
      { body: { driverId: "driver-assign-1" } }
    );
    const res = await callHandler(assignDriver, req, { tripId });
    expect(res.status).toBe(404);
  });

  test("SHIPPER cannot assign drivers", async () => {
    setAuthSession(SHIPPER_SESSION);
    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/assign-driver`,
      { body: { driverId: "driver-assign-1" } }
    );
    const res = await callHandler(assignDriver, req, { tripId });
    expect(res.status).toBe(404);
  });
});

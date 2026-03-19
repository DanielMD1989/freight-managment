// @jest-environment node
/**
 * Truck Reassignment API Tests
 *
 * Tests for POST /api/trips/[tripId]/reassign-truck:
 * - T1:  Admin reassigns EXCEPTION trip → 200, full state check
 * - T2:  Dispatcher reassigns → 200 + admin notified
 * - T3:  Carrier → 404
 * - T4:  Shipper → 404
 * - T5:  Non-EXCEPTION trip → 400
 * - T6:  Different carrier org → 400
 * - T7:  Unavailable truck → 400
 * - T8:  Same truck → 400
 * - T9:  Shipper notified on reassignment
 * - T10: Carrier org notified on reassignment
 * - T11: Old truck freed (no other active trips)
 * - T12: Old truck NOT freed (other active trip exists)
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
  mockCors,
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockRbac,
  mockLogger,
  mockLoadUtils,
  SeedData,
} from "../../utils/routeTestUtils";

mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
mockCors();
mockAuditLog();
mockGps();
mockFoundationRules();
mockSms();
mockMatchingEngine();
mockDispatcherPermissions();
mockRbac();
mockLogger();
mockLoadUtils();

// Custom notifications mock to assert on calls
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  notifyOrganization: jest.fn(async () => {}),
  createNotificationForRole: jest.fn(async () => ({ id: "notif-role-1" })),
  notifyLoadStakeholders: jest.fn(async () => {}),
  NotificationType: {
    TRIP_REASSIGNED: "TRIP_REASSIGNED",
    TRIP_CANCELLED: "TRIP_CANCELLED",
    EXCEPTION_CREATED: "EXCEPTION_CREATED",
    SYSTEM: "SYSTEM",
  },
}));

// Custom apiErrors mock
jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    if (error.name === "ZodError" || error.issues) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors || error.issues },
        { status: 400 }
      );
    }
    const status =
      error.name === "ForbiddenError"
        ? 403
        : error.message === "Unauthorized" || error.name === "UnauthorizedError"
          ? 401
          : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

// Import handler AFTER mocks
const {
  POST: reassignTruck,
} = require("@/app/api/trips/[tripId]/reassign-truck/route");

describe("Truck Reassignment", () => {
  let seed: SeedData;
  let counter = 0;

  const adminSession = createMockSession({
    userId: "ra-admin-1",
    email: "admin@reassign.test",
    role: "ADMIN",
    organizationId: "ra-admin-org",
  });

  const dispatcherSession = createMockSession({
    userId: "ra-dispatcher-1",
    email: "dispatcher@reassign.test",
    role: "DISPATCHER",
    organizationId: "ra-dispatcher-org",
  });

  const carrierSession = createMockSession({
    userId: "ra-carrier-1",
    email: "carrier@reassign.test",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const shipperSession = createMockSession({
    userId: "ra-shipper-1",
    email: "shipper@reassign.test",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  // Helper: create EXCEPTION trip with old + new truck
  async function createReassignableTrip(
    tripOverrides: Record<string, any> = {},
    newTruckOverrides: Record<string, any> = {}
  ) {
    counter++;
    const loadId = `ra-load-${counter}`;
    const tripId = `ra-trip-${counter}`;
    const oldTruckId = seed.truck.id;
    const newTruckId = `ra-new-truck-${counter}`;

    await db.load.create({
      data: {
        id: loadId,
        status: "EXCEPTION",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(Date.now() + 86400000),
        deliveryDate: new Date(Date.now() + 3 * 86400000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: `Reassignment test ${counter}`,
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: oldTruckId,
      },
    });

    await db.trip.create({
      data: {
        id: tripId,
        loadId,
        truckId: oldTruckId,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "EXCEPTION",
        trackingEnabled: false,
        ...tripOverrides,
      },
    });

    // Mark old truck as unavailable
    await db.truck.update({
      where: { id: oldTruckId },
      data: { isAvailable: false },
    });

    // Create new replacement truck (same carrier org, available)
    await db.truck.create({
      data: {
        id: newTruckId,
        licensePlate: `NEW-${counter}`,
        truckType: "DRY_VAN",
        carrierId: seed.carrierOrg.id,
        isAvailable: true,
        isApproved: true,
        ...newTruckOverrides,
      },
    });

    return { loadId, tripId, oldTruckId, newTruckId };
  }

  beforeAll(async () => {
    seed = await seedTestData();
  });

  beforeEach(async () => {
    setAuthSession(adminSession);
    jest.clearAllMocks();
    // Clean up reassignment data between tests
    if (seed?.truck?.id) {
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: true },
      });
    }
    const trips = (db as any).__stores?.trips;
    const loads = (db as any).__stores?.loads;
    const trucks = (db as any).__stores?.trucks;
    if (trips)
      for (const [id] of trips) if (id.startsWith("ra-")) trips.delete(id);
    if (loads)
      for (const [id] of loads) if (id.startsWith("ra-")) loads.delete(id);
    if (trucks)
      for (const [id] of trucks) if (id.startsWith("ra-")) trucks.delete(id);
  });

  afterAll(() => {
    clearAllStores();
  });

  // ─── T1: Admin reassigns EXCEPTION trip → 200 ────────────────────────────

  it("T1: Admin reassigns EXCEPTION trip → 200, full state check", async () => {
    const { tripId, loadId, oldTruckId, newTruckId } =
      await createReassignableTrip();

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Engine failure" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.success).toBe(true);
    expect(data.newTruckId).toBe(newTruckId);
    expect(data.previousTruckId).toBe(oldTruckId);
    expect(data.reassignedAt).toBeDefined();

    // Trip state
    const trip = await db.trip.findUnique({ where: { id: tripId } });
    expect(trip.status).toBe("IN_TRANSIT");
    expect(trip.truckId).toBe(newTruckId);
    expect(trip.previousTruckId).toBe(oldTruckId);
    expect(trip.reassignedAt).toBeDefined();
    expect(trip.reassignmentReason).toBe("Engine failure");

    // Old truck freed (no other active trips)
    const oldTruck = await db.truck.findUnique({ where: { id: oldTruckId } });
    expect(oldTruck.isAvailable).toBe(true);

    // New truck locked
    const newTruck = await db.truck.findUnique({ where: { id: newTruckId } });
    expect(newTruck.isAvailable).toBe(false);

    // Load synced
    const load = await db.load.findUnique({ where: { id: loadId } });
    expect(load.status).toBe("IN_TRANSIT");
    expect(load.assignedTruckId).toBe(newTruckId);

    // Audit event
    expect(db.loadEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          loadId,
          eventType: "TRIP_REASSIGNED",
        }),
      })
    );
  });

  // ─── T2: Dispatcher reassigns → 200 + admin notified ─────────────────────

  it("T2: Dispatcher reassigns → 200 + admin notified", async () => {
    setAuthSession(dispatcherSession);
    const { tripId, newTruckId } = await createReassignableTrip();
    const { createNotificationForRole } = require("@/lib/notifications");

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Tire blowout" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(200);

    // Admin should be notified when dispatcher initiates
    expect(createNotificationForRole).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "ADMIN",
        type: "TRIP_REASSIGNED",
        title: "Dispatcher performed truck reassignment",
      })
    );
  });

  // ─── T3: Carrier → 404 ───────────────────────────────────────────────────

  it("T3: Carrier cannot reassign → 404", async () => {
    setAuthSession(carrierSession);
    const { tripId, newTruckId } = await createReassignableTrip();

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Carrier attempt" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(404);
  });

  // ─── T4: Shipper → 404 ───────────────────────────────────────────────────

  it("T4: Shipper cannot reassign → 404", async () => {
    setAuthSession(shipperSession);
    const { tripId, newTruckId } = await createReassignableTrip();

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Shipper attempt" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(404);
  });

  // ─── T5: Non-EXCEPTION trip → 400 ────────────────────────────────────────

  it("T5: Trip not in EXCEPTION → 400", async () => {
    const { tripId, newTruckId } = await createReassignableTrip({
      status: "IN_TRANSIT",
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Not exception" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(400);

    const data = await parseResponse(res);
    expect(data.error).toContain("EXCEPTION");
  });

  // ─── T6: Different carrier org → 400 ─────────────────────────────────────

  it("T6: New truck different carrier → 400", async () => {
    const { tripId, newTruckId } = await createReassignableTrip(
      {},
      { carrierId: "different-carrier-org" }
    );

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Wrong carrier" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(400);

    const data = await parseResponse(res);
    expect(data.error).toContain("same carrier");
  });

  // ─── T7: Unavailable truck → 400 ─────────────────────────────────────────

  it("T7: New truck not available → 400", async () => {
    const { tripId, newTruckId } = await createReassignableTrip(
      {},
      { isAvailable: false }
    );

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Truck busy" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(400);

    const data = await parseResponse(res);
    expect(data.error).toContain("not available");
  });

  // ─── T8: Same truck → 400 ────────────────────────────────────────────────

  it("T8: Same truck as current → 400", async () => {
    const { tripId, oldTruckId } = await createReassignableTrip();
    // Mark old truck as available so it passes the availability check
    await db.truck.update({
      where: { id: oldTruckId },
      data: { isAvailable: true },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId: oldTruckId, reason: "Same truck" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(400);

    const data = await parseResponse(res);
    expect(data.error).toContain("different from current");
  });

  // ─── T9: Shipper notified ────────────────────────────────────────────────

  it("T9: Shipper notified on reassignment", async () => {
    const { tripId, newTruckId } = await createReassignableTrip();
    const { notifyOrganization } = require("@/lib/notifications");

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Breakdown" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(200);

    expect(notifyOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: seed.shipperOrg.id,
        type: "TRIP_REASSIGNED",
      })
    );
  });

  // ─── T10: Carrier org notified ───────────────────────────────────────────

  it("T10: Carrier org notified on reassignment", async () => {
    const { tripId, newTruckId } = await createReassignableTrip();
    const { notifyOrganization } = require("@/lib/notifications");

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Breakdown" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(200);

    expect(notifyOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: seed.carrierOrg.id,
        type: "TRIP_REASSIGNED",
      })
    );
  });

  // ─── T11: Old truck freed ────────────────────────────────────────────────

  it("T11: Old truck freed when no other active trips", async () => {
    const { tripId, oldTruckId, newTruckId } = await createReassignableTrip();

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Breakdown" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(200);

    const oldTruck = await db.truck.findUnique({ where: { id: oldTruckId } });
    expect(oldTruck.isAvailable).toBe(true);
  });

  // ─── T12: Old truck NOT freed ────────────────────────────────────────────

  it("T12: Old truck NOT freed when another active trip exists", async () => {
    const { tripId, oldTruckId, newTruckId, loadId } =
      await createReassignableTrip();

    // Create another active trip on the old truck
    const otherLoadId = `ra-other-load-${counter}`;
    const otherTripId = `ra-other-trip-${counter}`;
    await db.load.create({
      data: {
        id: otherLoadId,
        status: "IN_TRANSIT",
        pickupCity: "Mekelle",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 86400000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Other active load",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: oldTruckId,
      },
    });
    await db.trip.create({
      data: {
        id: otherTripId,
        loadId: otherLoadId,
        truckId: oldTruckId,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "IN_TRANSIT",
        trackingEnabled: true,
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost:3000/api/trips/${tripId}/reassign-truck`,
      { body: { newTruckId, reason: "Breakdown" } }
    );
    const res = await callHandler(reassignTruck, req, { tripId });
    expect(res.status).toBe(200);

    // Old truck should NOT be freed — other active trip exists
    const oldTruck = await db.truck.findUnique({ where: { id: oldTruckId } });
    expect(oldTruck.isAvailable).toBe(false);
  });
});

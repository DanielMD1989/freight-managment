/**
 * Trip Cancellation API Tests
 *
 * Tests for POST /api/trips/[tripId]/cancel:
 * - Carrier or shipper can cancel before COMPLETED
 * - Admin and dispatcher can cancel any trip
 * - Trip set to CANCELLED, load set to CANCELLED with assignedTruckId nulled
 * - TRIP_CANCELLED load event with metadata
 * - Cache invalidation and notifications
 *
 * Business rules:
 * - Reason is required (min 1, max 500 chars)
 * - Cannot cancel COMPLETED or already CANCELLED trips
 * - Unrelated users get 403
 * - Other party notified on cancellation
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  parseResponse,
  callHandler,
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

// Setup mocks
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

// Custom notifications mock with TRIP_CANCELLED type
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  notifyTruckRequest: jest.fn(async () => {}),
  getRecentNotifications: jest.fn(async () => []),
  getUnreadCount: jest.fn(async () => 0),
  markAsRead: jest.fn(async () => {}),
  NotificationType: {
    LOAD_REQUEST: "LOAD_REQUEST",
    TRUCK_REQUEST: "TRUCK_REQUEST",
    TRIP_STATUS: "TRIP_STATUS",
    TRIP_CANCELLED: "TRIP_CANCELLED",
    SYSTEM: "SYSTEM",
  },
}));

// Custom apiErrors mock that handles ZodError → 400
jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    // ZodError → 400
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
const { POST: cancelTrip } = require("@/app/api/trips/[tripId]/cancel/route");

describe("Trip Cancellation", () => {
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

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user",
    email: "other-carrier@test.com",
    role: "CARRIER",
    organizationId: "other-carrier-org",
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

  // Helper to create a fresh cancellable trip
  let tripCounter = 0;
  async function createCancellableTrip(
    status = "ASSIGNED",
    overrides: Record<string, any> = {}
  ) {
    tripCounter++;
    const loadId = `cancel-load-${tripCounter}`;
    const tripId = `cancel-trip-${tripCounter}`;

    await db.load.create({
      data: {
        id: loadId,
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: `Cancel test cargo ${tripCounter}`,
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
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

    // Create additional users for access control
    await db.organization.create({
      data: {
        id: "other-carrier-org",
        name: "Other Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "other@test.com",
        contactPhone: "+251911000010",
      },
    });

    await db.user.create({
      data: {
        id: "other-carrier-user",
        email: "other-carrier@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Other",
        lastName: "Carrier",
        phone: "+251911000010",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: "other-carrier-org",
      },
    });

    await db.organization.create({
      data: {
        id: "admin-org-1",
        name: "Admin Org",
        type: "CARRIER_COMPANY",
        contactEmail: "admin@test.com",
        contactPhone: "+251911000011",
      },
    });

    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Admin",
        lastName: "User",
        phone: "+251911000011",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "admin-org-1",
      },
    });

    await db.organization.create({
      data: {
        id: "dispatcher-org-1",
        name: "Dispatcher Org",
        type: "CARRIER_COMPANY",
        contactEmail: "dispatcher@test.com",
        contactPhone: "+251911000012",
      },
    });

    await db.user.create({
      data: {
        id: "dispatcher-user-1",
        email: "dispatcher@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Dispatcher",
        lastName: "User",
        phone: "+251911000012",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "dispatcher-org-1",
      },
    });

    // Set users array on organizations so include resolves users properly
    await db.organization.update({
      where: { id: seed.carrierOrg.id },
      data: { users: [{ id: seed.carrierUser.id }] },
    });

    await db.organization.update({
      where: { id: seed.shipperOrg.id },
      data: { users: [{ id: seed.shipperUser.id }] },
    });

    // Create a COMPLETED trip (terminal state)
    await db.load.create({
      data: {
        id: "completed-load",
        status: "COMPLETED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        pickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Completed cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    await db.trip.create({
      data: {
        id: "completed-trip",
        loadId: "completed-load",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "COMPLETED",
      },
    });

    // Create an already CANCELLED trip
    await db.load.create({
      data: {
        id: "already-cancelled-load",
        status: "CANCELLED",
        pickupCity: "Mekelle",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 8000,
        cargoDescription: "Already cancelled cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    await db.trip.create({
      data: {
        id: "already-cancelled-trip",
        loadId: "already-cancelled-load",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "CANCELLED",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  // ─── Auth & Access ─────────────────────────────────────────────────────────

  describe("Auth & Access", () => {
    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);
      const { tripId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "No longer needed" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect([401, 500]).toContain(res.status);
    });

    it("unrelated user → 403", async () => {
      setAuthSession(otherCarrierSession);
      const { tripId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "I want to cancel" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(403);

      const data = await parseResponse(res);
      expect(data.error).toContain("permission");
    });

    it("carrier can cancel own trip → 200", async () => {
      const { tripId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Equipment breakdown" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("CANCELLED");
    });

    it("shipper can cancel → 200", async () => {
      setAuthSession(shipperSession);
      const { tripId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Load no longer available" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("CANCELLED");
    });
  });

  // ─── Status Guards ──────────────────────────────────────────────────────────

  describe("Status Guards", () => {
    it("trip not found → 404", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/nonexistent/cancel",
        { body: { reason: "Test cancellation" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId: "nonexistent" });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("Trip not found");
    });

    it("COMPLETED trip → 400", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/completed-trip/cancel",
        { body: { reason: "Want to cancel" } }
      );
      const res = await callHandler(cancelTrip, req, {
        tripId: "completed-trip",
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("completed");
    });

    it("already CANCELLED trip → 400", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/already-cancelled-trip/cancel",
        { body: { reason: "Cancel again" } }
      );
      const res = await callHandler(cancelTrip, req, {
        tripId: "already-cancelled-trip",
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("already cancelled");
    });
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe("Validation", () => {
    it("missing reason → 400", async () => {
      const { tripId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: {} }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(400);
    });

    it("reason too long (>500 chars) → 400", async () => {
      const { tripId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "x".repeat(501) } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(400);
    });
  });

  // ─── Cancel by Carrier ──────────────────────────────────────────────────────

  describe("Cancel by Carrier", () => {
    it("trip → CANCELLED with cancelReason stored", async () => {
      const { tripId } = await createCancellableTrip();
      const reason = "Truck needs urgent maintenance";

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("CANCELLED");
      expect(data.trip.cancelReason).toBe(reason);
      expect(data.trip.cancelledAt).toBeDefined();
    });

    it("load → CANCELLED with assignedTruckId nulled", async () => {
      const { tripId, loadId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Driver unavailable" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      // Verify load was updated
      const load = await db.load.findUnique({ where: { id: loadId } });
      expect(load.status).toBe("CANCELLED");
      expect(load.assignedTruckId).toBeNull();
    });
  });

  // ─── Cancel by Shipper ──────────────────────────────────────────────────────

  describe("Cancel by Shipper", () => {
    it("shipper cancels with same state changes", async () => {
      setAuthSession(shipperSession);
      const { tripId, loadId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Found cheaper option" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("CANCELLED");

      const load = await db.load.findUnique({ where: { id: loadId } });
      expect(load.status).toBe("CANCELLED");
      expect(load.assignedTruckId).toBeNull();
    });
  });

  // ─── Admin/Dispatcher ──────────────────────────────────────────────────────

  describe("Admin/Dispatcher", () => {
    it("admin can cancel any trip", async () => {
      setAuthSession(adminSession);
      const { tripId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Administrative cancellation" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("CANCELLED");
    });

    it("dispatcher cannot cancel (coordination only)", async () => {
      setAuthSession(dispatcherSession);
      const { tripId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Dispatch override" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(403);
    });
  });

  // ─── Side Effects ──────────────────────────────────────────────────────────

  describe("Side Effects", () => {
    it("TRIP_CANCELLED load event created with metadata", async () => {
      const { tripId, loadId } = await createCancellableTrip("IN_TRANSIT");

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Route blocked" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      expect(db.loadEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loadId,
            eventType: "TRIP_CANCELLED",
            metadata: expect.objectContaining({
              previousStatus: "IN_TRANSIT",
              reason: "Route blocked",
            }),
          }),
        })
      );
    });

    it("trackingEnabled set to false on cancellation", async () => {
      const { tripId } = await createCancellableTrip();

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Cancel for tracking test" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.trackingEnabled).toBe(false);
    });
  });

  // ─── Cache Invalidation ─────────────────────────────────────────────────────

  describe("Cache Invalidation", () => {
    it("CacheInvalidation.trip and .load called", async () => {
      const { tripId } = await createCancellableTrip();
      const { CacheInvalidation } = require("@/lib/cache");

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Cache test cancel" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      expect(CacheInvalidation.trip).toHaveBeenCalled();
      expect(CacheInvalidation.load).toHaveBeenCalled();
    });
  });

  // ─── Notifications ─────────────────────────────────────────────────────────

  describe("Notifications", () => {
    it("other party notified on cancellation", async () => {
      // Carrier cancels → shipper should be notified
      const { tripId } = await createCancellableTrip();
      const { createNotification } = require("@/lib/notifications");

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Carrier-initiated cancel" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      expect(createNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "TRIP_CANCELLED",
          title: "Trip Cancelled",
        })
      );
    });
  });
});

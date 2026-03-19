// @jest-environment node
/**
 * Load Status Cancellation Sync Tests (G-M24-1a through G-M24-1e)
 *
 * Tests for PATCH /api/loads/[id]/status with status=CANCELLED when a trip exists:
 * - G-M24-1a: Trip loadId nulled on CANCELLED (M21-9 compliance)
 * - G-M24-1b: Truck restore uses otherActiveTrips guard (not unconditional)
 * - G-M24-1c: TruckPosting reverted to ACTIVE (not EXPIRED)
 * - G-M24-1d: Trip trackingEnabled=false and cancelledBy set on CANCELLED
 * - G-M24-1e: Shipper CAN cancel loads with active trips; cleanup must be complete
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
  mockNotifications,
  mockCors,
  mockAuditLog,
  mockGps,
  mockFoundationRules,
  mockSms,
  mockMatchingEngine,
  mockDispatcherPermissions,
  mockRbac,
  mockApiErrors,
  mockLogger,
  mockServiceFee,
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
  SeedData,
} from "../../utils/routeTestUtils";

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
mockApiErrors();
mockLogger();
mockServiceFee();
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

// Mock automation rules (dynamic import in route, best-effort)
jest.mock("@/lib/automationRules", () => ({
  evaluateRulesForTrigger: jest.fn(async () => []),
}));
jest.mock("@/lib/automationActions", () => ({
  executeAndRecordRuleActions: jest.fn(async () => {}),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

// Import handler AFTER mocks
const { PATCH: updateStatus } = require("@/app/api/loads/[id]/status/route");

describe("Load Status Cancel → Trip Sync (G-M24-1)", () => {
  let seed: SeedData;
  let counter = 0;

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    status: "ACTIVE",
    organizationId: "shipper-org-1",
  });

  /**
   * Helper: create load + trip + truck in ASSIGNED state (cancellable by shipper).
   */
  async function createAssignedLoadWithTrip(
    overrides: Record<string, any> = {}
  ) {
    counter++;
    const loadId = `m24-load-${counter}`;
    const tripId = `m24-trip-${counter}`;
    const truckId = seed.truck.id;

    await db.load.create({
      data: {
        id: loadId,
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(Date.now() + 3 * 86400000),
        deliveryDate: new Date(Date.now() + 6 * 86400000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: `M24 test cargo ${counter}`,
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: truckId,
        // Mock DB: reverse one-to-one (Trip→Load) resolved via tripId on load record
        tripId,
      },
    });

    await db.trip.create({
      data: {
        id: tripId,
        loadId,
        truckId,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "ASSIGNED",
        trackingEnabled: true,
        ...overrides,
      },
    });

    // Mark truck as unavailable + create MATCHED posting
    await db.truck.update({
      where: { id: truckId },
      data: { isAvailable: false },
    });

    await db.truckPosting.create({
      data: {
        id: `m24-posting-${counter}`,
        truckId,
        status: "MATCHED",
        originCity: "Addis Ababa",
        destinationCity: "Hawassa",
        availableFrom: new Date(),
        organizationId: seed.carrierOrg.id,
      },
    });

    return { loadId, tripId, truckId };
  }

  beforeAll(async () => {
    seed = await seedTestData();
  });

  beforeEach(async () => {
    setAuthSession(shipperSession);
    jest.clearAllMocks();
    // Reset truck availability and clean up leftover trips/loads from prior tests.
    // The shared truck accumulates state across tests (trips, postings).
    if (seed?.truck?.id) {
      await db.truck.update({
        where: { id: seed.truck.id },
        data: { isAvailable: true },
      });
      // Clear m24-* trips/loads/postings to prevent cross-test interference
      const trips = (db as any).__stores?.trips;
      const loads = (db as any).__stores?.loads;
      const postings = (db as any).__stores?.truckPostings;
      if (trips) {
        for (const [id] of trips) {
          if (id.startsWith("m24-")) trips.delete(id);
        }
      }
      if (loads) {
        for (const [id] of loads) {
          if (id.startsWith("m24-")) loads.delete(id);
        }
      }
      if (postings) {
        for (const [id] of postings) {
          if (id.startsWith("m24-")) postings.delete(id);
        }
      }
    }
  });

  afterAll(() => {
    clearAllStores();
  });

  // ─── G-M24-1a: loadId nulled on trip ────────────────────────────────────────

  it("G-M24-1a: trip.loadId nulled when load cancelled with active trip", async () => {
    const { loadId, tripId } = await createAssignedLoadWithTrip();

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${loadId}/status`,
      { body: { status: "CANCELLED", reason: "Shipper cancels load" } }
    );
    const res = await callHandler(updateStatus, req, { id: loadId });
    expect(res.status).toBe(200);

    const trip = await db.trip.findUnique({ where: { id: tripId } });
    expect(trip.status).toBe("CANCELLED");
    expect(trip.loadId).toBeNull();
  });

  // ─── G-M24-1d: trackingEnabled + cancelledBy set ───────────────────────────

  it("G-M24-1d: trip.trackingEnabled=false and cancelledBy set on load cancellation", async () => {
    const { loadId, tripId } = await createAssignedLoadWithTrip();

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${loadId}/status`,
      { body: { status: "CANCELLED", reason: "Shipper audit trail test" } }
    );
    const res = await callHandler(updateStatus, req, { id: loadId });
    expect(res.status).toBe(200);

    const trip = await db.trip.findUnique({ where: { id: tripId } });
    expect(trip.trackingEnabled).toBe(false);
    expect(trip.cancelledBy).toBe(shipperSession.userId);
    expect(trip.cancelledAt).toBeDefined();
  });

  // ─── G-M24-1b: otherActiveTrips guard ──────────────────────────────────────

  it("G-M24-1b: truck NOT freed when other active trips exist", async () => {
    const { loadId, truckId } = await createAssignedLoadWithTrip();

    // Create a second active trip on the same truck
    const secondLoadId = `m24-second-load-${counter}`;
    const secondTripId = `m24-second-trip-${counter}`;
    await db.load.create({
      data: {
        id: secondLoadId,
        status: "IN_TRANSIT",
        pickupCity: "Mekelle",
        deliveryCity: "Bahir Dar",
        pickupDate: new Date(Date.now() - 86400000),
        deliveryDate: new Date(Date.now() + 3 * 86400000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Other active trip load",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: truckId,
      },
    });

    await db.trip.create({
      data: {
        id: secondTripId,
        loadId: secondLoadId,
        truckId,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "IN_TRANSIT",
        trackingEnabled: true,
      },
    });

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${loadId}/status`,
      { body: { status: "CANCELLED" } }
    );
    const res = await callHandler(updateStatus, req, { id: loadId });
    expect(res.status).toBe(200);

    // Truck should NOT be freed — other active trip exists
    const truck = await db.truck.findUnique({ where: { id: truckId } });
    expect(truck.isAvailable).toBe(false);
  });

  it("G-M24-1b: truck freed when no other active trips exist", async () => {
    const { loadId, truckId } = await createAssignedLoadWithTrip();

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${loadId}/status`,
      { body: { status: "CANCELLED" } }
    );
    const res = await callHandler(updateStatus, req, { id: loadId });
    expect(res.status).toBe(200);

    const truck = await db.truck.findUnique({ where: { id: truckId } });
    expect(truck.isAvailable).toBe(true);
  });

  // ─── G-M24-1c: TruckPosting → ACTIVE (not EXPIRED) ────────────────────────

  it("G-M24-1c: TruckPosting reverted to ACTIVE (not EXPIRED) on cancel", async () => {
    const { loadId, truckId } = await createAssignedLoadWithTrip();

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${loadId}/status`,
      { body: { status: "CANCELLED" } }
    );
    const res = await callHandler(updateStatus, req, { id: loadId });
    expect(res.status).toBe(200);

    // Verify posting was reverted to ACTIVE
    const postings = await db.truckPosting.findMany({
      where: { truckId },
    });
    const matchedPosting = postings.find(
      (p: any) => p.id === `m24-posting-${counter}`
    );
    expect(matchedPosting).toBeDefined();
    expect(matchedPosting.status).toBe("ACTIVE");
  });

  // ─── G-M24-1e: shipper can cancel load with active trip ────────────────────

  it("G-M24-1e: shipper can cancel ASSIGNED load with trip — full cleanup", async () => {
    const { loadId, tripId, truckId } = await createAssignedLoadWithTrip();

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${loadId}/status`,
      { body: { status: "CANCELLED", reason: "No longer need this shipment" } }
    );
    const res = await callHandler(updateStatus, req, { id: loadId });
    expect(res.status).toBe(200);

    // Load should be CANCELLED
    const load = await db.load.findUnique({ where: { id: loadId } });
    expect(load.status).toBe("CANCELLED");

    // Trip should be CANCELLED with full cleanup
    const trip = await db.trip.findUnique({ where: { id: tripId } });
    expect(trip.status).toBe("CANCELLED");
    expect(trip.loadId).toBeNull();
    expect(trip.trackingEnabled).toBe(false);
    expect(trip.cancelledBy).toBe(shipperSession.userId);
    expect(trip.cancelledAt).toBeDefined();

    // Truck should be freed (no other active trips)
    const truck = await db.truck.findUnique({ where: { id: truckId } });
    expect(truck.isAvailable).toBe(true);
  });

  it("G-M24-1e: shipper can cancel PICKUP_PENDING load with trip", async () => {
    const { loadId, tripId } = await createAssignedLoadWithTrip({
      status: "PICKUP_PENDING",
    });

    // Also set load to PICKUP_PENDING to match
    await db.load.update({
      where: { id: loadId },
      data: { status: "PICKUP_PENDING" },
    });

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${loadId}/status`,
      { body: { status: "CANCELLED" } }
    );
    const res = await callHandler(updateStatus, req, { id: loadId });
    expect(res.status).toBe(200);

    const trip = await db.trip.findUnique({ where: { id: tripId } });
    expect(trip.status).toBe("CANCELLED");
    expect(trip.loadId).toBeNull();
  });

  // ─── cancelReason recorded on trip ─────────────────────────────────────────

  it("cancel reason propagated to trip.cancelReason", async () => {
    const { loadId, tripId } = await createAssignedLoadWithTrip();

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${loadId}/status`,
      {
        body: {
          status: "CANCELLED",
          reason: "Custom shipper cancellation reason",
        },
      }
    );
    const res = await callHandler(updateStatus, req, { id: loadId });
    expect(res.status).toBe(200);

    const trip = await db.trip.findUnique({ where: { id: tripId } });
    expect(trip.cancelReason).toBe("Custom shipper cancellation reason");
  });

  // ─── Notifications on shipper cancel with active trip ──────────────────────

  it("G-M24-1: carrier + admin notified when shipper cancels ASSIGNED load", async () => {
    const { loadId } = await createAssignedLoadWithTrip();
    const {
      notifyOrganization,
      createNotificationForRole,
    } = require("@/lib/notifications");

    const req = createRequest(
      "PATCH",
      `http://localhost:3000/api/loads/${loadId}/status`,
      { body: { status: "CANCELLED", reason: "Shipper changed plans" } }
    );
    const res = await callHandler(updateStatus, req, { id: loadId });
    expect(res.status).toBe(200);

    // Carrier org receives TRIP_CANCELLED
    expect(notifyOrganization).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: seed.carrierOrg.id,
        type: "TRIP_CANCELLED",
        title: "Load cancelled by shipper",
      })
    );

    // Admin receives TRIP_CANCELLED
    expect(createNotificationForRole).toHaveBeenCalledWith(
      expect.objectContaining({
        role: "ADMIN",
        type: "TRIP_CANCELLED",
        title: "Shipper cancelled assigned load",
      })
    );
  });
});

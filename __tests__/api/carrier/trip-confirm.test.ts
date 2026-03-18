/**
 * Trip Delivery Confirmation API Tests
 *
 * Tests for POST /api/trips/[tripId]/confirm:
 * - Shipper confirms delivery after reviewing POD
 * - Updates trip to COMPLETED, load to COMPLETED with podVerified
 * - Creates DELIVERY_CONFIRMED load event
 * - Notifies carrier of confirmation
 * - Invalidates trip and load caches
 *
 * Business rules:
 * - Only shipper or admin can confirm (carrier cannot)
 * - Trip must be in DELIVERED status
 * - POD must have been submitted
 * - Cannot confirm twice (shipperConfirmed=true → 400)
 * - Optional notes field (max 1000 chars)
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
  mockApiErrors,
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
mockApiErrors();
mockLogger();
mockLoadUtils();

// Custom notifications mock with POD_VERIFIED type
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  notifyOrganization: jest.fn(async () => {}),
  notifyTruckRequest: jest.fn(async () => {}),
  getRecentNotifications: jest.fn(async () => []),
  getUnreadCount: jest.fn(async () => 0),
  markAsRead: jest.fn(async () => {}),
  NotificationType: {
    LOAD_REQUEST: "LOAD_REQUEST",
    TRUCK_REQUEST: "TRUCK_REQUEST",
    TRIP_STATUS: "TRIP_STATUS",
    TRIP_CANCELLED: "TRIP_CANCELLED",
    POD_VERIFIED: "POD_VERIFIED",
    SYSTEM: "SYSTEM",
  },
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
const {
  POST: confirmDelivery,
} = require("@/app/api/trips/[tripId]/confirm/route");

describe("Trip Delivery Confirmation", () => {
  let seed: SeedData;

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    organizationId: "shipper-org-1",
  });

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  const adminSession = createMockSession({
    userId: "admin-user-1",
    email: "admin@test.com",
    role: "ADMIN",
    organizationId: "admin-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create admin user/org
    await db.organization.create({
      data: {
        id: "admin-org-1",
        name: "Admin Org",
        type: "CARRIER_COMPANY",
        contactEmail: "admin@test.com",
        contactPhone: "+251911000003",
      },
    });

    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Admin",
        lastName: "User",
        phone: "+251911000003",
        role: "ADMIN",
        status: "ACTIVE",
        organizationId: "admin-org-1",
      },
    });

    // Set users array on organizations so include resolves users properly
    // (resolveSelect doesn't handle hasMany, so we store it directly)
    const carrierOrgRecord = await db.organization.findUnique({
      where: { id: seed.carrierOrg.id },
    });
    if (carrierOrgRecord) {
      await db.organization.update({
        where: { id: seed.carrierOrg.id },
        data: { users: [{ id: seed.carrierUser.id }] },
      });
    }

    const shipperOrgRecord = await db.organization.findUnique({
      where: { id: seed.shipperOrg.id },
    });
    if (shipperOrgRecord) {
      await db.organization.update({
        where: { id: seed.shipperOrg.id },
        data: { users: [{ id: seed.shipperUser.id }] },
      });
    }

    // Create a delivered load with POD submitted
    await db.load.create({
      data: {
        id: "delivered-load-1",
        status: "DELIVERED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Delivered cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        assignedTruckId: seed.truck.id,
        podSubmitted: true,
      },
    });

    // Create a DELIVERED trip with POD documents
    await db.trip.create({
      data: {
        id: "delivered-trip-1",
        loadId: "delivered-load-1",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "DELIVERED",
        shipperConfirmed: false,
        trackingEnabled: true,
        podDocuments: [{ id: "pod-doc-1" }],
      },
    });

    // Create a trip without POD
    await db.load.create({
      data: {
        id: "no-pod-load",
        status: "DELIVERED",
        pickupCity: "Dire Dawa",
        deliveryCity: "Mekelle",
        pickupDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 8000,
        cargoDescription: "No POD cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        podSubmitted: false,
      },
    });

    await db.trip.create({
      data: {
        id: "no-pod-trip",
        loadId: "no-pod-load",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "DELIVERED",
        shipperConfirmed: false,
        podDocuments: [],
      },
    });

    // Create an IN_TRANSIT trip (wrong status for confirm)
    await db.trip.create({
      data: {
        id: "in-transit-trip",
        loadId: seed.load.id,
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "IN_TRANSIT",
        shipperConfirmed: false,
        podDocuments: [],
      },
    });

    // Create an already-confirmed trip
    await db.load.create({
      data: {
        id: "already-confirmed-load",
        status: "COMPLETED",
        pickupCity: "Bahir Dar",
        deliveryCity: "Gondar",
        pickupDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Already confirmed cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        podSubmitted: true,
      },
    });

    await db.trip.create({
      data: {
        id: "already-confirmed-trip",
        loadId: "already-confirmed-load",
        truckId: seed.truck.id,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: "DELIVERED",
        shipperConfirmed: true,
        shipperConfirmedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        podDocuments: [{ id: "pod-doc-2" }],
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(shipperSession);
  });

  // ─── Auth & Access ─────────────────────────────────────────────────────────

  describe("Auth & Access", () => {
    it("unauthenticated → 401/500", async () => {
      setAuthSession(null);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/delivered-trip-1/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "delivered-trip-1",
      });
      expect([401, 500]).toContain(res.status);
    });

    it("carrier cannot confirm delivery → 404", async () => {
      setAuthSession(carrierSession);

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/delivered-trip-1/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "delivered-trip-1",
      });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("Trip not found");
    });

    it("admin can confirm delivery → 200", async () => {
      setAuthSession(adminSession);

      // Create a fresh delivered trip for admin confirmation
      await db.load.create({
        data: {
          id: "admin-confirm-load",
          status: "DELIVERED",
          pickupCity: "Adama",
          deliveryCity: "Jimma",
          pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "Admin confirm cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "admin-confirm-trip",
          loadId: "admin-confirm-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          podDocuments: [{ id: "pod-admin" }],
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/admin-confirm-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "admin-confirm-trip",
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── Status Guards ──────────────────────────────────────────────────────────

  describe("Status Guards", () => {
    it("trip not found → 404", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/nonexistent/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "nonexistent",
      });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toContain("Trip not found");
    });

    it("trip not DELIVERED (IN_TRANSIT) → 400", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/in-transit-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "in-transit-trip",
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("DELIVERED");
    });

    it("already confirmed → 400", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/already-confirmed-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "already-confirmed-trip",
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toContain("already been confirmed");
    });
  });

  // ─── Blueprint v1.5: POD no longer required for shipper confirmation ──────

  describe("POD Not Required (v1.5)", () => {
    it("no POD submitted → shipper can still confirm (200)", async () => {
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/no-pod-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "no-pod-trip",
      });
      // Blueprint v1.5: Shipper confirmation acts as proof of acceptance
      expect(res.status).toBe(200);
    });
  });

  // ─── Success Cases ─────────────────────────────────────────────────────────

  describe("Success", () => {
    it("shipper confirms delivery → 200 with COMPLETED status", async () => {
      // Create a fresh trip for this test
      await db.load.create({
        data: {
          id: "confirm-success-load",
          status: "DELIVERED",
          pickupCity: "Debre Zeit",
          deliveryCity: "Nazret",
          pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "Success test cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "confirm-success-trip",
          loadId: "confirm-success-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          trackingEnabled: true,
          podDocuments: [{ id: "pod-success" }],
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/confirm-success-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "confirm-success-trip",
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trip.status).toBe("COMPLETED");
      expect(data.trip.shipperConfirmed).toBe(true);
      expect(data.trip.shipperConfirmedAt).toBeDefined();
      expect(data.trip.completedAt).toBeDefined();
    });

    it("load status synced to COMPLETED with podVerified", async () => {
      await db.load.create({
        data: {
          id: "sync-load",
          status: "DELIVERED",
          pickupCity: "Sodo",
          deliveryCity: "Arba Minch",
          pickupDate: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 6000,
          cargoDescription: "Sync test cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "sync-trip",
          loadId: "sync-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          podDocuments: [{ id: "pod-sync" }],
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/sync-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "sync-trip",
      });
      expect(res.status).toBe(200);

      // Verify load was updated
      const load = await db.load.findUnique({ where: { id: "sync-load" } });
      expect(load.status).toBe("COMPLETED");
      expect(load.podVerified).toBe(true);
    });

    it("DELIVERY_CONFIRMED load event created", async () => {
      await db.load.create({
        data: {
          id: "event-load",
          status: "DELIVERED",
          pickupCity: "Harar",
          deliveryCity: "Jijiga",
          pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "FLATBED",
          weight: 7000,
          cargoDescription: "Event test cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "event-trip",
          loadId: "event-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          podDocuments: [{ id: "pod-event" }],
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/event-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "event-trip",
      });
      expect(res.status).toBe(200);

      // Verify loadEvent was created
      expect(db.loadEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            loadId: "event-load",
            eventType: "DELIVERY_CONFIRMED",
          }),
        })
      );
    });
  });

  // ─── Confirmation Notes ─────────────────────────────────────────────────────

  describe("Confirmation Notes", () => {
    it("optional notes stored in load event description", async () => {
      await db.load.create({
        data: {
          id: "notes-load",
          status: "DELIVERED",
          pickupCity: "Dessie",
          deliveryCity: "Kombolcha",
          pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Notes test cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "notes-trip",
          loadId: "notes-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          podDocuments: [{ id: "pod-notes" }],
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/notes-trip/confirm",
        { body: { notes: "All goods received in good condition" } }
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "notes-trip",
      });
      expect(res.status).toBe(200);

      expect(db.loadEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: expect.stringContaining(
              "All goods received in good condition"
            ),
          }),
        })
      );
    });

    it("empty body is allowed (notes optional)", async () => {
      await db.load.create({
        data: {
          id: "empty-body-load",
          status: "DELIVERED",
          pickupCity: "Axum",
          deliveryCity: "Lalibela",
          pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Empty body test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "empty-body-trip",
          loadId: "empty-body-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          podDocuments: [{ id: "pod-empty" }],
        },
      });

      // POST with no body
      const req = new (require("next/server").NextRequest)(
        "http://localhost:3000/api/trips/empty-body-trip/confirm",
        {
          method: "POST",
          headers: new Headers({
            Authorization: "Bearer mock-token",
          }),
        }
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "empty-body-trip",
      });
      expect(res.status).toBe(200);
    });
  });

  // ─── Cache Invalidation ─────────────────────────────────────────────────────

  describe("Cache Invalidation", () => {
    it("CacheInvalidation.trip and .load called on success", async () => {
      await db.load.create({
        data: {
          id: "cache-load",
          status: "DELIVERED",
          pickupCity: "Gambella",
          deliveryCity: "Nekemte",
          pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "Cache test cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "cache-trip",
          loadId: "cache-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          podDocuments: [{ id: "pod-cache" }],
        },
      });

      const { CacheInvalidation } = require("@/lib/cache");

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/cache-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "cache-trip",
      });
      expect(res.status).toBe(200);

      expect(CacheInvalidation.trip).toHaveBeenCalled();
      expect(CacheInvalidation.load).toHaveBeenCalled();
    });
  });

  // ─── GPS Disabled ───────────────────────────────────────────────────────────

  describe("GPS Disabled on Completion", () => {
    it("trackingEnabled set to false", async () => {
      await db.load.create({
        data: {
          id: "gps-load",
          status: "DELIVERED",
          pickupCity: "Woldia",
          deliveryCity: "Debre Markos",
          pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "GPS test cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "gps-trip",
          loadId: "gps-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          trackingEnabled: true,
          podDocuments: [{ id: "pod-gps" }],
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/gps-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "gps-trip",
      });
      expect(res.status).toBe(200);

      // Verify tracking was disabled
      const trip = await db.trip.findUnique({
        where: { id: "gps-trip" },
      });
      expect(trip.trackingEnabled).toBe(false);
    });
  });

  // ─── Notification ───────────────────────────────────────────────────────────

  describe("Notification", () => {
    it("carrier notified of delivery confirmation", async () => {
      await db.load.create({
        data: {
          id: "notif-load",
          status: "DELIVERED",
          pickupCity: "Awash",
          deliveryCity: "Semera",
          pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Notification test cargo",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "notif-trip",
          loadId: "notif-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          podDocuments: [{ id: "pod-notif" }],
        },
      });

      const { notifyOrganization } = require("@/lib/notifications");

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/notif-trip/confirm"
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "notif-trip",
      });
      expect(res.status).toBe(200);

      expect(notifyOrganization).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "POD_VERIFIED",
          title: "Delivery Confirmed",
        })
      );
    });
  });

  // ─── Validation ─────────────────────────────────────────────────────────────

  describe("Validation", () => {
    it("notes exceeding 1000 chars → 400", async () => {
      await db.load.create({
        data: {
          id: "long-notes-load",
          status: "DELIVERED",
          pickupCity: "Bishoftu",
          deliveryCity: "Modjo",
          pickupDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
          deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Long notes test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          podSubmitted: true,
        },
      });

      await db.trip.create({
        data: {
          id: "long-notes-trip",
          loadId: "long-notes-load",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          shipperConfirmed: false,
          podDocuments: [{ id: "pod-long" }],
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/long-notes-trip/confirm",
        { body: { notes: "x".repeat(1001) } }
      );
      const res = await callHandler(confirmDelivery, req, {
        tripId: "long-notes-trip",
      });
      expect(res.status).toBe(400);
    });
  });
});

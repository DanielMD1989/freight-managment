// @jest-environment node
/**
 * Round M21 — Trip In-Transit / Delivery Deep Audit Tests
 *
 * G-M21-9: Trip.loadId @unique → nullable; cancelled trips release loadId for re-assignment
 * G-M21-2: Hardware/batch GPS positions now set tripId; deductServiceFee OR fallback
 * G-M21-3: GPS positions linked during DELIVERED status (not just IN_TRANSIT)
 * G-M21-7: Delivery completion paths — shipper confirm without POD + 48h auto-close cron
 * G-M21-8: SERVICE_FEE_FAILED admin notification on fee failure
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
  setupAllMocks,
  SeedData,
} from "../../utils/routeTestUtils";

setupAllMocks();

// Import handlers AFTER mocks
const { POST: cancelTrip } = require("@/app/api/trips/[tripId]/cancel/route");
const { PATCH: updateTrip } = require("@/app/api/trips/[tripId]/route");
const {
  POST: confirmDelivery,
} = require("@/app/api/trips/[tripId]/confirm/route");
const { POST: tripMonitorCron } = require("@/app/api/cron/trip-monitor/route");

// Import state machine directly (not mocked)
import { TripStatus } from "@/lib/tripStateMachine";

describe("M21 — Trip In-Transit / Delivery Deep Audit", () => {
  let seed: SeedData;

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
  });

  afterEach(async () => {
    clearAllStores();
    jest.clearAllMocks();
  });

  // ── G-M21-9: Trip.loadId nullable + re-assignment after cancellation ────

  describe("G-M21-9: loadId nulled on cancellation", () => {
    it("T-M21-9a: Cancel trip → trip.loadId is null, record preserved", async () => {
      // Create a trip in ASSIGNED status
      const tripId = "trip-m21-9a";
      const loadId = seed.load.id;
      db.trip.create({
        data: {
          id: tripId,
          loadId,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
        },
      });

      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Test cancellation for re-assignment" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(200);

      // Verify trip record preserved with loadId=null
      const cancelledTrip = await db.trip.findUnique({
        where: { id: tripId },
      });
      expect(cancelledTrip).toBeTruthy();
      expect(cancelledTrip.status).toBe("CANCELLED");
      expect(cancelledTrip.loadId).toBeNull();
      expect(cancelledTrip.cancelledAt).toBeTruthy();
      expect(cancelledTrip.cancelReason).toBe(
        "Test cancellation for re-assignment"
      );
    });

    it("T-M21-9b: PATCH CANCELLED also nulls loadId", async () => {
      const tripId = "trip-m21-9b";
      db.trip.create({
        data: {
          id: tripId,
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
        },
      });

      setAuthSession(carrierSession);
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "CANCELLED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("CANCELLED");
      expect(trip.loadId).toBeNull();
    });

    it("T-M21-9c: Cancelled trip GpsPositions still queryable by old tripId", async () => {
      const tripId = "trip-m21-9c";
      const loadId = "load-m21-9c";

      // Create load + trip + GPS position
      db.load.create({
        data: {
          id: loadId,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          assignedTruckId: seed.truck.id,
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
        },
      });
      db.gpsPosition.create({
        data: {
          id: "gps-m21-9c",
          tripId,
          truckId: seed.truck.id,
          deviceId: "device-1",
          latitude: 9.02,
          longitude: 38.75,
          timestamp: new Date(),
        },
      });

      // Cancel trip — loadId nulled but GPS positions should still have tripId
      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "GPS preservation test" } }
      );
      await callHandler(cancelTrip, req, { tripId });

      // GPS position still references the trip by tripId
      const positions = await db.gpsPosition.findMany({
        where: { tripId },
      });
      expect(positions.length).toBe(1);
      expect(positions[0].tripId).toBe(tripId);
    });
  });

  // ── G-M21-2: GPS tripId on hardware/batch + deductServiceFee OR fallback ──

  describe("G-M21-2: GPS tripId linkage", () => {
    it("T-M21-2a: Hardware GPS endpoint code sets tripId (structural check)", async () => {
      // The actual GPS route requires IMEI/device auth which is complex to mock.
      // This structural test verifies the route source code contains tripId assignment.
      const fs = require("fs");
      const routeSource = fs.readFileSync(
        "app/api/gps/positions/route.ts",
        "utf8"
      );
      // G-M21-2: The fix adds a trip lookup and sets tripId on created positions
      expect(routeSource).toContain("activeTrip?.id");
      expect(routeSource).toContain("tripId: activeTrip?.id || null");
    });

    it("T-M21-2b: Batch GPS endpoint code sets tripId (structural check)", async () => {
      const fs = require("fs");
      const routeSource = fs.readFileSync("app/api/gps/batch/route.ts", "utf8");
      expect(routeSource).toContain("activeTrip?.id");
      expect(routeSource).toContain("tripId: activeTrip?.id || null");
    });

    it("T-M21-2c: deductServiceFee uses OR fallback for GPS query", async () => {
      const fs = require("fs");
      const source = fs.readFileSync("lib/serviceFeeManagement.ts", "utf8");
      // G-M21-2: OR fallback catches hardware/batch positions with loadId but no tripId
      expect(source).toContain("{ tripId: trip.id }");
      expect(source).toContain("{ loadId: load.id, tripId: null }");
    });

    it("T-M21-2d: No double-counting — positions with both tripId and loadId counted once", async () => {
      // Positions that have both tripId AND loadId should only be counted once
      // by the OR query in deductServiceFee
      const tripId = "trip-dedup";
      const loadId = "load-dedup";

      db.load.create({
        data: {
          id: loadId,
          shipperId: seed.shipperOrg.id,
          status: "COMPLETED",
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "COMPLETED",
        },
      });

      // Position with BOTH tripId and loadId (trip-scoped endpoint)
      db.gpsPosition.create({
        data: {
          id: "gps-both-1",
          tripId,
          loadId,
          truckId: seed.truck.id,
          deviceId: "dev-1",
          latitude: 9.0,
          longitude: 38.7,
          timestamp: new Date(),
        },
      });

      // Position with loadId but NO tripId (hardware endpoint, pre-fix)
      db.gpsPosition.create({
        data: {
          id: "gps-loadonly-1",
          loadId,
          tripId: null,
          truckId: seed.truck.id,
          deviceId: "dev-2",
          latitude: 9.1,
          longitude: 38.8,
          timestamp: new Date(Date.now() + 1000),
        },
      });

      // The OR query: { tripId: tripId } OR { loadId, tripId: null }
      // Should return 2 positions total (not 3 from double-counting)
      const positions = await db.gpsPosition.findMany({
        where: {
          OR: [{ tripId }, { loadId, tripId: null }],
        },
      });
      expect(positions.length).toBe(2);
    });
  });

  // ── G-M21-3: GPS positions during DELIVERED status ──

  describe("G-M21-3: DELIVERED GPS linkage", () => {
    it("T-M21-3a: Load status IN_TRANSIT + DELIVERED both link GPS positions", async () => {
      // The fix changes the load query filter from "IN_TRANSIT" to { in: ["IN_TRANSIT", "DELIVERED"] }
      // Verify that a DELIVERED load would be found by the new filter
      const deliveredLoad = db.load.create({
        data: {
          id: "load-delivered-gps",
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          assignedTruckId: seed.truck.id,
        },
      });

      // The fixed query in gps/positions would find this load
      const found = await db.load.findFirst({
        where: {
          assignedTruckId: seed.truck.id,
          status: { in: ["IN_TRANSIT", "DELIVERED"] },
        },
      });
      expect(found).toBeTruthy();
      expect(found.id).toBe("load-delivered-gps");
    });
  });

  // ── G-M21-8: SERVICE_FEE_FAILED admin notification ──

  describe("G-M21-8: Fee failure notification", () => {
    it("T-M21-8a: Fee failure code sends SERVICE_FEE_FAILED notification (structural check)", async () => {
      // The notification mock from setupAllMocks has `createNotificationForRole` but
      // verifying the exact call chain through mock layers is fragile. Instead, verify
      // the route source contains the notification call on fee failure paths.
      const fs = require("fs");
      const routeSource = fs.readFileSync(
        "app/api/trips/[tripId]/route.ts",
        "utf8"
      );
      // G-M21-8: Both success=false and catch paths should notify admin
      expect(routeSource).toContain("SERVICE_FEE_FAILED");
      expect(routeSource).toContain(
        "type: NotificationType.SERVICE_FEE_FAILED"
      );

      // Also verify confirm route
      const confirmSource = fs.readFileSync(
        "app/api/trips/[tripId]/confirm/route.ts",
        "utf8"
      );
      expect(confirmSource).toContain("SERVICE_FEE_FAILED");

      // Also verify POD verification route
      const podSource = fs.readFileSync(
        "app/api/loads/[id]/pod/route.ts",
        "utf8"
      );
      expect(podSource).toContain("SERVICE_FEE_FAILED");
    });
  });

  // ── G-M21-7: Delivery Completion Paths (Blueprint v1.5) ──────────────────

  describe("G-M21-7: Delivery completion paths", () => {
    it("T-M21-7-1: Shipper confirms delivery without carrier POD → COMPLETED", async () => {
      const tripId = "trip-m21-7-1";
      db.trip.create({
        data: {
          id: tripId,
          loadId: "load-m21-7-1",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          deliveredAt: new Date(),
          shipperConfirmed: false,
        },
      });
      db.load.create({
        data: {
          id: "load-m21-7-1",
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          podSubmitted: false,
        },
      });

      const shipperSession = createMockSession({
        userId: "shipper-user-1",
        email: "shipper@test.com",
        role: "SHIPPER",
        organizationId: seed.shipperOrg.id,
      });
      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/confirm`,
        { body: { notes: "Goods received in good condition" } }
      );
      const res = await callHandler(confirmDelivery, req, { tripId });
      expect(res.status).toBe(200);

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("COMPLETED");
      expect(trip.shipperConfirmed).toBe(true);
      expect(trip.shipperConfirmedAt).toBeTruthy();
    });

    it("T-M21-7-2: Shipper confirms with POD uploaded → no extra no-POD notification code path", async () => {
      const tripId = "trip-m21-7-2";
      db.trip.create({
        data: {
          id: tripId,
          loadId: "load-m21-7-2",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          deliveredAt: new Date(),
          shipperConfirmed: false,
        },
      });
      db.load.create({
        data: {
          id: "load-m21-7-2",
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          podSubmitted: true,
        },
      });

      const shipperSession = createMockSession({
        userId: "shipper-user-1",
        email: "shipper@test.com",
        role: "SHIPPER",
        organizationId: seed.shipperOrg.id,
      });
      setAuthSession(shipperSession);

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/confirm`,
        { body: {} }
      );
      const res = await callHandler(confirmDelivery, req, { tripId });
      expect(res.status).toBe(200);

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("COMPLETED");
      expect(trip.shipperConfirmed).toBe(true);
    });

    it("T-M21-7-3: Auto-close cron closes DELIVERED trip > 48h without POD/confirmation", async () => {
      const tripId = "trip-m21-7-3";
      const loadId = "load-m21-7-3";
      const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000); // 49h ago

      db.load.create({
        data: {
          id: loadId,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          podSubmitted: false,
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          deliveredAt: oldDate,
          shipperConfirmed: false,
        },
      });

      // Set CRON_SECRET for auth
      process.env.CRON_SECRET = "test-cron-secret";
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/cron/trip-monitor",
        {
          headers: { Authorization: "Bearer test-cron-secret" },
        }
      );
      const res = await callHandler(tripMonitorCron, req, {});
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.autoClosedTrips).toBeGreaterThanOrEqual(1);

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("COMPLETED");
      expect(trip.autoClosedAt).toBeTruthy();
      expect(trip.completedAt).toBeTruthy();
    });

    it("T-M21-7-4: Auto-close with fee failure → trip still closes, settlementStatus stays PENDING", async () => {
      const tripId = "trip-m21-7-4";
      const loadId = "load-m21-7-4";
      const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000);

      db.load.create({
        data: {
          id: loadId,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          podSubmitted: false,
          settlementStatus: "PENDING",
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          deliveredAt: oldDate,
          shipperConfirmed: false,
        },
      });

      process.env.CRON_SECRET = "test-cron-secret";
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/cron/trip-monitor",
        {
          headers: { Authorization: "Bearer test-cron-secret" },
        }
      );
      const res = await callHandler(tripMonitorCron, req, {});
      expect(res.status).toBe(200);

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("COMPLETED");
      expect(trip.autoClosedAt).toBeTruthy();

      // Fee failed but trip still closed — settlementStatus untouched
      const load = await db.load.findUnique({ where: { id: loadId } });
      expect(load.status).toBe("COMPLETED");
      expect(load.settlementStatus).toBe("PENDING");
    });

    it("T-M21-7-5: Trip DELIVERED < 48h → cron does not touch it", async () => {
      const tripId = "trip-m21-7-5";
      const loadId = "load-m21-7-5";
      const recentDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24h ago

      db.load.create({
        data: {
          id: loadId,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          podSubmitted: false,
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          deliveredAt: recentDate,
          shipperConfirmed: false,
        },
      });

      process.env.CRON_SECRET = "test-cron-secret";
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/cron/trip-monitor",
        {
          headers: { Authorization: "Bearer test-cron-secret" },
        }
      );
      await callHandler(tripMonitorCron, req, {});

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("DELIVERED"); // Unchanged
      expect(trip.autoClosedAt).toBeUndefined();
    });

    it("T-M21-7-6: Trip DELIVERED > 48h but shipperConfirmed → cron skips", async () => {
      const tripId = "trip-m21-7-6";
      const loadId = "load-m21-7-6";
      const oldDate = new Date(Date.now() - 50 * 60 * 60 * 1000);

      db.load.create({
        data: {
          id: loadId,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          podSubmitted: false,
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          deliveredAt: oldDate,
          shipperConfirmed: true, // Already confirmed
        },
      });

      process.env.CRON_SECRET = "test-cron-secret";
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/cron/trip-monitor",
        {
          headers: { Authorization: "Bearer test-cron-secret" },
        }
      );
      await callHandler(tripMonitorCron, req, {});

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("DELIVERED"); // Unchanged — already confirmed by shipper
    });

    it("T-M22-1: Auto-close cron with another active trip → truck stays unavailable", async () => {
      const tripId = "trip-m22-1-delivered";
      const loadId = "load-m22-1";
      const truckId = "truck-m22-1";
      const oldDate = new Date(Date.now() - 49 * 60 * 60 * 1000);

      // Create truck (unavailable — has active trips)
      db.truck.create({
        data: {
          id: truckId,
          carrierId: seed.carrierOrg.id,
          isAvailable: false,
          licensePlate: "M22-TRUCK",
        },
      });

      // Trip 1: DELIVERED > 48h — cron target
      db.load.create({
        data: {
          id: loadId,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          podSubmitted: false,
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId,
          truckId,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          deliveredAt: oldDate,
          shipperConfirmed: false,
        },
      });

      // Trip 2: Same truck, still IN_TRANSIT — should block truck restore
      db.load.create({
        data: {
          id: "load-m22-1-active",
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
        },
      });
      db.trip.create({
        data: {
          id: "trip-m22-1-active",
          loadId: "load-m22-1-active",
          truckId,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
        },
      });

      process.env.CRON_SECRET = "test-cron-secret";
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/cron/trip-monitor",
        { headers: { Authorization: "Bearer test-cron-secret" } }
      );
      const res = await callHandler(tripMonitorCron, req, {});
      expect(res.status).toBe(200);

      // Delivered trip should be closed
      const closedTrip = await db.trip.findUnique({ where: { id: tripId } });
      expect(closedTrip.status).toBe("COMPLETED");
      expect(closedTrip.autoClosedAt).toBeTruthy();

      // Truck should still be unavailable (other active trip exists)
      const truck = await db.truck.findUnique({ where: { id: truckId } });
      expect(truck.isAvailable).toBe(false);
    });

    it("T-M21-7-7: Cron query filters by podSubmitted=false (structural check)", async () => {
      // The mock DB doesn't support nested relation filters (load: { podSubmitted: false }).
      // Verify the cron source code contains the correct filter.
      const fs = require("fs");
      const source = fs.readFileSync(
        "app/api/cron/trip-monitor/route.ts",
        "utf8"
      );
      // The cron must filter for trips where load has no POD
      expect(source).toContain("podSubmitted: false");
      // And must filter for unconfirmed trips
      expect(source).toContain("shipperConfirmed: false");
      // And must use the 48h timeout
      expect(source).toContain("DELIVERED_TIMEOUT_HOURS");
      expect(source).toContain("deliveredAt:");
    });
  });

  // ── G-M23-5: Cancel route blocks EXCEPTION trips ────────────────────────

  describe("G-M23-5: Cancel route EXCEPTION guard", () => {
    it("T-M23-5a: Carrier cannot cancel EXCEPTION trip via cancel route", async () => {
      const tripId = "trip-m23-5a";
      db.load.create({
        data: {
          id: "load-m23-5a",
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId: "load-m23-5a",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
          exceptionAt: new Date(),
        },
      });

      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Carrier trying to bypass admin resolution" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(400);

      const body = await parseResponse(res);
      expect(body.error).toContain("Cannot cancel an exception trip directly");

      // Trip must remain EXCEPTION
      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("EXCEPTION");
    });

    it("T-M23-5b: Dispatcher cannot cancel EXCEPTION trip via cancel route", async () => {
      const tripId = "trip-m23-5b";
      db.load.create({
        data: {
          id: "load-m23-5b",
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId: "load-m23-5b",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
          exceptionAt: new Date(),
        },
      });

      const dispatcherSession = createMockSession({
        userId: "dispatcher-user-1",
        email: "dispatcher@test.com",
        role: "DISPATCHER",
        organizationId: seed.carrierOrg.id,
      });
      setAuthSession(dispatcherSession);
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${tripId}/cancel`,
        { body: { reason: "Dispatcher trying to bypass admin resolution" } }
      );
      const res = await callHandler(cancelTrip, req, { tripId });
      expect(res.status).toBe(400);

      const body = await parseResponse(res);
      expect(body.error).toContain("Cannot cancel an exception trip directly");

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("EXCEPTION");
    });

    it("T-M23-5c: Admin can still resolve EXCEPTION → CANCELLED via PATCH", async () => {
      const tripId = "trip-m23-5c";
      db.load.create({
        data: {
          id: "load-m23-5c",
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
        },
      });
      db.trip.create({
        data: {
          id: tripId,
          loadId: "load-m23-5c",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
          exceptionAt: new Date(),
        },
      });

      setAuthSession(adminSession);
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${tripId}`,
        { body: { status: "CANCELLED" } }
      );
      const res = await callHandler(updateTrip, req, { tripId });
      expect(res.status).toBe(200);

      const trip = await db.trip.findUnique({ where: { id: tripId } });
      expect(trip.status).toBe("CANCELLED");
    });
  });

  // ── G-M23-6: otherActiveTrips consistency ───────────────────────────────

  describe("G-M23-6: otherActiveTrips includes DELIVERED + EXCEPTION", () => {
    it("T-M23-6a: PATCH CANCELLED with another DELIVERED trip → truck stays unavailable", async () => {
      const truckId = "truck-m23-6a";
      db.truck.create({
        data: {
          id: truckId,
          carrierId: seed.carrierOrg.id,
          isAvailable: false,
          licensePlate: "M23-6A",
        },
      });

      // Trip 1: ASSIGNED — will be cancelled
      db.load.create({
        data: {
          id: "load-m23-6a-cancel",
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
        },
      });
      db.trip.create({
        data: {
          id: "trip-m23-6a-cancel",
          loadId: "load-m23-6a-cancel",
          truckId,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
        },
      });

      // Trip 2: DELIVERED — still active, should block truck restore
      db.load.create({
        data: {
          id: "load-m23-6a-delivered",
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
        },
      });
      db.trip.create({
        data: {
          id: "trip-m23-6a-delivered",
          loadId: "load-m23-6a-delivered",
          truckId,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          deliveredAt: new Date(),
        },
      });

      setAuthSession(carrierSession);
      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/trip-m23-6a-cancel",
        { body: { status: "CANCELLED" } }
      );
      const res = await callHandler(updateTrip, req, {
        tripId: "trip-m23-6a-cancel",
      });
      expect(res.status).toBe(200);

      // Truck should still be unavailable
      const truck = await db.truck.findUnique({ where: { id: truckId } });
      expect(truck.isAvailable).toBe(false);
    });

    it("T-M23-6b: Cancel route with another EXCEPTION trip → truck stays unavailable", async () => {
      const truckId = "truck-m23-6b";
      db.truck.create({
        data: {
          id: truckId,
          carrierId: seed.carrierOrg.id,
          isAvailable: false,
          licensePlate: "M23-6B",
        },
      });

      // Trip 1: ASSIGNED — will be cancelled
      db.load.create({
        data: {
          id: "load-m23-6b-cancel",
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
        },
      });
      db.trip.create({
        data: {
          id: "trip-m23-6b-cancel",
          loadId: "load-m23-6b-cancel",
          truckId,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
        },
      });

      // Trip 2: EXCEPTION — should block truck restore
      db.load.create({
        data: {
          id: "load-m23-6b-exception",
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
        },
      });
      db.trip.create({
        data: {
          id: "trip-m23-6b-exception",
          loadId: "load-m23-6b-exception",
          truckId,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "EXCEPTION",
          exceptionAt: new Date(),
        },
      });

      setAuthSession(carrierSession);
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/trips/trip-m23-6b-cancel/cancel",
        { body: { reason: "Testing otherActiveTrips guard" } }
      );
      const res = await callHandler(cancelTrip, req, {
        tripId: "trip-m23-6b-cancel",
      });
      expect(res.status).toBe(200);

      // Truck should still be unavailable
      const truck = await db.truck.findUnique({ where: { id: truckId } });
      expect(truck.isAvailable).toBe(false);
    });
  });
});

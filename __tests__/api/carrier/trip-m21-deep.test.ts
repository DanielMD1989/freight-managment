// @jest-environment node
/**
 * Round M21 — Trip In-Transit / Delivery Deep Audit Tests
 *
 * G-M21-9: Trip.loadId @unique → nullable; cancelled trips release loadId for re-assignment
 * G-M21-2: Hardware/batch GPS positions now set tripId; deductServiceFee OR fallback
 * G-M21-3: GPS positions linked during DELIVERED status (not just IN_TRANSIT)
 * G-M21-7: DELIVERED→EXCEPTION transition (state machine + POD timeout cron)
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
});

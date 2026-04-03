/**
 * §12 Ratings & Reviews — API Tests
 *
 * Tests: POST /api/trips/[tripId]/rate, GET /api/trips/[tripId]/rate,
 *        GET /api/organizations/[id]/ratings
 */

import { db } from "@/lib/db";
import {
  createRequest,
  callHandler,
  parseResponse,
  seedTestData,
  setAuthSession,
} from "../utils/routeTestUtils";

// Local mocks — jest.mock is hoisted, must be in the test file directly
jest.mock("@/lib/auth", () => ({
  requireAuth: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    return getAuthSession();
  }),
  requireActiveUser: jest.fn(async () => {
    const { getAuthSession } = require("../utils/routeTestUtils");
    const session = getAuthSession();
    return { ...session, dbStatus: session?.status };
  }),
}));
jest.mock("@/lib/csrf", () => ({
  validateCSRFWithMobile: jest.fn(async () => null),
}));
jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  zodErrorResponse: jest.fn((error: unknown) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: error },
      { status: 400 }
    );
  }),
}));
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  notifyOrganization: jest.fn(async () => {}),
  NotificationType: {
    RATING_RECEIVED: "RATING_RECEIVED",
    RATING_REQUESTED: "RATING_REQUESTED",
  },
}));
jest.mock("@/lib/cache", () => ({
  CacheInvalidation: {
    trip: jest.fn(async () => {}),
    load: jest.fn(async () => {}),
    organization: jest.fn(async () => {}),
  },
}));

const { POST, GET } = require("@/app/api/trips/[tripId]/rate/route");

let seed: Awaited<ReturnType<typeof seedTestData>>;

beforeAll(async () => {
  seed = await seedTestData();
  // Set default session as shipper
  setAuthSession({
    userId: seed.shipperUser.id,
    email: seed.shipperUser.email,
    role: "SHIPPER",
    organizationId: seed.shipperOrg.id,
    status: "ACTIVE",
  });
});

// Helper: create a DELIVERED trip for rating tests
async function createDeliveredTrip(id: string) {
  const load = await db.load.create({
    data: {
      id: `load-${id}`,
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      truckType: "FLATBED",
      weight: 5000,
      status: "DELIVERED",
      cargoDescription: "Test cargo",
      shipperId: seed.shipperOrg.id,
    },
  });

  const truck = await db.truck.create({
    data: {
      id: `truck-${id}`,
      licensePlate: `RT-${id}`,
      truckType: "FLATBED",
      capacity: 10000,
      carrierId: seed.carrierOrg.id,
      approvalStatus: "APPROVED",
    },
  });

  const trip = await db.trip.create({
    data: {
      id: `trip-${id}`,
      status: "DELIVERED",
      loadId: load.id,
      truckId: truck.id,
      carrierId: seed.carrierOrg.id,
      shipperId: seed.shipperOrg.id,
      deliveredAt: new Date(),
    },
  });

  return { load, truck, trip };
}

describe("§12 Ratings & Reviews", () => {
  describe("POST /api/trips/[tripId]/rate", () => {
    it("T1: Shipper rates carrier on DELIVERED trip — 201", async () => {
      const { trip } = await createDeliveredTrip("t1");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 5, comment: "Great service!" } }
      );
      const res = await callHandler(POST, req, { tripId: trip.id });
      expect(res.status).toBe(201);
      const data = await parseResponse(res);
      expect(data.rating.stars).toBe(5);
      expect(data.rating.comment).toBe("Great service!");
      expect(data.rating.raterRole).toBe("SHIPPER");
    });

    it("T2: Carrier rates shipper on DELIVERED trip — 201", async () => {
      const { trip } = await createDeliveredTrip("t2");
      // Switch to carrier session
      setAuthSession({
        userId: seed.carrierUser.id,
        email: seed.carrierUser.email,
        role: "CARRIER",
        organizationId: seed.carrierOrg.id,
        status: "ACTIVE",
      });
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 4 } }
      );
      const res = await callHandler(POST, req, { tripId: trip.id });
      // Restore shipper session
      setAuthSession({
        userId: seed.shipperUser.id,
        email: seed.shipperUser.email,
        role: "SHIPPER",
        organizationId: seed.shipperOrg.id,
        status: "ACTIVE",
      });
      expect(res.status).toBe(201);
      const data = await parseResponse(res);
      expect(data.rating.stars).toBe(4);
      expect(data.rating.raterRole).toBe("CARRIER");
    });

    it("T3: Both parties rate same trip independently — 201+201", async () => {
      const { trip } = await createDeliveredTrip("t3");

      // Shipper rates
      const req1 = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 5 } }
      );
      const res1 = await callHandler(POST, req1, { tripId: trip.id });
      expect(res1.status).toBe(201);

      // Carrier rates
      setAuthSession({
        userId: seed.carrierUser.id,
        email: seed.carrierUser.email,
        role: "CARRIER",
        organizationId: seed.carrierOrg.id,
        status: "ACTIVE",
      });
      const req2 = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 3 } }
      );
      const res2 = await callHandler(POST, req2, { tripId: trip.id });
      // Restore shipper session
      setAuthSession({
        userId: seed.shipperUser.id,
        email: seed.shipperUser.email,
        role: "SHIPPER",
        organizationId: seed.shipperOrg.id,
        status: "ACTIVE",
      });
      expect(res2.status).toBe(201);
    });

    it("T4: Stars boundary 1 and 5 — 201", async () => {
      const { trip: trip1 } = await createDeliveredTrip("t4a");
      const req1 = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip1.id}/rate`,
        { body: { stars: 1 } }
      );
      expect((await callHandler(POST, req1, { tripId: trip1.id })).status).toBe(
        201
      );

      const { trip: trip2 } = await createDeliveredTrip("t4b");
      const req2 = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip2.id}/rate`,
        { body: { stars: 5, comment: "Perfect!" } }
      );
      expect((await callHandler(POST, req2, { tripId: trip2.id })).status).toBe(
        201
      );
    });

    it("T5: Comment optional — 201 without comment", async () => {
      const { trip } = await createDeliveredTrip("t5");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 3 } }
      );
      const res = await callHandler(POST, req, { tripId: trip.id });
      expect(res.status).toBe(201);
      const data = await parseResponse(res);
      expect(data.rating.comment).toBeNull();
    });

    it("T6: Stars < 1 — 400", async () => {
      const { trip } = await createDeliveredTrip("t6");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 0 } }
      );
      const res = await callHandler(POST, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });

    it("T7: Stars > 5 — 400", async () => {
      const { trip } = await createDeliveredTrip("t7");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 6 } }
      );
      const res = await callHandler(POST, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });

    it("T8: Non-integer stars — 400", async () => {
      const { trip } = await createDeliveredTrip("t8");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 3.5 } }
      );
      const res = await callHandler(POST, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });

    it("T9: Comment > 300 chars — 400", async () => {
      const { trip } = await createDeliveredTrip("t9");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 4, comment: "x".repeat(301) } }
      );
      const res = await callHandler(POST, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });

    it("T13: Duplicate rating — 409", async () => {
      const { trip } = await createDeliveredTrip("t13");
      // First rating
      const req1 = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 4 } }
      );
      await callHandler(POST, req1, { tripId: trip.id });

      // Second rating — duplicate
      const req2 = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 5 } }
      );
      const res2 = await callHandler(POST, req2, { tripId: trip.id });
      expect(res2.status).toBe(409);
    });

    it("T14: Rate trip in ASSIGNED status — 400", async () => {
      const trip = await db.trip.create({
        data: {
          id: "trip-t14",
          status: "ASSIGNED",
          truckId: "truck-t14-x",
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
        },
      });
      await db.truck.create({
        data: {
          id: "truck-t14-x",
          licensePlate: "RT-T14X",
          truckType: "FLATBED",
          capacity: 10000,
          carrierId: seed.carrierOrg.id,
        },
      });
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 4 } }
      );
      const res = await callHandler(POST, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });

    it("T17: averageRating updated on rated org", async () => {
      const { trip } = await createDeliveredTrip("t17");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 4 } }
      );
      await callHandler(POST, req, { tripId: trip.id });

      const org = await db.organization.findUnique({
        where: { id: seed.carrierOrg.id },
      });
      expect(org.averageRating).toBeDefined();
      expect(org.totalRatings).toBeGreaterThan(0);
    });

    it("T20: RATING_RECEIVED notification created", async () => {
      const { trip } = await createDeliveredTrip("t20");
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 5, comment: "Excellent!" } }
      );
      await callHandler(POST, req, { tripId: trip.id });

      const { notifyOrganization } = require("@/lib/notifications");
      expect(notifyOrganization).toHaveBeenCalled();
    });
  });

  describe("GET /api/trips/[tripId]/rate", () => {
    it("T21: Returns ratings for trip", async () => {
      const { trip } = await createDeliveredTrip("t21");
      // Submit a rating first
      const postReq = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/rate`,
        { body: { stars: 4 } }
      );
      await callHandler(POST, postReq, { tripId: trip.id });

      // Get ratings
      const getReq = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/rate`
      );
      const res = await callHandler(GET, getReq, { tripId: trip.id });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.ratings.length).toBeGreaterThan(0);
      expect(data.myRating).toBeDefined();
      expect(data.myRating.stars).toBe(4);
    });

    it("T22: Empty array when no ratings", async () => {
      const { trip } = await createDeliveredTrip("t22");
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${trip.id}/rate`
      );
      const res = await callHandler(GET, req, { tripId: trip.id });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.ratings).toHaveLength(0);
      expect(data.myRating).toBeNull();
    });
  });
});

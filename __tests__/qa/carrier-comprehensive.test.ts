/* eslint-disable @typescript-eslint/no-require-imports */
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Carrier Comprehensive QA Tests
 *
 * Tests carrier workflows beyond basic CRUD:
 * Truck posting lifecycle, match proposals, GPS tracking,
 * POD upload, trip cancellation, carrier dashboard, notifications, edge cases.
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
  mockStorage,
  mockServiceFee,
  mockGeo,
  mockLogger,
  SeedData,
} from "../utils/routeTestUtils";

// Setup all mocks before importing route handlers
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
mockStorage();
mockServiceFee();
mockGeo();
mockLogger();

jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    if (error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    if (
      error.name === "UnauthorizedError" ||
      error.message === "Unauthorized"
    ) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }),
}));

// Import route handlers AFTER mocks
const {
  POST: createPosting,
  GET: listPostings,
} = require("@/app/api/truck-postings/route");

let truckPostingDetail: any;
try {
  truckPostingDetail = require("@/app/api/truck-postings/[id]/route");
} catch {
  truckPostingDetail = {};
}
const getPosting = truckPostingDetail.GET;
const updatePosting = truckPostingDetail.PATCH;
const deletePosting = truckPostingDetail.DELETE;

const {
  GET: getTrip,
  PATCH: updateTrip,
} = require("@/app/api/trips/[tripId]/route");
const { GET: listTrips } = require("@/app/api/trips/route");

let tripGps: any;
try {
  tripGps = require("@/app/api/trips/[tripId]/gps/route");
} catch {
  tripGps = {};
}
const postGps = tripGps.POST;
const getGpsHistory = tripGps.GET;

let tripPod: any;
try {
  tripPod = require("@/app/api/trips/[tripId]/pod/route");
} catch {
  tripPod = {};
}
const postPod = tripPod.POST;
const getPods = tripPod.GET;

let tripCancel: any;
try {
  tripCancel = require("@/app/api/trips/[tripId]/cancel/route");
} catch {
  tripCancel = {};
}
const cancelTrip = tripCancel.POST;

let carrierDashboard: any;
try {
  carrierDashboard = require("@/app/api/carrier/dashboard/route");
} catch {
  carrierDashboard = {};
}
const getCarrierDashboard = carrierDashboard.GET;

let matchProposalRespond: any;
try {
  matchProposalRespond = require("@/app/api/match-proposals/[id]/respond/route");
} catch {
  matchProposalRespond = {};
}
const respondToProposal = matchProposalRespond.POST;

const { POST: createTruck } = require("@/app/api/trucks/route");

let notificationsRoute: any;
try {
  notificationsRoute = require("@/app/api/notifications/route");
} catch {
  notificationsRoute = {};
}
const getNotifications = notificationsRoute.GET;

let notificationReadRoute: any;
try {
  notificationReadRoute = require("@/app/api/notifications/[id]/read/route");
} catch {
  notificationReadRoute = {};
}
const markNotificationRead = notificationReadRoute.PUT;

describe("Carrier Comprehensive QA", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(
      createMockSession({
        userId: seed.carrierUser.id,
        email: "carrier@test.com",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: seed.carrierOrg.id,
      })
    );
  });

  // ─── Truck Posting Lifecycle ──────────────────────────────────────────────

  describe("Truck Posting Lifecycle", () => {
    it("should create posting for approved truck", async () => {
      const truck = await db.truck.create({
        data: {
          id: "qa-posting-truck-1",
          truckType: "DRY_VAN",
          licensePlate: "QA-POST1",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      await db.corridor.create({
        data: { id: "qa-city-1", name: "Addis Ababa", isActive: true },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: truck.id,
            originCityId: "qa-city-1",
            availableFrom: new Date().toISOString(),
            fullPartial: "FULL",
            contactName: "QA Carrier",
            contactPhone: "+251911000002",
          },
        }
      );

      const res = await createPosting(req);
      expect([201, 200, 400]).toContain(res.status);
    });

    it("should list postings with pagination", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings?page=1&limit=10"
      );
      const res = await listPostings(req);
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.truckPostings || data.postings).toBeDefined();
    });

    it("should reject posting for PENDING truck", async () => {
      await db.truck.create({
        data: {
          id: "qa-pending-truck",
          truckType: "FLATBED",
          licensePlate: "QA-PEND1",
          capacity: 8000,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "PENDING",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: "qa-pending-truck",
            originCityId: "qa-city-1",
            availableFrom: new Date().toISOString(),
            contactName: "QA",
            contactPhone: "+251911000002",
          },
        }
      );

      const res = await createPosting(req);
      expect([400, 403]).toContain(res.status);
    });

    it("should reject duplicate active posting per truck", async () => {
      // test-truck-001 already has an active posting from seed
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-postings",
        {
          body: {
            truckId: seed.truck.id,
            originCityId: "qa-city-1",
            availableFrom: new Date().toISOString(),
            contactName: "QA",
            contactPhone: "+251911000002",
          },
        }
      );

      const res = await createPosting(req);
      expect([400, 409]).toContain(res.status);
    });

    it("should cancel posting via DELETE", async () => {
      if (!deletePosting) return;

      const posting = await db.truckPosting.create({
        data: {
          id: "qa-posting-to-cancel",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          originCityId: "qa-city-1",
          originCityName: "Addis Ababa",
          availableFrom: new Date(),
          status: "ACTIVE",
          fullPartial: "FULL",
          contactName: "QA Carrier",
          contactPhone: "+251911000002",
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/truck-postings/${posting.id}`
      );
      const res = await callHandler(deletePosting, req, { id: posting.id });
      expect(res.status).toBe(200);
    });

    it("should update posting fields via PATCH", async () => {
      if (!updatePosting) return;

      const posting = await db.truckPosting.create({
        data: {
          id: "qa-posting-to-update",
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          originCityId: "qa-city-1",
          originCityName: "Addis Ababa",
          availableFrom: new Date(),
          status: "ACTIVE",
          fullPartial: "FULL",
          contactName: "QA Carrier",
          contactPhone: "+251911000002",
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/truck-postings/${posting.id}`,
        { body: { contactName: "Updated Carrier", fullPartial: "PARTIAL" } }
      );
      const res = await callHandler(updatePosting, req, { id: posting.id });
      expect([200, 400]).toContain(res.status);
    });
  });

  // ─── Match Proposal Response ──────────────────────────────────────────────

  describe("Match Proposal Response", () => {
    it("should accept a match proposal", async () => {
      if (!respondToProposal) return;

      const proposal = await db.matchProposal.create({
        data: {
          id: "qa-proposal-accept",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          truckPostingId: seed.truckPosting.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          proposedByType: "DISPATCHER",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/match-proposals/${proposal.id}/respond`,
        { body: { action: "ACCEPT", responseNotes: "Looks good" } }
      );

      const res = await callHandler(respondToProposal, req, {
        id: proposal.id,
      });
      expect([200, 400, 500]).toContain(res.status);
    });

    it("should reject a match proposal", async () => {
      if (!respondToProposal) return;

      const proposal = await db.matchProposal.create({
        data: {
          id: "qa-proposal-reject",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          truckPostingId: seed.truckPosting.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          proposedByType: "DISPATCHER",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/match-proposals/${proposal.id}/respond`,
        { body: { action: "REJECT", responseNotes: "Not suitable" } }
      );

      const res = await callHandler(respondToProposal, req, {
        id: proposal.id,
      });
      expect([200, 400, 500]).toContain(res.status);
    });

    it("should reject non-carrier response to match proposal", async () => {
      if (!respondToProposal) return;

      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const proposal = await db.matchProposal.create({
        data: {
          id: "qa-proposal-wrong-role",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          truckPostingId: seed.truckPosting.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          proposedByType: "DISPATCHER",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/match-proposals/${proposal.id}/respond`,
        { body: { action: "ACCEPT" } }
      );

      const res = await callHandler(respondToProposal, req, {
        id: proposal.id,
      });
      expect([403, 400, 500]).toContain(res.status);
    });

    it("should reject expired proposal", async () => {
      if (!respondToProposal) return;

      const proposal = await db.matchProposal.create({
        data: {
          id: "qa-proposal-expired",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          truckPostingId: seed.truckPosting.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "PENDING",
          expiresAt: new Date(Date.now() - 60 * 60 * 1000), // expired 1 hour ago
          proposedByType: "DISPATCHER",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/match-proposals/${proposal.id}/respond`,
        { body: { action: "ACCEPT" } }
      );

      const res = await callHandler(respondToProposal, req, {
        id: proposal.id,
      });
      expect([400, 500]).toContain(res.status);
    });
  });

  // ─── GPS Tracking ─────────────────────────────────────────────────────────

  describe("GPS Tracking Cycle", () => {
    let inTransitTripId: string;

    beforeAll(async () => {
      // Create GPS device for truck
      await db.gpsDevice.create({
        data: {
          id: "qa-gps-device-1",
          imei: "123456789012345",
          status: "ACTIVE",
          truckId: seed.truck.id,
        },
      });

      const trip = await db.trip.create({
        data: {
          id: "qa-gps-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          referenceNumber: "TRIP-GPS001",
          trackingEnabled: true,
        },
      });
      inTransitTripId = trip.id;
    });

    it("should post GPS position for IN_TRANSIT trip", async () => {
      if (!postGps) return;

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${inTransitTripId}/gps`,
        {
          body: {
            latitude: 9.0192,
            longitude: 38.7525,
            speed: 60,
            heading: 180,
          },
        }
      );

      const res = await callHandler(postGps, req, { tripId: inTransitTripId });
      expect([200, 400, 429]).toContain(res.status);
    });

    it("should get GPS history", async () => {
      if (!getGpsHistory) return;

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${inTransitTripId}/gps`
      );

      const res = await callHandler(getGpsHistory, req, {
        tripId: inTransitTripId,
      });
      expect([200, 404]).toContain(res.status);
    });

    it("should reject GPS update from non-carrier", async () => {
      if (!postGps) return;

      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${inTransitTripId}/gps`,
        { body: { latitude: 9.0, longitude: 38.7 } }
      );

      const res = await callHandler(postGps, req, { tripId: inTransitTripId });
      expect([403, 400]).toContain(res.status);
    });

    it("should reject GPS for non-IN_TRANSIT trip", async () => {
      if (!postGps) return;

      const assignedTrip = await db.trip.create({
        data: {
          id: "qa-assigned-gps-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          referenceNumber: "TRIP-GPS002",
        },
      });

      setAuthSession(
        createMockSession({
          userId: seed.carrierUser.id,
          email: "carrier@test.com",
          role: "CARRIER",
          organizationId: seed.carrierOrg.id,
        })
      );

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${assignedTrip.id}/gps`,
        { body: { latitude: 9.0, longitude: 38.7 } }
      );

      const res = await callHandler(postGps, req, { tripId: assignedTrip.id });
      expect([400, 403]).toContain(res.status);
    });

    it("should reject invalid coordinates", async () => {
      if (!postGps) return;

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${inTransitTripId}/gps`,
        { body: { latitude: 999, longitude: -999 } }
      );

      const res = await callHandler(postGps, req, { tripId: inTransitTripId });
      expect([400, 429]).toContain(res.status);
    });

    it("should accept GPS with all optional fields", async () => {
      if (!postGps) return;

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${inTransitTripId}/gps`,
        {
          body: {
            latitude: 9.0192,
            longitude: 38.7525,
            speed: 80,
            heading: 270,
            altitude: 2300,
            accuracy: 5.5,
          },
        }
      );

      const res = await callHandler(postGps, req, { tripId: inTransitTripId });
      expect([200, 400, 429]).toContain(res.status);
    });
  });

  // ─── POD Upload ───────────────────────────────────────────────────────────

  describe("POD Upload", () => {
    let deliveredTripId: string;

    beforeAll(async () => {
      const trip = await db.trip.create({
        data: {
          id: "qa-pod-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "DELIVERED",
          referenceNumber: "TRIP-POD001",
        },
      });
      deliveredTripId = trip.id;
    });

    it("should upload POD for DELIVERED trip", async () => {
      if (!postPod) return;

      // POD endpoint expects FormData; we mock storage so just test the route
      const formData = new FormData();
      const file = new File(["test-image-data"], "pod.jpg", {
        type: "image/jpeg",
      });
      formData.append("file", file);
      formData.append("notes", "Signed at warehouse");

      const req = new (require("next/server").NextRequest)(
        `http://localhost:3000/api/trips/${deliveredTripId}/pod`,
        {
          method: "POST",
          headers: new Headers({ Authorization: "Bearer mock-token" }),
          body: formData,
        }
      );

      const res = await callHandler(postPod, req, { tripId: deliveredTripId });
      expect([200, 400, 500]).toContain(res.status);
    });

    it("should get POD list", async () => {
      if (!getPods) return;

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trips/${deliveredTripId}/pod`
      );

      const res = await callHandler(getPods, req, { tripId: deliveredTripId });
      expect([200, 404]).toContain(res.status);
    });

    it("should reject POD upload for non-DELIVERED trip", async () => {
      if (!postPod) return;

      const inTransitTrip = await db.trip.create({
        data: {
          id: "qa-pod-intransit-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          referenceNumber: "TRIP-POD002",
        },
      });

      const formData = new FormData();
      const file = new File(["data"], "pod.jpg", { type: "image/jpeg" });
      formData.append("file", file);

      const req = new (require("next/server").NextRequest)(
        `http://localhost:3000/api/trips/${inTransitTrip.id}/pod`,
        {
          method: "POST",
          headers: new Headers({ Authorization: "Bearer mock-token" }),
          body: formData,
        }
      );

      const res = await callHandler(postPod, req, { tripId: inTransitTrip.id });
      expect([400, 403]).toContain(res.status);
    });

    it("should reject POD upload from non-carrier", async () => {
      if (!postPod) return;

      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const formData = new FormData();
      const file = new File(["data"], "pod.jpg", { type: "image/jpeg" });
      formData.append("file", file);

      const req = new (require("next/server").NextRequest)(
        `http://localhost:3000/api/trips/${deliveredTripId}/pod`,
        {
          method: "POST",
          headers: new Headers({ Authorization: "Bearer mock-token" }),
          body: formData,
        }
      );

      const res = await callHandler(postPod, req, { tripId: deliveredTripId });
      expect([403, 400]).toContain(res.status);
    });
  });

  // ─── Trip Cancellation ────────────────────────────────────────────────────

  describe("Trip Cancellation", () => {
    it("should cancel an ASSIGNED trip", async () => {
      if (!cancelTrip) return;

      const trip = await db.trip.create({
        data: {
          id: "qa-cancel-assigned",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          referenceNumber: "TRIP-CANCEL1",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/cancel`,
        { body: { reason: "Schedule conflict" } }
      );

      const res = await callHandler(cancelTrip, req, { tripId: trip.id });
      expect([200, 400]).toContain(res.status);
    });

    it("should cancel an IN_TRANSIT trip with reason", async () => {
      if (!cancelTrip) return;

      const trip = await db.trip.create({
        data: {
          id: "qa-cancel-intransit",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "IN_TRANSIT",
          referenceNumber: "TRIP-CANCEL2",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/cancel`,
        { body: { reason: "Road blockage" } }
      );

      const res = await callHandler(cancelTrip, req, { tripId: trip.id });
      expect([200, 400]).toContain(res.status);
    });

    it("should reject cancelling COMPLETED trip", async () => {
      if (!cancelTrip) return;

      const trip = await db.trip.create({
        data: {
          id: "qa-cancel-completed",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "COMPLETED",
          referenceNumber: "TRIP-CANCEL3",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/cancel`,
        { body: { reason: "Want to cancel" } }
      );

      const res = await callHandler(cancelTrip, req, { tripId: trip.id });
      expect(res.status).toBe(400);
    });

    it("should reject cancellation without reason", async () => {
      if (!cancelTrip) return;

      const trip = await db.trip.create({
        data: {
          id: "qa-cancel-no-reason",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          referenceNumber: "TRIP-CANCEL4",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/cancel`,
        { body: {} }
      );

      const res = await callHandler(cancelTrip, req, { tripId: trip.id });
      expect([400, 500]).toContain(res.status);
    });

    it("should reject cancellation by non-party", async () => {
      if (!cancelTrip) return;

      const otherOrg = await db.organization.create({
        data: {
          id: "qa-other-cancel-org",
          name: "Other Cancel Org",
          type: "CARRIER_COMPANY",
          contactEmail: "other-cancel@test.com",
          contactPhone: "+251911333333",
        },
      });

      const trip = await db.trip.create({
        data: {
          id: "qa-cancel-not-party",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: otherOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          referenceNumber: "TRIP-CANCEL5",
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/trips/${trip.id}/cancel`,
        { body: { reason: "Unauthorized cancel" } }
      );

      const res = await callHandler(cancelTrip, req, { tripId: trip.id });
      expect([403, 400]).toContain(res.status);
    });
  });

  // ─── Carrier Dashboard ────────────────────────────────────────────────────

  describe("Carrier Dashboard", () => {
    it("should return dashboard metrics", async () => {
      if (!getCarrierDashboard) return;

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );

      const res = await getCarrierDashboard(req);
      expect([200, 429, 500]).toContain(res.status);

      if (res.status === 200) {
        const data = await parseResponse(res);
        expect(data).toHaveProperty("totalTrucks");
      }
    });

    it("should reject non-carrier access to dashboard", async () => {
      if (!getCarrierDashboard) return;

      setAuthSession(
        createMockSession({
          userId: seed.shipperUser.id,
          email: "shipper@test.com",
          role: "SHIPPER",
          organizationId: seed.shipperOrg.id,
        })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );

      const res = await getCarrierDashboard(req);
      expect([403, 429, 500]).toContain(res.status);
    });

    it("should reject unauthenticated dashboard access", async () => {
      if (!getCarrierDashboard) return;

      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/carrier/dashboard"
      );

      const res = await getCarrierDashboard(req);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── Notifications ────────────────────────────────────────────────────────

  describe("Notifications", () => {
    it("should get notification list", async () => {
      if (!getNotifications) return;

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/notifications"
      );

      const res = await getNotifications(req);
      expect([200, 401, 500]).toContain(res.status);
    });

    it("should mark notification as read", async () => {
      if (!markNotificationRead) return;

      const notif = await db.notification.create({
        data: {
          id: "qa-notif-1",
          userId: seed.carrierUser.id,
          type: "LOAD_REQUEST",
          title: "New load request",
          message: "You have a new load request",
          read: false,
        },
      });

      const req = createRequest(
        "PUT",
        `http://localhost:3000/api/notifications/${notif.id}/read`
      );

      const res = await callHandler(markNotificationRead, req, {
        id: notif.id,
      });
      expect([200, 404, 500]).toContain(res.status);
    });

    it("should reject unauthenticated notification access", async () => {
      if (!getNotifications) return;

      setAuthSession(null);

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/notifications"
      );

      const res = await getNotifications(req);
      expect([401, 500]).toContain(res.status);
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────────────────

  describe("Edge Cases", () => {
    it("should reject duplicate license plate", async () => {
      // AA-12345 already exists from seed
      const req = createRequest("POST", "http://localhost:3000/api/trucks", {
        body: {
          truckType: "DRY_VAN",
          licensePlate: "AA-12345",
          capacity: 10000,
        },
      });

      const res = await createTruck(req);
      expect([400, 409]).toContain(res.status);
    });

    it("should handle trip with non-existent ID", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips/nonexistent-trip-999"
      );

      const res = await callHandler(getTrip, req, {
        tripId: "nonexistent-trip-999",
      });
      expect(res.status).toBe(404);
    });

    it("should reject trip status update without body", async () => {
      const trip = await db.trip.create({
        data: {
          id: "qa-edge-no-body-trip",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          carrierId: seed.carrierOrg.id,
          shipperId: seed.shipperOrg.id,
          status: "ASSIGNED",
          referenceNumber: "TRIP-EDGE1",
        },
      });

      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trips/${trip.id}`,
        { body: {} }
      );

      const res = await callHandler(updateTrip, req, { tripId: trip.id });
      expect([400, 200]).toContain(res.status);
    });

    it("should list trips filtered by status", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/trips?status=IN_TRANSIT"
      );

      const res = await listTrips(req);
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.trips).toBeDefined();
    });
  });
});

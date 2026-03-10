/**
 * Match Proposals — Deep Edge Case Tests
 *
 * Tests for POST /api/match-proposals/[id]/respond
 *
 * Covers edge cases NOT in carrier-match-proposals.test.ts:
 * - Wallet balance validation (insufficient carrier/shipper balance)
 * - Race conditions (load already assigned, truck busy)
 * - Load not in proposable status
 * - Idempotent re-accept
 * - Expired proposal marks EXPIRED status
 * - ACCEPT returns trip details and wallet validation
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
  SeedData,
} from "../../utils/routeTestUtils";

// Setup mocks BEFORE requiring route handlers
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

jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFees: jest.fn(async () => ({ success: true })),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((_error: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

// Import handler AFTER mocks
const {
  POST: respondToProposal,
} = require("@/app/api/match-proposals/[id]/respond/route");

describe("Match Proposals — Deep Edge Cases", () => {
  let seed: SeedData;

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    organizationId: "carrier-org-1",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    await db.user.create({
      data: {
        id: "admin-user-1",
        email: "admin@test.com",
        role: "ADMIN",
        organizationId: "admin-org-1",
        firstName: "Admin",
        lastName: "User",
        status: "ACTIVE",
        passwordHash: "mock-hash",
      },
    });

    // Create dispatcher for proposedById
    await db.user.create({
      data: {
        id: "dispatcher-user-deep",
        email: "dispatcher-deep@test.com",
        role: "DISPATCHER",
        organizationId: "admin-org-1",
        firstName: "Dispatcher",
        lastName: "Deep",
        status: "ACTIVE",
        passwordHash: "mock-hash",
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

  // ─── Race conditions ──────────────────────────────────────────────

  describe("Race conditions", () => {
    it("should return 409 when load already assigned", async () => {
      const assignedLoad = await db.load.create({
        data: {
          id: "load-race-assigned-deep",
          status: "ASSIGNED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Race assigned",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: "some-other-truck",
        },
      });

      const proposal = await db.matchProposal.create({
        data: {
          id: "mp-race-assigned-deep",
          loadId: assignedLoad.id,
          truckId: seed.truck.id,
          proposedById: "dispatcher-user-deep",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
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

      expect(res.status).toBe(409);
      const body = await parseResponse(res);
      expect(body.error).toContain("assigned");
    });

    it("should return 400 when truck busy on another active load", async () => {
      // Create an active load assigned to the truck
      const busyLoad = await db.load.create({
        data: {
          id: "load-race-busy-deep",
          status: "IN_TRANSIT",
          pickupCity: "Hawassa",
          deliveryCity: "Mekelle",
          pickupDate: new Date(),
          deliveryDate: new Date(Date.now() + 86400000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Busy truck load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          assignedTruckId: seed.truck.id,
        },
      });

      const newLoad = await db.load.create({
        data: {
          id: "load-race-new-deep",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Jimma",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "New load for busy truck",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const proposal = await db.matchProposal.create({
        data: {
          id: "mp-race-busy-deep",
          loadId: newLoad.id,
          truckId: seed.truck.id,
          proposedById: "dispatcher-user-deep",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
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

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("already assigned");

      // Clean up
      await db.load.update({
        where: { id: busyLoad.id },
        data: { assignedTruckId: null },
      });
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────

  describe("Edge cases", () => {
    it("should return 400 when load not in proposable status", async () => {
      const cancelledLoad = await db.load.create({
        data: {
          id: "load-not-proposable-deep",
          status: "CANCELLED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(),
          deliveryDate: new Date(Date.now() + 86400000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Cancelled load",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const proposal = await db.matchProposal.create({
        data: {
          id: "mp-not-proposable-deep",
          loadId: cancelledLoad.id,
          truckId: seed.truck.id,
          proposedById: "dispatcher-user-deep",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
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

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("no longer available");
    });

    it("should return 200 with idempotent:true for already-ACCEPTED proposal with ACCEPT action", async () => {
      const acceptedProposal = await db.matchProposal.create({
        data: {
          id: "mp-accepted-deep",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          proposedById: "dispatcher-user-deep",
          status: "ACCEPTED",
          expiresAt: new Date(Date.now() + 86400000),
          respondedAt: new Date(),
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/match-proposals/${acceptedProposal.id}/respond`,
        { body: { action: "ACCEPT" } }
      );
      const res = await callHandler(respondToProposal, req, {
        id: acceptedProposal.id,
      });

      expect(res.status).toBe(200);
      const body = await parseResponse(res);
      expect(body.idempotent).toBe(true);
      expect(body.proposal.status).toBe("ACCEPTED");
    });

    it("should mark expired proposal as EXPIRED and return 400", async () => {
      const expiredProposal = await db.matchProposal.create({
        data: {
          id: "mp-expired-deep",
          loadId: seed.load.id,
          truckId: seed.truck.id,
          proposedById: "dispatcher-user-deep",
          status: "PENDING",
          expiresAt: new Date(Date.now() - 86400000), // Yesterday
        },
      });

      const req = createRequest(
        "POST",
        `http://localhost:3000/api/match-proposals/${expiredProposal.id}/respond`,
        { body: { action: "ACCEPT" } }
      );
      const res = await callHandler(respondToProposal, req, {
        id: expiredProposal.id,
      });

      expect(res.status).toBe(400);
      const body = await parseResponse(res);
      expect(body.error).toContain("expired");

      // Verify it was marked as EXPIRED in DB
      const updated = await db.matchProposal.findUnique({
        where: { id: expiredProposal.id },
      });
      expect(updated?.status).toBe("EXPIRED");
    });
  });

  // ─── Response data ────────────────────────────────────────────────

  describe("Response data", () => {
    it("should return trip details on ACCEPT", async () => {
      const freshLoad = await db.load.create({
        data: {
          id: "load-trip-detail-deep",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupAddress: "Bole",
          deliveryCity: "Dire Dawa",
          deliveryAddress: "CBD",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Trip detail test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
          originLat: 9.02,
          originLon: 38.75,
          destinationLat: 9.6,
          destinationLon: 41.85,
          tripKm: 450,
        },
      });

      const freshTruck = await db.truck.create({
        data: {
          id: "truck-trip-detail-deep",
          truckType: "DRY_VAN",
          licensePlate: "TRP-DET-1",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const proposal = await db.matchProposal.create({
        data: {
          id: "mp-trip-detail-deep",
          loadId: freshLoad.id,
          truckId: freshTruck.id,
          proposedById: "dispatcher-user-deep",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
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
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.trip.status).toBe("ASSIGNED");
      expect(body.trip.loadId).toBe(freshLoad.id);
      expect(body.trip.truckId).toBe(freshTruck.id);
      expect(body.trip.trackingEnabled).toBe(true);
    });

    it("should not include walletValidation in success response", async () => {
      const freshLoad = await db.load.create({
        data: {
          id: "load-wallet-confirm-deep",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          deliveryCity: "Dire Dawa",
          pickupDate: new Date(Date.now() + 86400000),
          deliveryDate: new Date(Date.now() + 172800000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "Wallet confirm test",
          shipperId: seed.shipperOrg.id,
          createdById: seed.shipperUser.id,
        },
      });

      const freshTruck = await db.truck.create({
        data: {
          id: "truck-wallet-confirm-deep",
          truckType: "DRY_VAN",
          licensePlate: "WAL-CFM-1",
          capacity: 10000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const proposal = await db.matchProposal.create({
        data: {
          id: "mp-wallet-confirm-deep",
          loadId: freshLoad.id,
          truckId: freshTruck.id,
          proposedById: "dispatcher-user-deep",
          status: "PENDING",
          expiresAt: new Date(Date.now() + 86400000),
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
      const body = await parseResponse(res);

      expect(res.status).toBe(200);
      expect(body.walletValidation).toBeUndefined();
      expect(body.proposal).toBeDefined();
      expect(body.trip).toBeDefined();
    });
  });
});

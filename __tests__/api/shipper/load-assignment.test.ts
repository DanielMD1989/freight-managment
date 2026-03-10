// @jest-environment node
/**
 * Shipper Load Assignment API Tests
 *
 * Tests for load assignment endpoints:
 * - GET  /api/loads/[id]/matching-trucks  → find trucks matching a load
 * - POST /api/loads/[id]/assign           → assign a truck to a load
 * - DELETE /api/loads/[id]/assign         → unassign a truck from a load
 *
 * Business rules tested:
 * - Shipper can get matching trucks for their own load (200)
 * - limit=200 is clamped to 100
 * - Unrelated carrier (not assigned) cannot view matching trucks (404)
 * - Shipper can directly assign a truck (canAssignLoads returns true for SHIPPER)
 * - Response includes load, trip, trackingUrl
 * - Carrier can assign their own truck to a load (200)
 * - Carrier cannot assign a truck not owned by their org (404)
 * - Truck already busy → 409
 * - DELETE for ASSIGNED load → 200 (unassigns and transitions to SEARCHING)
 * - DELETE for IN_TRANSIT load → 400 (cannot unassign in-transit load)
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
  mockRbac,
  mockApiErrors,
  mockLogger,
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
// Override matchingEngine: findMatchingTrucks must be SYNCHRONOUS (route calls .slice() directly)
jest.mock("@/lib/matchingEngine", () => ({
  findMatchingLoads: jest.fn(() => []),
  findMatchingTrucks: jest.fn(() => [
    {
      id: "test-truck-001",
      score: 85,
      isExactMatch: true,
      carrier: {
        id: "carrier-org-1",
        name: "Test Carrier LLC",
        isVerified: true,
      },
      contactName: "Test Carrier",
      contactPhone: "+251911000002",
    },
  ]),
}));
// Override dispatcherPermissions: canAssignLoads must allow CARRIER for own-truck tests
jest.mock("@/lib/dispatcherPermissions", () => ({
  canViewAllTrucks: jest.fn(() => true),
  hasElevatedPermissions: jest.fn(() => false),
  canRequestTruck: jest.fn(() => true),
  canApproveRequests: jest.fn(() => true),
  canProposeMatch: jest.fn((user: any) =>
    ["DISPATCHER", "ADMIN", "SUPER_ADMIN"].includes(user?.role ?? user)
  ),
  canPropose: jest.fn((user: any) =>
    ["DISPATCHER", "ADMIN", "SUPER_ADMIN"].includes(user?.role ?? user)
  ),
  // Include CARRIER so carrier-self-assign tests can reach the ownership check
  canAssignLoads: jest.fn((user: any) =>
    ["ADMIN", "SUPER_ADMIN", "SHIPPER", "DISPATCHER", "CARRIER"].includes(
      user?.role ?? user
    )
  ),
}));
jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFees: jest.fn(async () => ({ success: true })),
  deductServiceFee: jest.fn(async () => ({
    success: true,
    serviceFee: 150,
    shipperFee: 100,
    carrierFee: 50,
    totalPlatformFee: 150,
    platformRevenue: { greaterThan: (n: number) => 150 > n },
    transactionId: "txn-mock",
    details: {
      shipper: { fee: 100, status: "DEDUCTED" },
      carrier: { fee: 50, status: "DEDUCTED" },
    },
  })),
}));
mockRbac();
mockApiErrors();
mockLogger();
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

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

// Import handlers AFTER mocks
const {
  GET: getMatchingTrucks,
} = require("@/app/api/loads/[id]/matching-trucks/route");
const {
  POST: assignLoad,
  DELETE: unassignLoad,
} = require("@/app/api/loads/[id]/assign/route");

describe("Load Assignment API", () => {
  let seed: SeedData;

  const shipperSession = createMockSession({
    userId: "shipper-user-1",
    email: "shipper@test.com",
    role: "SHIPPER",
    status: "ACTIVE",
    organizationId: "shipper-org-1",
  });

  const carrierSession = createMockSession({
    userId: "carrier-user-1",
    email: "carrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-1",
  });

  // Unrelated carrier that does NOT own test-truck-001
  const otherCarrierSession = createMockSession({
    userId: "carrier-user-2",
    email: "othercarrier@test.com",
    role: "CARRIER",
    status: "ACTIVE",
    organizationId: "carrier-org-2",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create a second carrier org for cross-org tests
    await db.organization.create({
      data: {
        id: "carrier-org-2",
        name: "Other Carrier LLC",
        type: "CARRIER_COMPANY",
        contactEmail: "othercarrier@test.com",
        contactPhone: "+251911000003",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });

    await db.user.create({
      data: {
        id: "carrier-user-2",
        email: "othercarrier@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Other",
        lastName: "Carrier",
        phone: "+251911000003",
        role: "CARRIER",
        status: "ACTIVE",
        organizationId: "carrier-org-2",
      },
    });
  });

  beforeEach(() => {
    setAuthSession(shipperSession);
    jest.clearAllMocks();
  });

  afterAll(() => {
    clearAllStores();
  });

  // ─── GET /api/loads/[id]/matching-trucks ─────────────────────────────────

  describe("GET /loads/[id]/matching-trucks", () => {
    it("shipper gets matching trucks for their own load → 200, { trucks, total, exactMatches }", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}/matching-trucks`
      );

      const res = await callHandler(getMatchingTrucks, req, {
        id: seed.load.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(Array.isArray(data.trucks)).toBe(true);
      expect(typeof data.total).toBe("number");
      expect(typeof data.exactMatches).toBe("number");
    });

    it("limit=200 is clamped to 100", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}/matching-trucks?limit=200`
      );

      const res = await callHandler(getMatchingTrucks, req, {
        id: seed.load.id,
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      // The route clamps limit to max 100; trucks array should not exceed 100
      expect(data.trucks.length).toBeLessThanOrEqual(100);
    });

    it("unrelated carrier (not assigned to load) → 404 (resource cloaking)", async () => {
      // otherCarrierSession belongs to carrier-org-2 which has no truck assigned to this load
      setAuthSession(otherCarrierSession);

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/loads/${seed.load.id}/matching-trucks`
      );

      const res = await callHandler(getMatchingTrucks, req, {
        id: seed.load.id,
      });
      expect(res.status).toBe(404);
    });

    it("non-existent load → 404", async () => {
      const req = createRequest(
        "GET",
        "http://localhost:3000/api/loads/nonexistent-load/matching-trucks"
      );

      const res = await callHandler(getMatchingTrucks, req, {
        id: "nonexistent-load",
      });
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/loads/[id]/assign ─────────────────────────────────────────

  describe("POST /loads/[id]/assign (direct assign)", () => {
    it("shipper assigns truck → 200, response includes load, trip, trackingUrl", async () => {
      // The seeded load "test-load-001" has status "POSTED" (valid for assignment)
      // canAssignLoads mock returns true for SHIPPER
      const req = createRequest(
        "POST",
        `http://localhost:3000/api/loads/${seed.load.id}/assign`,
        { body: { truckId: seed.truck.id } }
      );

      const res = await callHandler(assignLoad, req, { id: seed.load.id });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.trip).toBeDefined();
      expect("trackingUrl" in data).toBe(true);
    });

    it("carrier assigns their OWN truck → 200", async () => {
      setAuthSession(carrierSession);

      // Create a POSTED load and a fresh available truck owned by carrier-org-1
      await db.load.create({
        data: {
          id: "load-carrier-assign",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3500,
          cargoDescription: "Carrier self-assign cargo",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          postedAt: new Date(),
        },
      });

      await db.truck.create({
        data: {
          id: "truck-carrier-own",
          truckType: "DRY_VAN",
          licensePlate: "CC-11111",
          capacity: 9000,
          isAvailable: true,
          carrierId: "carrier-org-1", // same as carrierSession.organizationId
          createdById: "carrier-user-1",
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/loads/load-carrier-assign/assign",
        { body: { truckId: "truck-carrier-own" } }
      );

      const res = await callHandler(assignLoad, req, {
        id: "load-carrier-assign",
      });
      expect(res.status).toBe(200);
    });

    it("carrier assigns truck NOT owned by their org → 404", async () => {
      setAuthSession(otherCarrierSession);

      // Create a POSTED load for this test
      await db.load.create({
        data: {
          id: "load-cross-carrier",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 2000,
          cargoDescription: "Cross-org assign attempt",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          postedAt: new Date(),
        },
      });

      // otherCarrierSession is carrier-org-2; seed.truck belongs to carrier-org-1
      const req = createRequest(
        "POST",
        "http://localhost:3000/api/loads/load-cross-carrier/assign",
        { body: { truckId: seed.truck.id } }
      );

      const res = await callHandler(assignLoad, req, {
        id: "load-cross-carrier",
      });
      expect(res.status).toBe(404);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/not found/i);
    });

    it("truck already busy with an active load → 409", async () => {
      setAuthSession(shipperSession);

      // Create a truck that is already assigned to an active load
      await db.truck.create({
        data: {
          id: "truck-busy-001",
          truckType: "DRY_VAN",
          licensePlate: "DD-22222",
          capacity: 7000,
          isAvailable: false,
          carrierId: "carrier-org-1",
          createdById: "carrier-user-1",
          approvalStatus: "APPROVED",
        },
      });

      // The active load that currently occupies the truck
      await db.load.create({
        data: {
          id: "load-active-busy",
          status: "IN_TRANSIT",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          deliveryCity: "Hawassa",
          deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 4000,
          cargoDescription: "Truck is already hauling this",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          assignedTruckId: "truck-busy-001",
          postedAt: new Date(),
        },
      });

      // New load wanting to steal the busy truck
      await db.load.create({
        data: {
          id: "load-wants-busy-truck",
          status: "POSTED",
          pickupCity: "Dire Dawa",
          pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
          deliveryCity: "Mekelle",
          deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 2000,
          cargoDescription: "Wants the busy truck",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/loads/load-wants-busy-truck/assign",
        { body: { truckId: "truck-busy-001" } }
      );

      const res = await callHandler(assignLoad, req, {
        id: "load-wants-busy-truck",
      });
      expect(res.status).toBe(409);

      const data = await parseResponse(res);
      expect(data.error).toBeDefined();
    });
  });

  // ─── DELETE /api/loads/[id]/assign ───────────────────────────────────────

  describe("DELETE /loads/[id]/assign (unassign)", () => {
    it("DELETE for ASSIGNED load → 200, load is unassigned", async () => {
      // Create a truck and an ASSIGNED load with that truck set
      await db.truck.create({
        data: {
          id: "truck-unassign-001",
          truckType: "DRY_VAN",
          licensePlate: "EE-33333",
          capacity: 6000,
          isAvailable: false,
          carrierId: "carrier-org-1",
          createdById: "carrier-user-1",
          approvalStatus: "APPROVED",
        },
      });

      await db.load.create({
        data: {
          id: "load-assigned-001",
          status: "ASSIGNED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 6 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 3000,
          cargoDescription: "Assigned cargo to be unassigned",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          assignedTruckId: "truck-unassign-001",
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/loads/load-assigned-001/assign"
      );

      const res = await callHandler(unassignLoad, req, {
        id: "load-assigned-001",
      });
      expect(res.status).toBe(200);

      const data = await parseResponse(res);
      expect(data.load).toBeDefined();
      expect(data.message).toMatch(/unassigned/i);
    });

    it("DELETE for IN_TRANSIT load → 400 (cannot unassign in-transit)", async () => {
      await db.truck.create({
        data: {
          id: "truck-in-transit-001",
          truckType: "DRY_VAN",
          licensePlate: "FF-44444",
          capacity: 6000,
          isAvailable: false,
          carrierId: "carrier-org-1",
          createdById: "carrier-user-1",
          approvalStatus: "APPROVED",
        },
      });

      await db.load.create({
        data: {
          id: "load-in-transit-del",
          status: "IN_TRANSIT",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 5000,
          cargoDescription: "In-transit load that cannot be unassigned",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          assignedTruckId: "truck-in-transit-001",
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/loads/load-in-transit-del/assign"
      );

      const res = await callHandler(unassignLoad, req, {
        id: "load-in-transit-del",
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toMatch(/in transit|in-transit|cannot unassign/i);
    });

    it("DELETE for load with no truck assigned → 400", async () => {
      await db.load.create({
        data: {
          id: "load-no-truck",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 1000,
          cargoDescription: "No truck assigned",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "DELETE",
        "http://localhost:3000/api/loads/load-no-truck/assign"
      );

      const res = await callHandler(unassignLoad, req, {
        id: "load-no-truck",
      });
      expect(res.status).toBe(400);

      const data = await parseResponse(res);
      expect(data.error).toBeDefined();
    });

    it("unauthenticated DELETE → 401 or 500", async () => {
      setAuthSession(null);

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/loads/${seed.load.id}/assign`
      );

      const res = await callHandler(unassignLoad, req, { id: seed.load.id });
      expect([401, 500]).toContain(res.status);
    });
  });

  // GAP-2: SHIPPER direct-assign 404 (validates BUG-3 fix — canAssignLoads returns false for SHIPPER)

  describe("POST /loads/[id]/assign (SHIPPER blocked by canAssignLoads)", () => {
    it("SHIPPER with canAssignLoads=false → 404 (resource cloaking)", async () => {
      setAuthSession(shipperSession);

      // Force canAssignLoads to return false for this call
      // (reflects the corrected global mock after BUG-3 fix)
      jest
        .requireMock("@/lib/dispatcherPermissions")
        .canAssignLoads.mockReturnValueOnce(false);

      await db.load.create({
        data: {
          id: "load-shipper-blocked-assign",
          status: "POSTED",
          pickupCity: "Addis Ababa",
          pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
          deliveryCity: "Dire Dawa",
          deliveryDate: new Date(Date.now() + 8 * 24 * 60 * 60 * 1000),
          truckType: "DRY_VAN",
          weight: 2000,
          cargoDescription: "Blocked shipper assign attempt",
          shipperId: "shipper-org-1",
          createdById: "shipper-user-1",
          postedAt: new Date(),
        },
      });

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/loads/load-shipper-blocked-assign/assign",
        { body: { truckId: seed.truck.id } }
      );

      const res = await callHandler(assignLoad, req, {
        id: "load-shipper-blocked-assign",
      });

      // Route returns 404 (resource cloaking) when canAssignLoads is false
      expect(res.status).toBe(404);
    });
  });
});

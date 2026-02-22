/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * State Machine Abuse Tests
 *
 * Tests that trip and load state machines cannot be abused
 * by skipping steps, going backward, or violating constraints.
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
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
} from "../utils/routeTestUtils";

// Setup mocks
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

// Import route handler AFTER mocks (use require so mocks are applied)
const { PATCH: updateTrip } = require("@/app/api/trips/[tripId]/route");
// Import state machine utilities (no mocking needed)
import {
  isValidTripTransition,
  isValidTripStatus,
  canRoleSetTripStatus,
  getValidNextTripStates,
  isTerminalTripStatus,
} from "@/lib/tripStateMachine";

describe("State Machine Abuse Tests", () => {
  const carrierSession = createMockSession({
    userId: "sm-carrier-user",
    email: "smcarrier@test.com",
    role: "CARRIER",
    organizationId: "sm-carrier-org",
  });

  beforeAll(async () => {
    // Create org, user, load, truck
    await db.organization.create({
      data: {
        id: "sm-carrier-org",
        name: "SM Carrier",
        type: "CARRIER_COMPANY",
        contactEmail: "sm@test.com",
        contactPhone: "+251911000001",
      },
    });

    await db.organization.create({
      data: {
        id: "sm-shipper-org",
        name: "SM Shipper",
        type: "SHIPPER",
        contactEmail: "smshipper@test.com",
        contactPhone: "+251911000002",
      },
    });

    await db.truck.create({
      data: {
        id: "sm-truck",
        truckType: "DRY_VAN",
        licensePlate: "SM-001",
        capacity: 10000,
        carrierId: "sm-carrier-org",
        createdById: "sm-carrier-user",
      },
    });

    await db.load.create({
      data: {
        id: "sm-load",
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        pickupDate: new Date(),
        deliveryCity: "Dire Dawa",
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "State machine test load",
        shipperId: "sm-shipper-org",
        createdById: "sm-shipper-user",
        assignedTruckId: "sm-truck",
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

  // Helper to create a trip with specific status
  async function createTripWithStatus(id: string, status: string) {
    return db.trip.create({
      data: {
        id,
        loadId: "sm-load",
        truckId: "sm-truck",
        carrierId: "sm-carrier-org",
        shipperId: "sm-shipper-org",
        status,
        referenceNumber: `TRIP-${id}`,
      },
    });
  }

  // ─── Trip: Skip Steps ────────────────────────────────────────────────────

  describe("Trip: skip steps", () => {
    it("should reject ASSIGNED → IN_TRANSIT (must go through PICKUP_PENDING)", async () => {
      await createTripWithStatus("skip-1", "ASSIGNED");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/skip-1",
        {
          body: { status: "IN_TRANSIT" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "skip-1" });
      expect(res.status).toBe(400);
    });

    it("should reject ASSIGNED → DELIVERED (skip two steps)", async () => {
      await createTripWithStatus("skip-2", "ASSIGNED");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/skip-2",
        {
          body: { status: "DELIVERED" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "skip-2" });
      expect(res.status).toBe(400);
    });

    it("should reject ASSIGNED → COMPLETED (skip all steps)", async () => {
      await createTripWithStatus("skip-3", "ASSIGNED");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/skip-3",
        {
          body: { status: "COMPLETED" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "skip-3" });
      expect(res.status).toBe(400);
    });

    it("should reject PICKUP_PENDING → DELIVERED (skip IN_TRANSIT)", async () => {
      await createTripWithStatus("skip-4", "PICKUP_PENDING");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/skip-4",
        {
          body: { status: "DELIVERED" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "skip-4" });
      expect(res.status).toBe(400);
    });
  });

  // ─── Trip: Backward Transitions ──────────────────────────────────────────

  describe("Trip: backward transitions", () => {
    it("should reject IN_TRANSIT → ASSIGNED (backward)", async () => {
      await createTripWithStatus("back-1", "IN_TRANSIT");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/back-1",
        {
          body: { status: "ASSIGNED" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "back-1" });
      expect(res.status).toBe(400);
    });

    it("should reject DELIVERED → IN_TRANSIT (backward)", async () => {
      await createTripWithStatus("back-2", "DELIVERED");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/back-2",
        {
          body: { status: "IN_TRANSIT" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "back-2" });
      expect(res.status).toBe(400);
    });

    it("should reject IN_TRANSIT → PICKUP_PENDING (backward)", async () => {
      await createTripWithStatus("back-3", "IN_TRANSIT");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/back-3",
        {
          body: { status: "PICKUP_PENDING" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "back-3" });
      expect(res.status).toBe(400);
    });
  });

  // ─── Trip: Terminal State Transitions ────────────────────────────────────

  describe("Trip: terminal states (no further transitions)", () => {
    it("should reject transition from COMPLETED", async () => {
      await createTripWithStatus("term-1", "COMPLETED");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/term-1",
        {
          body: { status: "ASSIGNED" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "term-1" });
      expect(res.status).toBe(400);
    });

    it("should reject transition from CANCELLED", async () => {
      await createTripWithStatus("term-2", "CANCELLED");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/term-2",
        {
          body: { status: "ASSIGNED" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "term-2" });
      expect(res.status).toBe(400);
    });

    it("should reject COMPLETED → CANCELLED", async () => {
      await createTripWithStatus("term-3", "COMPLETED");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/term-3",
        {
          body: { status: "CANCELLED" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "term-3" });
      expect(res.status).toBe(400);
    });
  });

  // ─── Trip State Machine Unit Tests ───────────────────────────────────────

  describe("Trip state machine validation (unit)", () => {
    it("should validate all forward transitions", () => {
      expect(isValidTripTransition("ASSIGNED", "PICKUP_PENDING")).toBe(true);
      expect(isValidTripTransition("PICKUP_PENDING", "IN_TRANSIT")).toBe(true);
      expect(isValidTripTransition("IN_TRANSIT", "DELIVERED")).toBe(true);
      expect(isValidTripTransition("DELIVERED", "COMPLETED")).toBe(true);
    });

    it("should reject all backward transitions", () => {
      expect(isValidTripTransition("PICKUP_PENDING", "ASSIGNED")).toBe(false);
      expect(isValidTripTransition("IN_TRANSIT", "PICKUP_PENDING")).toBe(false);
      expect(isValidTripTransition("DELIVERED", "IN_TRANSIT")).toBe(false);
      expect(isValidTripTransition("COMPLETED", "DELIVERED")).toBe(false);
    });

    it("should allow cancellation from non-terminal states", () => {
      expect(isValidTripTransition("ASSIGNED", "CANCELLED")).toBe(true);
      expect(isValidTripTransition("PICKUP_PENDING", "CANCELLED")).toBe(true);
      expect(isValidTripTransition("IN_TRANSIT", "CANCELLED")).toBe(true);
      expect(isValidTripTransition("DELIVERED", "CANCELLED")).toBe(true);
    });

    it("should identify terminal states", () => {
      expect(isTerminalTripStatus("COMPLETED")).toBe(true);
      expect(isTerminalTripStatus("CANCELLED")).toBe(true);
      expect(isTerminalTripStatus("ASSIGNED")).toBe(false);
      expect(isTerminalTripStatus("IN_TRANSIT")).toBe(false);
    });

    it("should validate role permissions for status changes", () => {
      // Carrier can set operational statuses
      expect(canRoleSetTripStatus("CARRIER", "PICKUP_PENDING")).toBe(true);
      expect(canRoleSetTripStatus("CARRIER", "IN_TRANSIT")).toBe(true);
      expect(canRoleSetTripStatus("CARRIER", "DELIVERED")).toBe(true);

      // Admin can set any status
      expect(canRoleSetTripStatus("ADMIN", "COMPLETED")).toBe(true);
      expect(canRoleSetTripStatus("ADMIN", "CANCELLED")).toBe(true);
      expect(canRoleSetTripStatus("SUPER_ADMIN", "ASSIGNED")).toBe(true);
    });

    it("should return valid next states", () => {
      const nextFromAssigned = getValidNextTripStates("ASSIGNED");
      expect(nextFromAssigned).toContain("PICKUP_PENDING");
      expect(nextFromAssigned).toContain("CANCELLED");
      expect(nextFromAssigned).not.toContain("IN_TRANSIT");

      const nextFromCompleted = getValidNextTripStates("COMPLETED");
      expect(nextFromCompleted).toHaveLength(0);
    });

    it("should reject invalid status strings", () => {
      expect(isValidTripStatus("FLYING")).toBe(false);
      expect(isValidTripStatus("DRAFT")).toBe(false);
      expect(isValidTripStatus("")).toBe(false);
    });
  });

  // ─── Invalid Status Values ───────────────────────────────────────────────

  describe("Invalid status values in API", () => {
    it("should reject non-existent status value", async () => {
      await createTripWithStatus("invalid-1", "ASSIGNED");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/invalid-1",
        {
          body: { status: "FLYING" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "invalid-1" });
      expect(res.status).toBe(400);
    });

    it("should reject empty status", async () => {
      await createTripWithStatus("invalid-2", "ASSIGNED");

      const req = createRequest(
        "PATCH",
        "http://localhost:3000/api/trips/invalid-2",
        {
          body: { status: "" },
        }
      );

      const res = await callHandler(updateTrip, req, { tripId: "invalid-2" });
      expect(res.status).toBe(400);
    });
  });
});

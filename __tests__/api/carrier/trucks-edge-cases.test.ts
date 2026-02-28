/**
 * Carrier Truck Edge-Case Tests
 *
 * Tests truck CRUD boundary conditions:
 * - DELETE active trip guard (409 for ASSIGNED/PICKUP_PENDING/IN_TRANSIT/DELIVERED)
 * - DELETE success with COMPLETED trip or no trips
 * - PATCH validation boundaries (capacity, licensePlate length)
 * - PATCH edge cases (same value update, empty body)
 * - GET edge cases (null gpsDevice, empty truck list)
 * - DELETE owner check (carrier deleting other carrier's truck)
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
mockLogger();

// Override mockApiErrors to handle ZodErrors as 400 (matching real handleApiError)
jest.mock("@/lib/apiErrors", () => ({
  handleApiError: jest.fn((error: any) => {
    const { NextResponse } = require("next/server");
    // ZodError from schema.parse() should return 400
    if (error.name === "ZodError" || error.issues) {
      return NextResponse.json(
        { error: "Validation error", details: error.errors || error.issues },
        { status: 400 }
      );
    }
    const status =
      error.name === "ForbiddenError"
        ? 403
        : error.name === "UnauthorizedError"
          ? 401
          : 500;
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status }
    );
  }),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
}));

// Import handlers AFTER mocks
const { GET: listTrucks } = require("@/app/api/trucks/route");
const {
  GET: getTruck,
  PATCH: updateTruck,
  DELETE: deleteTruck,
} = require("@/app/api/trucks/[id]/route");

describe("Carrier Truck Edge Cases", () => {
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

  const otherCarrierSession = createMockSession({
    userId: "other-carrier-user",
    email: "other-carrier@test.com",
    role: "CARRIER",
    organizationId: "other-carrier-org",
  });

  beforeAll(async () => {
    seed = await seedTestData();

    // Create admin user for delete tests
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

    // Create other carrier user
    await db.organization.create({
      data: {
        id: "other-carrier-org",
        name: "Other Carrier LLC",
        type: "CARRIER_COMPANY",
        contactEmail: "other@test.com",
        contactPhone: "+251911000099",
        isVerified: true,
      },
    });
    await db.user.create({
      data: {
        id: "other-carrier-user",
        email: "other-carrier@test.com",
        role: "CARRIER",
        organizationId: "other-carrier-org",
        firstName: "Other",
        lastName: "Carrier",
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
    setAuthSession(adminSession);
  });

  // Helper to create a truck with a trip at a given status
  async function createTruckWithTrip(tripStatus: string) {
    const truckId = `del-truck-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const loadId = `del-load-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await db.truck.create({
      data: {
        id: truckId,
        truckType: "FLATBED",
        licensePlate: `DEL-${truckId.slice(-6)}`,
        capacity: 8000,
        isAvailable: false,
        carrierId: seed.carrierOrg.id,
        createdById: seed.carrierUser.id,
        approvalStatus: "APPROVED",
      },
    });

    await db.load.create({
      data: {
        id: loadId,
        status: "ASSIGNED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        pickupDate: new Date(),
        deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        truckType: "FLATBED",
        weight: 5000,
        cargoDescription: "Delete guard test cargo",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
      },
    });

    await db.trip.create({
      data: {
        id: `del-trip-${truckId.slice(-6)}`,
        loadId,
        truckId,
        carrierId: seed.carrierOrg.id,
        shipperId: seed.shipperOrg.id,
        status: tripStatus,
      },
    });

    return truckId;
  }

  // ─── DELETE Active Trip Guard ──────────────────────────────────────────

  describe("DELETE active trip guard", () => {
    it("returns 409 with ASSIGNED trip", async () => {
      const truckId = await createTruckWithTrip("ASSIGNED");

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckId}`
      );
      const res = await callHandler(deleteTruck, req, { id: truckId });
      expect(res.status).toBe(409);
      const data = await parseResponse(res);
      expect(data.error).toContain("active");
    });

    it("returns 409 with PICKUP_PENDING trip", async () => {
      const truckId = await createTruckWithTrip("PICKUP_PENDING");

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckId}`
      );
      const res = await callHandler(deleteTruck, req, { id: truckId });
      expect(res.status).toBe(409);
    });

    it("returns 409 with IN_TRANSIT trip", async () => {
      const truckId = await createTruckWithTrip("IN_TRANSIT");

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckId}`
      );
      const res = await callHandler(deleteTruck, req, { id: truckId });
      expect(res.status).toBe(409);
    });

    it("returns 409 with DELIVERED trip", async () => {
      const truckId = await createTruckWithTrip("DELIVERED");

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckId}`
      );
      const res = await callHandler(deleteTruck, req, { id: truckId });
      expect(res.status).toBe(409);
    });
  });

  // ─── DELETE Success Cases ─────────────────────────────────────────────

  describe("DELETE success cases", () => {
    it("returns 200 with COMPLETED trip (not active)", async () => {
      const truckId = await createTruckWithTrip("COMPLETED");

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckId}`
      );
      const res = await callHandler(deleteTruck, req, { id: truckId });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.success).toBe(true);
    });

    it("returns 200 with no trips at all", async () => {
      const truckId = `no-trip-truck-${Date.now()}`;
      await db.truck.create({
        data: {
          id: truckId,
          truckType: "DRY_VAN",
          licensePlate: `NT-${truckId.slice(-6)}`,
          capacity: 5000,
          isAvailable: true,
          carrierId: seed.carrierOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${truckId}`
      );
      const res = await callHandler(deleteTruck, req, { id: truckId });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.success).toBe(true);
    });
  });

  // ─── PATCH Validation Boundaries ──────────────────────────────────────

  describe("PATCH validation boundaries", () => {
    beforeEach(() => {
      setAuthSession(carrierSession);
    });

    it("returns 400 for capacity=0 (not positive)", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        { body: { capacity: 0 } }
      );
      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(400);
    });

    it("returns 400 for licensePlate with 2 chars (min 3)", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        { body: { licensePlate: "AB" } }
      );
      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(400);
    });

    it("returns 400 for licensePlate with 21 chars (max 20)", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        { body: { licensePlate: "A".repeat(21) } }
      );
      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(400);
    });
  });

  // ─── PATCH Edge Cases ─────────────────────────────────────────────────

  describe("PATCH edge cases", () => {
    beforeEach(() => {
      setAuthSession(carrierSession);
    });

    it("returns 200 when updating licensePlate to same value", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        { body: { licensePlate: "AA-12345" } }
      );
      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);
    });

    it("returns 200 for empty body (no changes)", async () => {
      const req = createRequest(
        "PATCH",
        `http://localhost:3000/api/trucks/${seed.truck.id}`,
        { body: {} }
      );
      const res = await callHandler(updateTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);
    });
  });

  // ─── GET Edge Cases ───────────────────────────────────────────────────

  describe("GET edge cases", () => {
    beforeEach(() => {
      setAuthSession(carrierSession);
    });

    it("returns truck with gpsDevice=null", async () => {
      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );
      const res = await callHandler(getTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.gpsDevice).toBeNull();
    });
  });

  // ─── DELETE Owner Check ───────────────────────────────────────────────

  describe("DELETE owner check", () => {
    it("carrier cannot delete truck (requires admin) → 403", async () => {
      setAuthSession(carrierSession);

      const req = createRequest(
        "DELETE",
        `http://localhost:3000/api/trucks/${seed.truck.id}`
      );
      const res = await callHandler(deleteTruck, req, { id: seed.truck.id });
      expect(res.status).toBe(403);
    });
  });
});

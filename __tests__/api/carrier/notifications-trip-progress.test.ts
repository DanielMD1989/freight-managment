/**
 * Trip Progress Notifications — Round N3
 *
 * G-N3-1: PICKUP_PENDING → all active shipper users receive TRIP_STARTED
 * G-N3-2: IN_TRANSIT → all active shipper users receive TRIP_IN_TRANSIT
 * G-N3-3: DELIVERED → all active shipper users receive TRIP_DELIVERED
 */

// @jest-environment node

import { db } from "@/lib/db";
import {
  setAuthSession,
  createMockSession,
  createRequest,
  parseResponse,
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

jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFee: jest.fn(async () => ({
    success: true,
    platformRevenue: { greaterThan: () => false },
    totalPlatformFee: 0,
  })),
  refundServiceFee: jest.fn(async () => {}),
  validateWalletBalancesForTrip: jest.fn(async () => ({ valid: true })),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

const { PATCH: patchTrip } = require("@/app/api/trips/[tripId]/route");

function callPatch(tripId: string, body: object) {
  const req = createRequest(
    "PATCH",
    `http://localhost:3000/api/trips/${tripId}`,
    { body }
  );
  return patchTrip(req, { params: Promise.resolve({ tripId }) });
}

// ─── Shared setup ────────────────────────────────────────────────────────────

async function seedWorld(prefix: string, initialStatus: string = "ASSIGNED") {
  const shipperOrg = await db.organization.create({
    data: {
      id: `${prefix}-shipper`,
      name: `${prefix} Shipper`,
      type: "SHIPPER",
      contactEmail: `${prefix}-shipper@test.com`,
      contactPhone: "+251911000001",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  const carrierOrg = await db.organization.create({
    data: {
      id: `${prefix}-carrier`,
      name: `${prefix} Carrier`,
      type: "CARRIER_COMPANY",
      contactEmail: `${prefix}-carrier@test.com`,
      contactPhone: "+251911000002",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  const shipperUserA = await db.user.create({
    data: {
      id: `${prefix}-ship-a`,
      email: `${prefix}-a@shipper.com`,
      passwordHash: "hash",
      firstName: "Ship",
      lastName: "A",
      phone: "+251911000003",
      role: "SHIPPER",
      status: "ACTIVE",
      isActive: true,
      organizationId: shipperOrg.id,
    },
  });

  const shipperUserB = await db.user.create({
    data: {
      id: `${prefix}-ship-b`,
      email: `${prefix}-b@shipper.com`,
      passwordHash: "hash",
      firstName: "Ship",
      lastName: "B",
      phone: "+251911000004",
      role: "SHIPPER",
      status: "ACTIVE",
      isActive: true,
      organizationId: shipperOrg.id,
    },
  });

  const carrierUser = await db.user.create({
    data: {
      id: `${prefix}-car-u`,
      email: `${prefix}-u@carrier.com`,
      passwordHash: "hash",
      firstName: "Car",
      lastName: "U",
      phone: "+251911000005",
      role: "CARRIER",
      status: "ACTIVE",
      isActive: true,
      organizationId: carrierOrg.id,
    },
  });

  const truck = await db.truck.create({
    data: {
      id: `${prefix}-truck`,
      truckType: "DRY_VAN",
      licensePlate: `${prefix.toUpperCase()}-001`,
      capacity: 10000,
      isAvailable: false,
      carrierId: carrierOrg.id,
      createdById: carrierUser.id,
      approvalStatus: "APPROVED",
    },
  });

  const load = await db.load.create({
    data: {
      id: `${prefix}-load`,
      status: "ASSIGNED",
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 5000,
      cargoDescription: "Test cargo",
      shipperId: shipperOrg.id,
      createdById: shipperUserA.id,
      assignedTruckId: truck.id,
      postedAt: new Date(),
    },
  });

  const trip = await db.trip.create({
    data: {
      id: `${prefix}-trip`,
      status: initialStatus,
      loadId: load.id,
      truckId: truck.id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
    },
  });

  return {
    shipperOrg,
    carrierOrg,
    shipperUserA,
    shipperUserB,
    carrierUser,
    truck,
    load,
    trip,
  };
}

describe("Trip Progress Notifications (G-N3-1, G-N3-2, G-N3-3)", () => {
  let notifyOrganization: jest.Mock;

  beforeAll(() => {
    notifyOrganization = require("@/lib/notifications").notifyOrganization;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // TP-1
  it("TP-1: ASSIGNED→PICKUP_PENDING fires TRIP_STARTED to shipper org", async () => {
    const { shipperOrg, carrierUser, trip } = await seedWorld("tp1");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    const res = await callPatch(trip.id, { status: "PICKUP_PENDING" });
    const body = await parseResponse(res);
    expect(res.status).toBe(200);
    expect(body.trip.status).toBe("PICKUP_PENDING");

    const notifyCalls = (notifyOrganization as jest.Mock).mock.calls;
    const startedCall = notifyCalls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id && c[0].type === "TRIP_STARTED"
    );
    expect(startedCall).toBeDefined();
    expect(startedCall[0].metadata?.tripId).toBe(trip.id);
  });

  // TP-2
  it("TP-2: PICKUP_PENDING→IN_TRANSIT fires TRIP_IN_TRANSIT to shipper org", async () => {
    const { shipperOrg, carrierUser, trip } = await seedWorld(
      "tp2",
      "PICKUP_PENDING"
    );

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    const res = await callPatch(trip.id, { status: "IN_TRANSIT" });
    expect(res.status).toBe(200);

    const notifyCalls = (notifyOrganization as jest.Mock).mock.calls;
    const transitCall = notifyCalls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id && c[0].type === "TRIP_IN_TRANSIT"
    );
    expect(transitCall).toBeDefined();
    expect(transitCall[0].metadata?.tripId).toBe(trip.id);
  });

  // TP-3
  it("TP-3: IN_TRANSIT→DELIVERED fires TRIP_DELIVERED to shipper org", async () => {
    const { shipperOrg, carrierUser, trip } = await seedWorld(
      "tp3",
      "IN_TRANSIT"
    );

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    const res = await callPatch(trip.id, { status: "DELIVERED" });
    expect(res.status).toBe(200);

    const notifyCalls = (notifyOrganization as jest.Mock).mock.calls;
    const deliveredCall = notifyCalls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id && c[0].type === "TRIP_DELIVERED"
    );
    expect(deliveredCall).toBeDefined();
    expect(deliveredCall[0].metadata?.tripId).toBe(trip.id);
  });

  // TP-4: PICKUP_PENDING does NOT fire TRIP_IN_TRANSIT (wrong type)
  it("TP-4: PICKUP_PENDING transition does not fire TRIP_IN_TRANSIT", async () => {
    const { carrierUser, trip } = await seedWorld("tp4");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    await callPatch(trip.id, { status: "PICKUP_PENDING" });

    const notifyCalls = (notifyOrganization as jest.Mock).mock.calls;
    const transitCall = notifyCalls.find(
      (c: any[]) => c[0].type === "TRIP_IN_TRANSIT"
    );
    expect(transitCall).toBeUndefined();
  });

  // TP-5: Non-carrier role also triggers notifications (admin)
  it("TP-5: Admin can advance ASSIGNED→PICKUP_PENDING and shipper gets notified", async () => {
    const { shipperOrg, trip } = await seedWorld("tp5");

    setAuthSession(
      createMockSession({
        userId: "tp5-admin",
        role: "ADMIN",
        organizationId: undefined,
      })
    );

    const res = await callPatch(trip.id, { status: "PICKUP_PENDING" });
    expect(res.status).toBe(200);

    const notifyCalls = (notifyOrganization as jest.Mock).mock.calls;
    const startedCall = notifyCalls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id && c[0].type === "TRIP_STARTED"
    );
    expect(startedCall).toBeDefined();
  });
});

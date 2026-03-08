/**
 * Exception Notifications — Round N3
 *
 * G-N3-4: EXCEPTION raised → ADMIN notified (in addition to DISPATCHER)
 * G-N3-5: EXCEPTION resolved → carrier and shipper org users notified
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

async function seedTrip(prefix: string, status: string = "IN_TRANSIT") {
  const shipperOrg = await db.organization.create({
    data: {
      id: `${prefix}-shipper`,
      name: `${prefix} Shipper`,
      type: "SHIPPER",
      contactEmail: `${prefix}-shipper@test.com`,
      contactPhone: "+251922000001",
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
      contactPhone: "+251922000002",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  const carrierUser = await db.user.create({
    data: {
      id: `${prefix}-car-u`,
      email: `${prefix}-car@test.com`,
      passwordHash: "hash",
      firstName: "Car",
      lastName: "U",
      phone: "+251922000003",
      role: "CARRIER",
      status: "ACTIVE",
      isActive: true,
      organizationId: carrierOrg.id,
    },
  });

  const shipperUser = await db.user.create({
    data: {
      id: `${prefix}-ship-u`,
      email: `${prefix}-ship@test.com`,
      passwordHash: "hash",
      firstName: "Ship",
      lastName: "U",
      phone: "+251922000004",
      role: "SHIPPER",
      status: "ACTIVE",
      isActive: true,
      organizationId: shipperOrg.id,
    },
  });

  const adminUser = await db.user.create({
    data: {
      id: `${prefix}-admin-u`,
      email: `${prefix}-admin@test.com`,
      passwordHash: "hash",
      firstName: "Admin",
      lastName: "U",
      phone: "+251922000005",
      role: "ADMIN",
      status: "ACTIVE",
      isActive: true,
    },
  });

  const dispatcherOrg = await db.organization.create({
    data: {
      id: `${prefix}-disp-org`,
      name: `${prefix} Dispatcher Org`,
      type: "DISPATCHER",
      contactEmail: `${prefix}-disp@test.com`,
      contactPhone: "+251922000006",
      isVerified: true,
    },
  });

  const dispatcherUser = await db.user.create({
    data: {
      id: `${prefix}-disp-u`,
      email: `${prefix}-disp@test.com`,
      passwordHash: "hash",
      firstName: "Disp",
      lastName: "U",
      phone: "+251922000007",
      role: "DISPATCHER",
      status: "ACTIVE",
      isActive: true,
      organizationId: dispatcherOrg.id,
    },
  });

  const truck = await db.truck.create({
    data: {
      id: `${prefix}-truck`,
      truckType: "DRY_VAN",
      licensePlate: `EXC-${prefix.toUpperCase()}`,
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
      status: "IN_TRANSIT",
      pickupCity: "Hawassa",
      deliveryCity: "Jimma",
      pickupDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 4000,
      cargoDescription: "Exception test cargo",
      shipperId: shipperOrg.id,
      createdById: shipperUser.id,
      assignedTruckId: truck.id,
      postedAt: new Date(),
    },
  });

  const trip = await db.trip.create({
    data: {
      id: `${prefix}-trip`,
      status,
      loadId: load.id,
      truckId: truck.id,
      carrierId: carrierOrg.id,
      shipperId: shipperOrg.id,
    },
  });

  return {
    shipperOrg,
    carrierOrg,
    shipperUser,
    carrierUser,
    adminUser,
    dispatcherOrg,
    dispatcherUser,
    truck,
    load,
    trip,
  };
}

describe("Exception Notifications (G-N3-4, G-N3-5)", () => {
  let createNotificationForRole: jest.Mock;
  let notifyOrganization: jest.Mock;

  beforeAll(() => {
    createNotificationForRole =
      require("@/lib/notifications").createNotificationForRole;
    notifyOrganization = require("@/lib/notifications").notifyOrganization;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // EA-1: Raising EXCEPTION notifies DISPATCHER
  it("EA-1: IN_TRANSIT→EXCEPTION fires EXCEPTION_CREATED to DISPATCHER role", async () => {
    const { carrierUser, trip } = await seedTrip("ea1");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    const res = await callPatch(trip.id, { status: "EXCEPTION" });
    expect(res.status).toBe(200);

    const dispatcherCall = createNotificationForRole.mock.calls.find(
      (c: any[]) =>
        c[0].role === "DISPATCHER" && c[0].type === "EXCEPTION_CREATED"
    );
    expect(dispatcherCall).toBeDefined();
    expect(dispatcherCall[0].metadata?.tripId).toBe(trip.id);
  });

  // EA-2 (G-N3-4): Raising EXCEPTION also notifies ADMIN
  it("EA-2: IN_TRANSIT→EXCEPTION fires EXCEPTION_CREATED to ADMIN role (G-N3-4)", async () => {
    const { carrierUser, trip } = await seedTrip("ea2");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    const res = await callPatch(trip.id, { status: "EXCEPTION" });
    expect(res.status).toBe(200);

    const adminCall = createNotificationForRole.mock.calls.find(
      (c: any[]) => c[0].role === "ADMIN" && c[0].type === "EXCEPTION_CREATED"
    );
    expect(adminCall).toBeDefined();
    expect(adminCall[0].metadata?.tripId).toBe(trip.id);
  });

  // EA-3: Both DISPATCHER and ADMIN are notified in the same EXCEPTION transition
  it("EA-3: both DISPATCHER and ADMIN called when EXCEPTION raised", async () => {
    const { carrierUser, trip } = await seedTrip("ea3");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    await callPatch(trip.id, { status: "EXCEPTION" });

    const roles = createNotificationForRole.mock.calls.map(
      (c: any[]) => c[0].role
    );
    expect(roles).toContain("DISPATCHER");
    expect(roles).toContain("ADMIN");
  });

  // EA-4 (G-N3-5): EXCEPTION resolved → carrier org notified with EXCEPTION_RESOLVED
  it("EA-4: EXCEPTION→ASSIGNED fires EXCEPTION_RESOLVED to carrier org (G-N3-5)", async () => {
    const { carrierOrg, trip } = await seedTrip("ea4", "EXCEPTION");

    setAuthSession(
      createMockSession({
        userId: "ea4-admin",
        role: "ADMIN",
        organizationId: undefined,
      })
    );

    const res = await callPatch(trip.id, { status: "ASSIGNED" });
    expect(res.status).toBe(200);

    const carrierResolve = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === carrierOrg.id &&
        c[0].type === "EXCEPTION_RESOLVED"
    );
    expect(carrierResolve).toBeDefined();
    expect(carrierResolve[0].metadata?.newStatus).toBe("ASSIGNED");
  });

  // EA-5 (G-N3-5): EXCEPTION resolved → shipper org also notified
  it("EA-5: EXCEPTION→ASSIGNED fires EXCEPTION_RESOLVED to shipper org (G-N3-5)", async () => {
    const { shipperOrg, trip } = await seedTrip("ea5", "EXCEPTION");

    setAuthSession(
      createMockSession({
        userId: "ea5-admin",
        role: "ADMIN",
        organizationId: undefined,
      })
    );

    const res = await callPatch(trip.id, { status: "ASSIGNED" });
    expect(res.status).toBe(200);

    const shipperResolve = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id &&
        c[0].type === "EXCEPTION_RESOLVED"
    );
    expect(shipperResolve).toBeDefined();
  });

  // EA-6: Non-exception transitions do NOT fire EXCEPTION_RESOLVED
  it("EA-6: ASSIGNED→PICKUP_PENDING does NOT fire EXCEPTION_RESOLVED", async () => {
    const { carrierUser, trip } = await seedTrip("ea6", "ASSIGNED");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    await callPatch(trip.id, { status: "PICKUP_PENDING" });

    const resolveCall = notifyOrganization.mock.calls.find(
      (c: any[]) => c[0].type === "EXCEPTION_RESOLVED"
    );
    expect(resolveCall).toBeUndefined();
  });
});

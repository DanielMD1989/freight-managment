/**
 * CANCELLED via PATCH Notifications — Round N3
 *
 * G-N3-6: CANCELLED set via PATCH /trips/[id] must notify:
 *   - Shipper always (carrier/admin/dispatcher all cancel)
 *   - Carrier when admin or dispatcher cancels (not when carrier self-cancels)
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

async function seedTrip(prefix: string, status: string = "ASSIGNED") {
  const shipperOrg = await db.organization.create({
    data: {
      id: `${prefix}-shipper`,
      name: `${prefix} Shipper`,
      type: "SHIPPER",
      contactEmail: `${prefix}-shipper@test.com`,
      contactPhone: "+251933000001",
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
      contactPhone: "+251933000002",
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
      phone: "+251933000003",
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
      phone: "+251933000004",
      role: "SHIPPER",
      status: "ACTIVE",
      isActive: true,
      organizationId: shipperOrg.id,
    },
  });

  const dispatcherOrg = await db.organization.create({
    data: {
      id: `${prefix}-disp-org`,
      name: `${prefix} Disp Org`,
      type: "DISPATCHER",
      contactEmail: `${prefix}-disp@test.com`,
      contactPhone: "+251933000005",
      isVerified: true,
    },
  });

  const dispatcherUser = await db.user.create({
    data: {
      id: `${prefix}-disp-u`,
      email: `${prefix}-disp-u@test.com`,
      passwordHash: "hash",
      firstName: "Disp",
      lastName: "U",
      phone: "+251933000006",
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
      licensePlate: `CAN-${prefix.toUpperCase()}`,
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
      pickupCity: "Gondar",
      deliveryCity: "Axum",
      pickupDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 3000,
      cargoDescription: "Cancel test cargo",
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
    carrierUser,
    shipperUser,
    dispatcherOrg,
    dispatcherUser,
    truck,
    load,
    trip,
  };
}

describe("CANCELLED via PATCH Notifications (G-N3-6)", () => {
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

  // CP-1: Carrier self-cancel → shipper notified
  it("CP-1: carrier sets CANCELLED via PATCH → shipper org receives TRIP_CANCELLED", async () => {
    const { shipperOrg, carrierUser, trip } = await seedTrip("cp1");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    const res = await callPatch(trip.id, { status: "CANCELLED" });
    expect(res.status).toBe(200);

    const shipperCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id && c[0].type === "TRIP_CANCELLED"
    );
    expect(shipperCall).toBeDefined();
  });

  // CP-2: Carrier self-cancel → carrier does NOT receive notification
  it("CP-2: carrier self-cancel → carrier org NOT notified (they initiated)", async () => {
    const { carrierOrg, carrierUser, trip } = await seedTrip("cp2");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    await callPatch(trip.id, { status: "CANCELLED" });

    const carrierCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === carrierOrg.id && c[0].type === "TRIP_CANCELLED"
    );
    expect(carrierCall).toBeUndefined();
  });

  // CP-3: Admin cancels → both shipper and carrier notified
  it("CP-3: admin sets CANCELLED via PATCH → both shipper and carrier orgs notified", async () => {
    const { shipperOrg, carrierOrg, trip } = await seedTrip("cp3");

    setAuthSession(
      createMockSession({
        userId: "cp3-admin",
        role: "ADMIN",
        organizationId: undefined,
      })
    );

    const res = await callPatch(trip.id, { status: "CANCELLED" });
    expect(res.status).toBe(200);

    const shipperCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id && c[0].type === "TRIP_CANCELLED"
    );
    const carrierCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === carrierOrg.id && c[0].type === "TRIP_CANCELLED"
    );
    expect(shipperCall).toBeDefined();
    expect(carrierCall).toBeDefined();
  });

  // CP-4: Dispatcher cancels (scoped to carrier side) → both shipper and carrier notified
  it("CP-4: dispatcher sets CANCELLED via PATCH → both orgs notified", async () => {
    const { shipperOrg, carrierOrg, dispatcherUser, trip } =
      await seedTrip("cp4");

    setAuthSession(
      createMockSession({
        userId: dispatcherUser.id,
        role: "DISPATCHER",
        organizationId: trip.carrierId,
      })
    );

    const res = await callPatch(trip.id, { status: "CANCELLED" });
    expect(res.status).toBe(200);

    const shipperCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id && c[0].type === "TRIP_CANCELLED"
    );
    const carrierCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === carrierOrg.id && c[0].type === "TRIP_CANCELLED"
    );
    expect(shipperCall).toBeDefined();
    expect(carrierCall).toBeDefined();
  });

  // CP-5: metadata includes tripId
  it("CP-5: TRIP_CANCELLED notification metadata contains tripId and loadId", async () => {
    const { carrierUser, trip } = await seedTrip("cp5");

    setAuthSession(
      createMockSession({
        userId: carrierUser.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    await callPatch(trip.id, { status: "CANCELLED" });

    const calls = notifyOrganization.mock.calls.filter(
      (c: any[]) => c[0].type === "TRIP_CANCELLED"
    );
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0].metadata?.tripId).toBe(trip.id);
    expect(calls[0][0].metadata?.loadId).toBe(trip.loadId);
  });
});

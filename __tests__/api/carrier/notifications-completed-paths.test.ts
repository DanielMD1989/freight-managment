/**
 * Trip Completion Notification Paths — Round N3
 *
 * G-N3-7: PUT /loads/[id]/pod (shipper POD verify) → DELIVERY_CONFIRMED to all active shipper users
 * G-N3-8: POST /trips/[id]/confirm → POD_VERIFIED to ALL active carrier users (not just first)
 * G-N3-9: POST /trips/[id]/cancel → TRIP_CANCELLED to ALL active shipper/carrier users (not just first)
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

const mockDeductFee = jest.fn(async () => ({
  success: true,
  platformRevenue: { greaterThan: () => false },
  totalPlatformFee: 0,
  shipperFee: 0,
  carrierFee: 0,
  transactionId: null,
}));

jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFee: (...args: any[]) => mockDeductFee(...args),
  refundServiceFee: jest.fn(async () => {}),
  validateWalletBalancesForTrip: jest.fn(async () => ({ valid: true })),
}));

jest.mock("@/lib/storage", () => ({
  uploadPOD: jest.fn(async () => ({
    success: true,
    url: "https://cdn.test/pod.pdf",
  })),
}));

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  zodErrorResponse: jest.fn((err: any) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json({ error: "Validation error" }, { status: 400 });
  }),
}));

const { PUT: verifyPod } = require("@/app/api/loads/[id]/pod/route");
const { POST: confirmTrip } = require("@/app/api/trips/[tripId]/confirm/route");
const { POST: cancelTrip } = require("@/app/api/trips/[tripId]/cancel/route");

function callVerifyPod(loadId: string) {
  const req = createRequest(
    "PUT",
    `http://localhost:3000/api/loads/${loadId}/pod`,
    { body: {} }
  );
  return verifyPod(req, { params: Promise.resolve({ id: loadId }) });
}

function callConfirmTrip(tripId: string) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/trips/${tripId}/confirm`,
    { body: {} }
  );
  return confirmTrip(req, { params: Promise.resolve({ tripId }) });
}

function callCancelTrip(tripId: string, reason: string = "Test cancellation") {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/trips/${tripId}/cancel`,
    { body: { reason } }
  );
  return cancelTrip(req, { params: Promise.resolve({ tripId }) });
}

// ── Helper: seed a delivered trip ────────────────────────────────────────────

async function seedDeliveredWorld(prefix: string) {
  const shipperOrg = await db.organization.create({
    data: {
      id: `${prefix}-shipper`,
      name: `${prefix} Shipper`,
      type: "SHIPPER",
      contactEmail: `${prefix}-shipper@test.com`,
      contactPhone: "+251944000001",
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
      contactPhone: "+251944000002",
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
      phone: "+251944000003",
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
      phone: "+251944000004",
      role: "SHIPPER",
      status: "ACTIVE",
      isActive: true,
      organizationId: shipperOrg.id,
    },
  });

  const carrierUserA = await db.user.create({
    data: {
      id: `${prefix}-car-a`,
      email: `${prefix}-a@carrier.com`,
      passwordHash: "hash",
      firstName: "Car",
      lastName: "A",
      phone: "+251944000005",
      role: "CARRIER",
      status: "ACTIVE",
      isActive: true,
      organizationId: carrierOrg.id,
    },
  });

  const carrierUserB = await db.user.create({
    data: {
      id: `${prefix}-car-b`,
      email: `${prefix}-b@carrier.com`,
      passwordHash: "hash",
      firstName: "Car",
      lastName: "B",
      phone: "+251944000006",
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
      licensePlate: `CPL-${prefix.toUpperCase()}`,
      capacity: 10000,
      isAvailable: false,
      carrierId: carrierOrg.id,
      createdById: carrierUserA.id,
      approvalStatus: "APPROVED",
    },
  });

  const load = await db.load.create({
    data: {
      id: `${prefix}-load`,
      status: "DELIVERED",
      pickupCity: "Bahir Dar",
      deliveryCity: "Lalibela",
      pickupDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
      truckType: "DRY_VAN",
      weight: 6000,
      cargoDescription: "Completion test cargo",
      shipperId: shipperOrg.id,
      createdById: shipperUserA.id,
      assignedTruckId: truck.id,
      podSubmitted: true,
      podSubmittedAt: new Date(),
      podUrl: "https://cdn.test/pod.pdf",
      postedAt: new Date(),
    },
  });

  const trip = await db.trip.create({
    data: {
      id: `${prefix}-trip`,
      status: "DELIVERED",
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
    carrierUserA,
    carrierUserB,
    truck,
    load,
    trip,
  };
}

// ── G-N3-8: /confirm sends POD_VERIFIED to ALL active carrier users ───────────

describe("G-N3-8: confirm — all active carrier users get POD_VERIFIED", () => {
  let notifyOrganization: jest.Mock;

  beforeAll(() => {
    notifyOrganization = require("@/lib/notifications").notifyOrganization;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeductFee.mockResolvedValue({
      success: true,
      platformRevenue: { greaterThan: () => false },
      totalPlatformFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      transactionId: null,
    });
  });

  // CF-1
  it("CF-1: shipper confirm → POD_VERIFIED sent to carrier org (all active users)", async () => {
    const { shipperUserA, carrierOrg, trip } = await seedDeliveredWorld("cf1");

    setAuthSession(
      createMockSession({
        userId: shipperUserA.id,
        role: "SHIPPER",
        organizationId: trip.shipperId,
      })
    );

    const res = await callConfirmTrip(trip.id);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);

    const podVerifiedCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === carrierOrg.id && c[0].type === "POD_VERIFIED"
    );
    expect(podVerifiedCall).toBeDefined();
  });

  // CF-2: metadata contains tripId
  it("CF-2: POD_VERIFIED metadata includes tripId and loadId", async () => {
    const { shipperUserA, trip } = await seedDeliveredWorld("cf2");

    setAuthSession(
      createMockSession({
        userId: shipperUserA.id,
        role: "SHIPPER",
        organizationId: trip.shipperId,
      })
    );

    await callConfirmTrip(trip.id);

    const call = notifyOrganization.mock.calls.find(
      (c: any[]) => c[0].type === "POD_VERIFIED"
    );
    expect(call).toBeDefined();
    expect(call[0].metadata?.tripId).toBe(trip.id);
    expect(call[0].metadata?.loadId).toBe(trip.loadId);
  });
});

// ── G-N3-7: PUT /loads/[id]/pod fires DELIVERY_CONFIRMED to shipper org ──────

describe("G-N3-7: PUT /loads/[id]/pod — DELIVERY_CONFIRMED to all active shipper users", () => {
  let notifyOrganization: jest.Mock;

  beforeAll(() => {
    notifyOrganization = require("@/lib/notifications").notifyOrganization;
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeductFee.mockResolvedValue({
      success: true,
      platformRevenue: { greaterThan: () => false },
      totalPlatformFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      transactionId: null,
    });
  });

  // PV-1: shipper verifies POD → DELIVERY_CONFIRMED fires to shipper org
  it("PV-1: shipper POD verify → DELIVERY_CONFIRMED to shipper org after trip completes (G-N3-7)", async () => {
    const { shipperOrg, shipperUserA, load, trip } =
      await seedDeliveredWorld("pv1");

    setAuthSession(
      createMockSession({
        userId: shipperUserA.id,
        role: "SHIPPER",
        organizationId: shipperOrg.id,
      })
    );

    // Load must have podSubmitted=false for PUT to accept (POD upload via PUT)
    // In this test we set podVerified=false; podSubmitted=true already done in seed
    const res = await callVerifyPod(load.id);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);

    // Wait for fire-and-forget call to register
    await new Promise((r) => setImmediate(r));

    // Should fire DELIVERY_CONFIRMED to shipper org since trip flips to COMPLETED
    const deliveryConfirmedCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id &&
        c[0].type === "DELIVERY_CONFIRMED"
    );
    expect(deliveryConfirmedCall).toBeDefined();
    expect(deliveryConfirmedCall[0].metadata?.loadId).toBe(load.id);
  });
});

// ── G-N3-9: POST /trips/[id]/cancel → all active org users ──────────────────

describe("G-N3-9: cancel route — all active org users notified (not just first)", () => {
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

  async function seedAssignedForCancel(prefix: string) {
    const shipperOrg = await db.organization.create({
      data: {
        id: `${prefix}-shipper`,
        name: `${prefix} Shipper`,
        type: "SHIPPER",
        contactEmail: `${prefix}-shipper@test.com`,
        contactPhone: "+251955000001",
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
        contactPhone: "+251955000002",
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
        phone: "+251955000003",
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
        phone: "+251955000004",
        role: "SHIPPER",
        status: "ACTIVE",
        isActive: true,
        organizationId: shipperOrg.id,
      },
    });

    const carrierUserA = await db.user.create({
      data: {
        id: `${prefix}-car-a`,
        email: `${prefix}-a@carrier.com`,
        passwordHash: "hash",
        firstName: "Car",
        lastName: "A",
        phone: "+251955000005",
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
        licensePlate: `CNCAN-${prefix.toUpperCase()}`,
        capacity: 10000,
        isAvailable: false,
        carrierId: carrierOrg.id,
        createdById: carrierUserA.id,
        approvalStatus: "APPROVED",
      },
    });

    const load = await db.load.create({
      data: {
        id: `${prefix}-load`,
        status: "ASSIGNED",
        pickupCity: "Dessie",
        deliveryCity: "Kombolcha",
        pickupDate: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
        truckType: "DRY_VAN",
        weight: 2000,
        cargoDescription: "Cancel route test cargo",
        shipperId: shipperOrg.id,
        createdById: shipperUserA.id,
        assignedTruckId: truck.id,
        postedAt: new Date(),
      },
    });

    const trip = await db.trip.create({
      data: {
        id: `${prefix}-trip`,
        status: "ASSIGNED",
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
      carrierUserA,
      truck,
      load,
      trip,
    };
  }

  // CN-1: carrier cancels → shipper org gets TRIP_CANCELLED via notifyOrganization
  it("CN-1: carrier cancels via /cancel → notifyOrganization called for shipper org", async () => {
    const { shipperOrg, carrierUserA, trip } =
      await seedAssignedForCancel("cn1");

    setAuthSession(
      createMockSession({
        userId: carrierUserA.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    const res = await callCancelTrip(trip.id, "Engine trouble");
    expect(res.status).toBe(200);

    const shipperCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === shipperOrg.id && c[0].type === "TRIP_CANCELLED"
    );
    expect(shipperCall).toBeDefined();
    expect(shipperCall[0].metadata?.tripId).toBe(trip.id);
  });

  // CN-2: carrier cancels → carrier org NOT notified (they initiated)
  it("CN-2: carrier self-cancel → carrier org NOT notified via cancel route", async () => {
    const { carrierOrg, carrierUserA, trip } =
      await seedAssignedForCancel("cn2");

    setAuthSession(
      createMockSession({
        userId: carrierUserA.id,
        role: "CARRIER",
        organizationId: trip.carrierId,
      })
    );

    await callCancelTrip(trip.id, "Driver sick");

    const carrierCall = notifyOrganization.mock.calls.find(
      (c: any[]) =>
        c[0].organizationId === carrierOrg.id && c[0].type === "TRIP_CANCELLED"
    );
    expect(carrierCall).toBeUndefined();
  });

  // CN-3: admin cancels → both orgs notified
  it("CN-3: admin cancels via /cancel → both shipper and carrier orgs notified", async () => {
    const { shipperOrg, carrierOrg, trip } = await seedAssignedForCancel("cn3");

    setAuthSession(
      createMockSession({
        userId: "cn3-admin",
        role: "ADMIN",
        organizationId: undefined,
      })
    );

    const res = await callCancelTrip(trip.id, "Admin override");
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
});

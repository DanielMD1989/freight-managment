// @jest-environment node
/**
 * Service Fee Settlement Guard Tests — Round A15
 *
 * Verifies that settlementStatus=PAID is only set when fees were actually
 * collected (platformRevenue > 0) or when fees are legitimately waived
 * (totalPlatformFee = 0, e.g. no corridor match).
 *
 * G-A15-1: settlementStatus guard in 3 completion paths
 * G-A15-2: Admin org rates PATCH endpoint
 * G-A15-3: GET /loads/[id]/service-fee returns carrierFee (dual-party preview)
 *
 * SF1 — PATCH COMPLETED, wallets full → settlementStatus=PAID
 * SF2 — PATCH COMPLETED, wallets empty → settlementStatus NOT PAID
 * SF3 — POST /confirm, wallets full → settlementStatus=PAID
 * SF4 — POST /confirm, wallets empty → settlementStatus NOT PAID
 * SF5 — PUT /loads/[id]/pod, wallets full → settlementStatus=PAID
 * SF6 — PUT /loads/[id]/pod, wallets empty → settlementStatus NOT PAID
 * SF7 — PATCH /admin/orgs/[id]/rates as ADMIN → 200, rates in DB
 * SF8 — PATCH /admin/orgs/[id]/rates as CARRIER → 403
 * SF9 — GET /loads/[id]/service-fee → response includes carrierFee
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
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
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
} from "../../utils/routeTestUtils";

// ─── Shared mocks ─────────────────────────────────────────────────────────────

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
mockLoadStateMachine();
mockLoadUtils();
mockTrustMetrics();
mockBypassDetection();
mockStorage();
mockAssignmentConflicts();
mockServiceFeeCalculation();

// ─── Controllable deductServiceFee mock ───────────────────────────────────────
// platformRevenue uses a Decimal-like mock: routes call .greaterThan(0)
const makeDecimalLike = (val: number) => ({
  greaterThan: (n: number) => val > n,
});

const mockDeductFee = jest.fn(async () => ({
  success: true,
  serviceFee: 150,
  shipperFee: 100,
  carrierFee: 50,
  totalPlatformFee: 150,
  platformRevenue: makeDecimalLike(150), // wallets full: 150 > 0 → true
  transactionId: "txn-sf-test",
  details: {
    shipper: { baseFee: 100, discount: 0, finalFee: 100, walletDeducted: true },
    carrier: { baseFee: 50, discount: 0, finalFee: 50, walletDeducted: true },
  },
}));

jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFees: jest.fn(async () => ({ success: true })),
  deductServiceFee: (...args: unknown[]) => mockDeductFee(...args),
  refundServiceFee: jest.fn(async () => ({
    success: true,
    serviceFee: 100,
    shipperBalance: 900,
    transactionId: "refund-mock",
  })),
}));

// ─── Handlers (imported after mocks) ──────────────────────────────────────────
const { PATCH: updateTrip } = require("@/app/api/trips/[tripId]/route");
const {
  POST: confirmDelivery,
} = require("@/app/api/trips/[tripId]/confirm/route");
const { PUT: verifyPod } = require("@/app/api/loads/[id]/pod/route");
const {
  PATCH: updateOrgRates,
} = require("@/app/api/admin/organizations/[id]/rates/route");
const {
  GET: getServiceFee,
} = require("@/app/api/loads/[id]/service-fee/route");

// ─── IDs & sessions ───────────────────────────────────────────────────────────

const SHIPPER_ORG = "sf-shipper-org";
const CARRIER_ORG = "sf-carrier-org";
const TRUCK_ID = "sf-truck-01";
const LOAD_ID = "sf-load-01";
const TRIP_ID = "sf-trip-01";
const CORRIDOR_ID = "sf-corridor-01";

const carrierSession = createMockSession({
  userId: "sf-carrier-user",
  role: "CARRIER",
  organizationId: CARRIER_ORG,
});

const shipperSession = createMockSession({
  userId: "sf-shipper-user",
  role: "SHIPPER",
  organizationId: SHIPPER_ORG,
});

const adminSession = createMockSession({
  userId: "sf-admin-user",
  role: "ADMIN",
  organizationId: "sf-admin-org",
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function seedBase({
  tripStatus = "DELIVERED",
  podSubmitted = true,
} = {}) {
  await db.organization.create({
    data: { id: SHIPPER_ORG, name: "SF Shipper", type: "SHIPPER" },
  });
  await db.organization.create({
    data: { id: CARRIER_ORG, name: "SF Carrier", type: "CARRIER" },
  });

  // User record needed for pod PUT (db.user.findUnique for organizationId check)
  await db.user.create({
    data: {
      id: shipperSession.userId,
      email: "sf-shipper@test.com",
      name: "SF Shipper User",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: SHIPPER_ORG,
    },
  });
  await db.user.create({
    data: {
      id: carrierSession.userId,
      email: "sf-carrier@test.com",
      name: "SF Carrier User",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: CARRIER_ORG,
    },
  });

  await db.truck.create({
    data: {
      id: TRUCK_ID,
      licensePlate: "SF-TRUCK-01",
      truckType: "FLATBED",
      carrierId: CARRIER_ORG,
      isAvailable: false,
    },
  });

  await db.load.create({
    data: {
      id: LOAD_ID,
      shipperId: SHIPPER_ORG,
      status: tripStatus === "DELIVERED" ? "DELIVERED" : "COMPLETED",
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      truckType: "FLATBED",
      cargoDescription: "SF test cargo",
      weight: 1000,
      podSubmitted,
      assignedTruckId: TRUCK_ID,
    },
  });

  await db.trip.create({
    data: {
      id: TRIP_ID,
      loadId: LOAD_ID,
      truckId: TRUCK_ID,
      carrierId: CARRIER_ORG,
      shipperId: SHIPPER_ORG,
      status: tripStatus,
      shipperConfirmed: false,
    },
  });
}

// ─── Setup / teardown ─────────────────────────────────────────────────────────

beforeEach(async () => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  clearAllStores();

  (db.$transaction as jest.Mock).mockImplementation(
    async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)
  );

  // Reset to clear any unconsumed mockResolvedValueOnce items from prior tests.
  // jest.clearAllMocks() does NOT clear the once queue; mockReset() does.
  mockDeductFee.mockReset();

  // Default mock: wallets full (platformRevenue > 0)
  mockDeductFee.mockResolvedValue({
    success: true,
    serviceFee: 150,
    shipperFee: 100,
    carrierFee: 50,
    totalPlatformFee: 150,
    platformRevenue: makeDecimalLike(150),
    transactionId: "txn-sf-test",
    details: {
      shipper: {
        baseFee: 100,
        discount: 0,
        finalFee: 100,
        walletDeducted: true,
      },
      carrier: { baseFee: 50, discount: 0, finalFee: 50, walletDeducted: true },
    },
  });
});

// ─── SF1 + SF2 — PATCH /trips/[tripId] COMPLETED ─────────────────────────────

describe("G-A15-1 — PATCH COMPLETED settlement guard", () => {
  it("SF1 — wallets full (platformRevenue > 0) → settlementStatus=PAID", async () => {
    setAuthSession(carrierSession);
    await seedBase({ tripStatus: "DELIVERED", podSubmitted: true });
    // Default mock: platformRevenue = 150 > 0

    const req = createRequest(
      "PATCH",
      `http://localhost/api/trips/${TRIP_ID}`,
      {
        body: { status: "COMPLETED" },
      }
    );
    const res = await callHandler(updateTrip, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);

    const load = await db.load.findUnique({
      where: { id: LOAD_ID },
      select: { settlementStatus: true },
    });
    expect(load?.settlementStatus).toBe("PAID");
  });

  it("SF2 — wallets empty (platformRevenue = 0) → settlementStatus NOT PAID", async () => {
    setAuthSession(carrierSession);
    await seedBase({ tripStatus: "DELIVERED", podSubmitted: true });

    // Override: empty wallets — nothing collected
    mockDeductFee.mockResolvedValueOnce({
      success: true,
      serviceFee: 0,
      shipperFee: 100,
      carrierFee: 50,
      totalPlatformFee: 150,
      platformRevenue: makeDecimalLike(0), // 0 > 0 → false
      transactionId: undefined,
      details: {
        shipper: {
          baseFee: 100,
          discount: 0,
          finalFee: 100,
          walletDeducted: false,
        },
        carrier: {
          baseFee: 50,
          discount: 0,
          finalFee: 50,
          walletDeducted: false,
        },
      },
    });

    const req = createRequest(
      "PATCH",
      `http://localhost/api/trips/${TRIP_ID}`,
      {
        body: { status: "COMPLETED" },
      }
    );
    const res = await callHandler(updateTrip, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);

    const load = await db.load.findUnique({
      where: { id: LOAD_ID },
      select: { settlementStatus: true },
    });
    expect(load?.settlementStatus).not.toBe("PAID");
  });
});

// ─── SF3 + SF4 — POST /trips/[tripId]/confirm ────────────────────────────────

describe("G-A15-1 — POST /confirm settlement guard", () => {
  it("SF3 — wallets full → settlementStatus=PAID after shipper confirm", async () => {
    setAuthSession(shipperSession);
    await seedBase({ tripStatus: "DELIVERED", podSubmitted: true });

    const req = createRequest(
      "POST",
      `http://localhost/api/trips/${TRIP_ID}/confirm`,
      { body: {} }
    );
    const res = await callHandler(confirmDelivery, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);

    const load = await db.load.findUnique({
      where: { id: LOAD_ID },
      select: { settlementStatus: true },
    });
    expect(load?.settlementStatus).toBe("PAID");
  });

  it("SF4 — wallets empty → settlementStatus NOT PAID after shipper confirm", async () => {
    setAuthSession(shipperSession);
    await seedBase({ tripStatus: "DELIVERED", podSubmitted: true });

    mockDeductFee.mockResolvedValueOnce({
      success: true,
      serviceFee: 0,
      shipperFee: 100,
      carrierFee: 50,
      totalPlatformFee: 150,
      platformRevenue: makeDecimalLike(0),
      transactionId: undefined,
      details: {
        shipper: {
          baseFee: 100,
          discount: 0,
          finalFee: 100,
          walletDeducted: false,
        },
        carrier: {
          baseFee: 50,
          discount: 0,
          finalFee: 50,
          walletDeducted: false,
        },
      },
    });

    const req = createRequest(
      "POST",
      `http://localhost/api/trips/${TRIP_ID}/confirm`,
      { body: {} }
    );
    const res = await callHandler(confirmDelivery, req, { tripId: TRIP_ID });
    expect(res.status).toBe(200);

    const load = await db.load.findUnique({
      where: { id: LOAD_ID },
      select: { settlementStatus: true },
    });
    expect(load?.settlementStatus).not.toBe("PAID");
  });
});

// ─── SF5 + SF6 — PUT /loads/[id]/pod (shipper verify POD) ────────────────────

describe("G-A15-1 — PUT /loads/[id]/pod settlement guard", () => {
  it("SF5 — wallets full → settlementStatus=PAID after shipper verifies POD", async () => {
    setAuthSession(shipperSession);
    await seedBase({ tripStatus: "DELIVERED", podSubmitted: true });

    const req = createRequest(
      "PUT",
      `http://localhost/api/loads/${LOAD_ID}/pod`,
      { body: {} }
    );
    const res = await callHandler(verifyPod, req, { id: LOAD_ID });
    expect(res.status).toBe(200);

    const load = await db.load.findUnique({
      where: { id: LOAD_ID },
      select: { settlementStatus: true },
    });
    expect(load?.settlementStatus).toBe("PAID");
  });

  it("SF6 — wallets empty → settlementStatus NOT PAID after POD verification", async () => {
    setAuthSession(shipperSession);
    await seedBase({ tripStatus: "DELIVERED", podSubmitted: true });

    mockDeductFee.mockResolvedValueOnce({
      success: true,
      serviceFee: 0,
      shipperFee: 100,
      carrierFee: 50,
      totalPlatformFee: 150,
      platformRevenue: makeDecimalLike(0),
      transactionId: undefined,
      details: {
        shipper: {
          baseFee: 100,
          discount: 0,
          finalFee: 100,
          walletDeducted: false,
        },
        carrier: {
          baseFee: 50,
          discount: 0,
          finalFee: 50,
          walletDeducted: false,
        },
      },
    });

    const req = createRequest(
      "PUT",
      `http://localhost/api/loads/${LOAD_ID}/pod`,
      { body: {} }
    );
    const res = await callHandler(verifyPod, req, { id: LOAD_ID });
    expect(res.status).toBe(200);

    const load = await db.load.findUnique({
      where: { id: LOAD_ID },
      select: { settlementStatus: true },
    });
    expect(load?.settlementStatus).not.toBe("PAID");
  });
});

// ─── SF7 + SF8 — PATCH /admin/organizations/[id]/rates ───────────────────────

describe("G-A15-2 — Admin org rates endpoint", () => {
  const ORG_ID = "sf-rates-org";

  beforeEach(async () => {
    await db.organization.create({
      data: { id: ORG_ID, name: "Rates Test Org", type: "CARRIER" },
    });
  });

  it("SF7 — ADMIN can set per-org rate overrides", async () => {
    setAuthSession(adminSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/admin/organizations/${ORG_ID}/rates`,
      {
        body: {
          shipperRatePerKm: 2.5,
          carrierRatePerKm: 1.5,
          shipperPromoFlag: true,
          shipperPromoPct: 10,
          carrierPromoFlag: false,
          carrierPromoPct: null,
        },
      }
    );
    const res = await callHandler(updateOrgRates, req, { id: ORG_ID });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    expect(data.organization.shipperRatePerKm).toBe(2.5);
    expect(data.organization.carrierRatePerKm).toBe(1.5);
    expect(data.organization.shipperPromoFlag).toBe(true);
    expect(data.organization.shipperPromoPct).toBe(10);

    // Verify written to DB
    const org = await db.organization.findUnique({
      where: { id: ORG_ID },
      select: { shipperRatePerKm: true, carrierRatePerKm: true },
    });
    expect(Number(org?.shipperRatePerKm)).toBe(2.5);
    expect(Number(org?.carrierRatePerKm)).toBe(1.5);
  });

  it("SF8 — CARRIER role → 403 (admin-only endpoint)", async () => {
    setAuthSession(carrierSession);

    const req = createRequest(
      "PATCH",
      `http://localhost/api/admin/organizations/${ORG_ID}/rates`,
      { body: { shipperRatePerKm: 5.0 } }
    );
    const res = await callHandler(updateOrgRates, req, { id: ORG_ID });
    expect(res.status).toBe(403);
  });
});

// ─── SF9 — GET /loads/[id]/service-fee dual-party preview ────────────────────

describe("G-A15-3 — Dual-party fee preview endpoint", () => {
  it("SF9 — response includes carrierFee in feeBreakdown", async () => {
    setAuthSession(shipperSession);

    // Seed corridor with dual-party pricing
    await db.organization.create({
      data: { id: SHIPPER_ORG, name: "SF Shipper", type: "SHIPPER" },
    });
    await db.corridor.create({
      data: {
        id: CORRIDOR_ID,
        originRegion: "Addis Ababa",
        destinationRegion: "Hawassa",
        distanceKm: 300,
        pricePerKm: 2,
        shipperPricePerKm: 2.5,
        carrierPricePerKm: 1.5,
        isActive: true,
        createdById: null,
      },
    });
    await db.load.create({
      data: {
        id: LOAD_ID,
        shipperId: SHIPPER_ORG,
        status: "DELIVERED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: "Preview test cargo",
        weight: 500,
        corridorId: CORRIDOR_ID,
      },
    });

    const req = createRequest(
      "GET",
      `http://localhost/api/loads/${LOAD_ID}/service-fee`
    );
    const res = await callHandler(getServiceFee, req, { id: LOAD_ID });
    expect(res.status).toBe(200);

    const data = await parseResponse(res);
    // G-A15-3: feeBreakdown should include dual-party fields
    expect(data.feeBreakdown).toBeDefined();
    expect(data.feeBreakdown).toHaveProperty("carrierFee");
    expect(data.feeBreakdown).toHaveProperty("shipperFee");
    expect(data.feeBreakdown).toHaveProperty("totalFee");
    expect(data.feeBreakdown.distanceKm).toBe(300);
  });
});

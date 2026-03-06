// @jest-environment node
/**
 * Refund on Cancellation Tests — Round 9
 *
 * Tests two layers:
 * 1. refundServiceFee() atomicity, platform balance guard, and amounts (unit)
 * 2. POST /api/loads/[id]/status → CANCELLED triggers refund when fees are DEDUCTED (wiring)
 *
 * US-7.5: refundServiceFee uses single $transaction; platform balance verified before refund
 */

import { db } from "@/lib/db";
import {
  createMockSession,
  setAuthSession,
  createRequest,
  callHandler,
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
  mockLoadStateMachine,
  mockLoadUtils,
  mockTrustMetrics,
  mockBypassDetection,
  mockStorage,
  mockAssignmentConflicts,
  mockServiceFeeCalculation,
  SeedData,
} from "../../utils/routeTestUtils";

// ─── Section A: Route Wiring Tests (mock refundServiceFee) ───────────────────
// These tests verify the POST /api/loads/[id]/status route calls refundServiceFee
// when appropriate. We mock the service fee module here.

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

// Mock service fee module with controllable refundServiceFee spy
jest.mock("@/lib/serviceFeeManagement", () => ({
  validateWalletBalancesForTrip: jest.fn(async () => ({
    valid: true,
    shipperFee: "100.00",
    carrierFee: "50.00",
    errors: [],
  })),
  deductServiceFees: jest.fn(async () => ({ success: true })),
  deductServiceFee: jest.fn(async () => ({
    success: true,
    serviceFee: 150,
    shipperFee: 100,
    carrierFee: 50,
    totalPlatformFee: 150,
    platformRevenue: 150,
    transactionId: "txn-mock",
    details: {
      shipper: { fee: 100, status: "DEDUCTED" },
      carrier: { fee: 50, status: "DEDUCTED" },
    },
  })),
  refundServiceFee: jest.fn(async () => ({
    success: true,
    serviceFee: 100,
    shipperBalance: 900,
    transactionId: "refund-mock",
  })),
}));

// Route handlers (after mocks)
const {
  PATCH: updateLoadStatus,
} = require("@/app/api/loads/[id]/status/route");

// ─── Shared sessions ──────────────────────────────────────────────────────────

const adminSession = createMockSession({
  userId: "admin-ref-user",
  email: "admin@refund.test",
  role: "ADMIN",
  organizationId: "admin-ref-org",
});

const _shipperSession = createMockSession({
  userId: "shipper-ref-user",
  email: "shipper@refund.test",
  role: "SHIPPER",
  organizationId: "shipper-ref-org",
});

const _otherShipperSession = createMockSession({
  userId: "other-shipper-user",
  email: "other@refund.test",
  role: "SHIPPER",
  organizationId: "other-shipper-org",
});

// ─── Seed helpers ─────────────────────────────────────────────────────────────

async function _seedRefundLoad({
  shipperFeeStatus = "DEDUCTED",
  loadStatus = "EXCEPTION",
  organizationId = "shipper-ref-org",
}: {
  shipperFeeStatus?: string;
  loadStatus?: string;
  organizationId?: string;
} = {}) {
  await db.organization.upsert({
    where: { id: "shipper-ref-org" },
    create: { id: "shipper-ref-org", name: "Shipper Ref", type: "SHIPPER" },
    update: {},
  });
  await db.organization.upsert({
    where: { id: "other-shipper-org" },
    create: {
      id: "other-shipper-org",
      name: "Other Shipper",
      type: "SHIPPER",
    },
    update: {},
  });

  const load = await db.load.create({
    data: {
      id: "load-refund-route-01",
      shipperId: organizationId,
      status: loadStatus,
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      truckType: "FLATBED",
      cargoDescription: "Refund test cargo",
      weight: 1000,
      shipperFeeStatus,
      carrierFeeStatus: "PENDING",
    },
  });
  return load;
}

// ─── Route Wiring Tests ───────────────────────────────────────────────────────

describe("BUG-R9-2 Route Wiring — refundServiceFee called on CANCELLED", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    setAuthSession(adminSession);
  });

  it("CANCELLED load with DEDUCTED fees calls refundServiceFee (BUG-R9-2)", async () => {
    await db.load.create({
      data: {
        id: "load-wiring-01",
        shipperId: seed.shipperOrg.id,
        status: "EXCEPTION",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: "Wiring test",
        weight: 1000,
        shipperFeeStatus: "DEDUCTED",
        carrierFeeStatus: "PENDING",
      },
    });

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/loads/load-wiring-01/status",
      { body: { status: "CANCELLED", reason: "Test cancellation" } }
    );
    const res = await callHandler(updateLoadStatus, req, {
      id: "load-wiring-01",
    });

    // Route should return 200
    expect(res.status).toBe(200);

    // refundServiceFee should have been called
    const { refundServiceFee } = require("@/lib/serviceFeeManagement");
    expect(refundServiceFee).toHaveBeenCalledWith("load-wiring-01");
  });

  it("CANCELLED load with PENDING fees does NOT call refundServiceFee", async () => {
    await db.load.create({
      data: {
        id: "load-wiring-02",
        shipperId: seed.shipperOrg.id,
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: "Wiring test 2",
        weight: 1000,
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
      },
    });

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/loads/load-wiring-02/status",
      { body: { status: "CANCELLED", reason: "Test cancellation" } }
    );
    await callHandler(updateLoadStatus, req, { id: "load-wiring-02" });

    const { refundServiceFee } = require("@/lib/serviceFeeManagement");
    expect(refundServiceFee).not.toHaveBeenCalled();
  });

  it("CANCELLED load with WAIVED fees does NOT call refundServiceFee", async () => {
    await db.load.create({
      data: {
        id: "load-wiring-03",
        shipperId: seed.shipperOrg.id,
        status: "IN_TRANSIT",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: "Wiring test 3",
        weight: 1000,
        shipperFeeStatus: "WAIVED",
        carrierFeeStatus: "WAIVED",
      },
    });

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/loads/load-wiring-03/status",
      { body: { status: "CANCELLED", reason: "Test cancellation" } }
    );
    await callHandler(updateLoadStatus, req, { id: "load-wiring-03" });

    const { refundServiceFee } = require("@/lib/serviceFeeManagement");
    expect(refundServiceFee).not.toHaveBeenCalled();
  });

  it("ADMIN cancels DELIVERED→EXCEPTION→CANCELLED load → refundServiceFee called", async () => {
    setAuthSession(adminSession);
    await db.load.create({
      data: {
        id: "load-wiring-04",
        shipperId: seed.shipperOrg.id,
        status: "EXCEPTION",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: "Admin cancel test",
        weight: 1000,
        shipperFeeStatus: "DEDUCTED",
        carrierFeeStatus: "DEDUCTED",
      },
    });

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/loads/load-wiring-04/status",
      { body: { status: "CANCELLED", reason: "Admin override" } }
    );
    const res = await callHandler(updateLoadStatus, req, {
      id: "load-wiring-04",
    });
    expect(res.status).toBe(200);

    const { refundServiceFee } = require("@/lib/serviceFeeManagement");
    expect(refundServiceFee).toHaveBeenCalledWith("load-wiring-04");
  });

  it("SHIPPER cancelling a POSTED load (pre-fee) → no refund triggered", async () => {
    setAuthSession({
      userId: "shipper-ref-user",
      email: "shipper@refund.test",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: seed.shipperOrg.id,
    });
    await db.load.create({
      data: {
        id: "load-wiring-05",
        shipperId: seed.shipperOrg.id,
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: "Shipper cancel posted",
        weight: 1000,
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
      },
    });

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/loads/load-wiring-05/status",
      { body: { status: "CANCELLED" } }
    );
    await callHandler(updateLoadStatus, req, { id: "load-wiring-05" });

    const { refundServiceFee } = require("@/lib/serviceFeeManagement");
    expect(refundServiceFee).not.toHaveBeenCalled();
  });

  it("Cross-org shipper cannot cancel another org's load → 404 (resource cloaking)", async () => {
    setAuthSession({
      userId: "other-shipper-user",
      email: "other@refund.test",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "other-shipper-org",
    });
    await db.organization.upsert({
      where: { id: "other-shipper-org" },
      create: {
        id: "other-shipper-org",
        name: "Other Shipper",
        type: "SHIPPER",
      },
      update: {},
    });
    await db.load.create({
      data: {
        id: "load-wiring-06",
        shipperId: seed.shipperOrg.id, // different org
        status: "POSTED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: "Cross org load",
        weight: 1000,
        shipperFeeStatus: "PENDING",
      },
    });

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/loads/load-wiring-06/status",
      { body: { status: "CANCELLED" } }
    );
    const res = await callHandler(updateLoadStatus, req, {
      id: "load-wiring-06",
    });
    // Route cloaks cross-org resources
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("refundServiceFee failure is non-blocking — route still returns 200", async () => {
    setAuthSession(adminSession);
    // Mock refundServiceFee to throw
    const sfm = require("@/lib/serviceFeeManagement");
    sfm.refundServiceFee.mockRejectedValueOnce(new Error("Refund DB error"));

    await db.load.create({
      data: {
        id: "load-wiring-07",
        shipperId: seed.shipperOrg.id,
        status: "EXCEPTION",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: "Non-blocking refund test",
        weight: 1000,
        shipperFeeStatus: "DEDUCTED",
        carrierFeeStatus: "PENDING",
      },
    });

    const req = createRequest(
      "PATCH",
      "http://localhost:3000/api/loads/load-wiring-07/status",
      { body: { status: "CANCELLED", reason: "Test non-blocking" } }
    );
    const res = await callHandler(updateLoadStatus, req, {
      id: "load-wiring-07",
    });

    // Route should still succeed even if refund throws
    expect(res.status).toBe(200);

    // Load is in CANCELLED state
    const load = await db.load.findUnique({
      where: { id: "load-wiring-07" },
      select: { status: true },
    });
    expect(load?.status).toBe("CANCELLED");
  });
});
// Note: refundServiceFee unit tests (US-7.5 atomicity) are in
// __tests__/api/financial/financial-atomicity.test.ts where
// @/lib/serviceFeeManagement is not mocked at the module level.

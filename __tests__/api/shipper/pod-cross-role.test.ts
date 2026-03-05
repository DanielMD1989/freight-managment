// @jest-environment node
/**
 * POD Cross-Role Access Tests
 *
 * Validates BUG-A, BUG-B, BUG-C fixes:
 * - GAP-A: DISPATCHER cannot upload POD even when org matches carrier → 403
 * - GAP-B: DISPATCHER cannot verify POD even when org matches shipper → 403
 * - GAP-C: Fee deduction failure blocks POD verification → 400, podVerified stays false
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
  mockLoadUtils,
  mockStorage,
  SeedData,
} from "../../utils/routeTestUtils";

// Standard mocks
mockAuth();
mockCsrf();
mockRateLimit();
mockSecurity();
mockCache();
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
mockLoadUtils();
mockStorage();

// POD-specific notifications mock
jest.mock("@/lib/notifications", () => ({
  createNotification: jest.fn(async () => ({ id: "notif-1" })),
  NotificationType: {
    LOAD_REQUEST: "LOAD_REQUEST",
    TRUCK_REQUEST: "TRUCK_REQUEST",
    TRIP_STATUS: "TRIP_STATUS",
    SYSTEM: "SYSTEM",
    POD_SUBMITTED: "POD_SUBMITTED",
    POD_VERIFIED: "POD_VERIFIED",
    SETTLEMENT_COMPLETE: "SETTLEMENT_COMPLETE",
  },
}));

// Dedicated deductServiceFee mock (overridable per test)
const mockDeductServiceFee = jest.fn(async () => ({
  success: true,
  shipperFee: 150.0,
  carrierFee: 75.0,
  totalPlatformFee: 225.0,
  transactionId: "txn-cross-role-1",
}));

jest.mock("@/lib/serviceFeeManagement", () => ({
  deductServiceFee: (...args: unknown[]) => mockDeductServiceFee(...args),
  validateWalletBalancesForTrip: jest.fn(async () => ({
    valid: true,
    shipperFee: "100.00",
    carrierFee: "50.00",
  })),
}));

// Route handlers — imported AFTER all mocks
const {
  POST: uploadPod,
  PUT: verifyPod,
} = require("@/app/api/loads/[id]/pod/route");

// ─── Sessions ─────────────────────────────────────────────────────────────────

// DISPATCHER whose org matches the carrier org
const dispatcherCarrierOrgSession = createMockSession({
  userId: "dispatcher-carrier-org-user",
  role: "DISPATCHER",
  organizationId: "carrier-org-1",
  status: "ACTIVE",
});

// DISPATCHER whose org matches the shipper org
const dispatcherShipperOrgSession = createMockSession({
  userId: "dispatcher-shipper-org-user",
  role: "DISPATCHER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

const shipperSession = createMockSession({
  userId: "shipper-user-1",
  role: "SHIPPER",
  organizationId: "shipper-org-1",
  status: "ACTIVE",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function createFormDataRequest(
  url: string,
  file?: { name: string; type: string; size: number } | null
) {
  const req = createRequest("POST", url, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  const mockFormData = {
    get: jest.fn((key: string) => {
      if (key === "file" && file) {
        const buf = new ArrayBuffer(64);
        const view = new Uint8Array(buf);
        if (file.type === "image/jpeg" || file.type === "image/jpg") {
          view[0] = 0xff;
          view[1] = 0xd8;
        } else if (file.type === "image/png") {
          view[0] = 0x89;
          view[1] = 0x50;
          view[2] = 0x4e;
          view[3] = 0x47;
        } else if (file.type === "application/pdf") {
          view[0] = 0x25; // %
          view[1] = 0x50; // P
          view[2] = 0x44; // D
          view[3] = 0x46; // F
        }
        return {
          name: file.name,
          type: file.type,
          size: file.size,
          arrayBuffer: async () => buf,
        };
      }
      return null;
    }),
  };

  (req as any).formData = jest.fn(async () => mockFormData);
  return req;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("POD Cross-Role Access (BUG-A / BUG-B / BUG-C)", () => {
  let seed: SeedData;
  let deliveredLoadId: string;
  let podSubmittedLoadId: string;

  beforeAll(async () => {
    seed = await seedTestData();
    deliveredLoadId = `pod-cross-delivered-${Date.now()}`;
    podSubmittedLoadId = `pod-cross-submitted-${Date.now()}`;

    // Create DELIVERED load with assigned truck (for POST tests)
    await db.load.create({
      data: {
        id: deliveredLoadId,
        status: "DELIVERED",
        podSubmitted: false,
        podVerified: false,
        assignedTruckId: seed.truck.id,
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 10 * 86400000),
        deliveryCity: "Hawassa",
        deliveryDate: new Date(Date.now() - 2 * 86400000),
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Cross-role POD upload test cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    // Create DELIVERED load with POD submitted (for PUT tests)
    await db.load.create({
      data: {
        id: podSubmittedLoadId,
        status: "DELIVERED",
        podSubmitted: true,
        podVerified: false,
        podUrl: "https://storage.test/pod-cross.jpg",
        podSubmittedAt: new Date(Date.now() - 86400000),
        assignedTruckId: seed.truck.id,
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 10 * 86400000),
        deliveryCity: "Dire Dawa",
        deliveryDate: new Date(Date.now() - 2 * 86400000),
        truckType: "DRY_VAN",
        weight: 3500,
        cargoDescription: "Cross-role POD verify test cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    // Create dispatcher user whose org matches the carrier org
    await db.user.create({
      data: {
        id: "dispatcher-carrier-org-user",
        email: "dispatcher-carrier@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Dispatcher",
        lastName: "CarrierOrg",
        phone: "+251911000099",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "carrier-org-1",
      },
    });

    // Create dispatcher user whose org matches the shipper org
    await db.user.create({
      data: {
        id: "dispatcher-shipper-org-user",
        email: "dispatcher-shipper@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Dispatcher",
        lastName: "ShipperOrg",
        phone: "+251911000098",
        role: "DISPATCHER",
        status: "ACTIVE",
        organizationId: "shipper-org-1",
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockDeductServiceFee.mockResolvedValue({
      success: true,
      shipperFee: 150.0,
      carrierFee: 75.0,
      totalPlatformFee: 225.0,
      transactionId: "txn-cross-role-1",
    });
  });

  // ─── GAP-A: DISPATCHER upload POD → 403 ──────────────────────────────────

  it("GAP-A: DISPATCHER with carrier org cannot upload POD → 403 (BUG-A fix)", async () => {
    // DISPATCHER whose organizationId === load.assignedTruck.carrierId
    // Before fix: isCarrier = (orgId === carrierId) = true → 200
    // After fix: isCarrier = (role === CARRIER && orgId === carrierId) = false → 403
    setAuthSession(dispatcherCarrierOrgSession);

    const req = createFormDataRequest(
      `http://localhost:3000/api/loads/${deliveredLoadId}/pod`,
      { name: "pod.jpg", type: "image/jpeg", size: 2048 }
    );

    const res = await callHandler(uploadPod, req, { id: deliveredLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/carrier/i);
  });

  // ─── GAP-B: DISPATCHER verify POD → 403 ──────────────────────────────────

  it("GAP-B: DISPATCHER with shipper org cannot verify POD → 403 (BUG-B fix)", async () => {
    // DISPATCHER whose organizationId === load.shipperId
    // Before fix: isShipper = (orgId === shipperId) = true → 200
    // After fix: isShipper = (role === SHIPPER && orgId === shipperId) = false → 403
    setAuthSession(dispatcherShipperOrgSession);

    const req = createRequest(
      "PUT",
      `http://localhost:3000/api/loads/${podSubmittedLoadId}/pod`,
      { body: { verified: true } }
    );

    const res = await callHandler(verifyPod, req, { id: podSubmittedLoadId });
    const body = await parseResponse(res);

    expect(res.status).toBe(403);
    expect(body.error).toMatch(/shipper/i);
  });

  // ─── GAP-C: Fee failure blocks POD verification ───────────────────────────

  it("GAP-C: fee deduction failure → 400, podVerified stays false (BUG-C fix)", async () => {
    // Create a fresh load for this test to avoid state interference
    const feeFailLoadId = `pod-fee-fail-${Date.now()}`;
    await db.load.create({
      data: {
        id: feeFailLoadId,
        status: "DELIVERED",
        podSubmitted: true,
        podVerified: false,
        podUrl: "https://storage.test/pod-fee-fail.jpg",
        podSubmittedAt: new Date(Date.now() - 86400000),
        assignedTruckId: seed.truck.id,
        pickupCity: "Addis Ababa",
        pickupDate: new Date(Date.now() - 10 * 86400000),
        deliveryCity: "Hawassa",
        deliveryDate: new Date(Date.now() - 2 * 86400000),
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Fee fail test cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        postedAt: new Date(),
      },
    });

    // Mock fee deduction to fail
    mockDeductServiceFee.mockResolvedValueOnce({
      success: false,
      error: "Wallet balance insufficient",
      serviceFee: 0,
      shipperFee: 0,
      carrierFee: 0,
      totalPlatformFee: 0,
    });

    setAuthSession(shipperSession);

    const req = createRequest(
      "PUT",
      `http://localhost:3000/api/loads/${feeFailLoadId}/pod`,
      { body: { verified: true } }
    );

    const res = await callHandler(verifyPod, req, { id: feeFailLoadId });
    const body = await parseResponse(res);

    // BUG-C fix: fee failure blocks verification
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/fee deduction failed/i);

    // Critical: podVerified must still be false — no partial commit
    const loadInDb = await db.load.findUnique({
      where: { id: feeFailLoadId },
      select: { podVerified: true },
    });
    expect(loadInDb?.podVerified).toBe(false);
  });
});

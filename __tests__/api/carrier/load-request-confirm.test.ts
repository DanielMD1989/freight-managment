/**
 * Load Request Confirm API Tests — Round M19
 *
 * Tests for POST /api/load-requests/[id]/confirm
 *
 * G-M19-1: DECLINE path wrapped in transaction (atomicity)
 * G-M19-3: Carrier wallet gate on CONFIRM (402)
 * G-M19-4: DISPATCHER → 404
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
  mockLoadUtils,
  mockStorage,
  mockServiceFee,
} from "../../utils/routeTestUtils";

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
mockRbac();
mockApiErrors();
mockLogger();
mockLoadUtils();
mockStorage();
mockServiceFee();

jest.mock("@/lib/validation", () => ({
  ...jest.requireActual("@/lib/validation"),
  sanitizeText: jest.fn((text: string) => text),
  zodErrorResponse: jest.fn((err) => {
    const { NextResponse } = require("next/server");
    return NextResponse.json(
      { error: "Validation error", details: err.errors },
      { status: 400 }
    );
  }),
}));

// Import handler AFTER mocks
const { POST } = require("@/app/api/load-requests/[id]/confirm/route");

// ─── Sessions ────────────────────────────────────────────────────────────────

const carrierSession = createMockSession({
  userId: "m19-carrier-user",
  role: "CARRIER",
  organizationId: "m19-carrier-org",
  status: "ACTIVE",
});

const adminSession = createMockSession({
  userId: "m19-admin-user",
  role: "ADMIN",
  organizationId: undefined,
  status: "ACTIVE",
});

const dispatcherSession = createMockSession({
  userId: "m19-dispatcher-user",
  role: "DISPATCHER",
  organizationId: "m19-dispatcher-org",
  status: "ACTIVE",
});

// ─── Seed data ───────────────────────────────────────────────────────────────

async function seedM19Data() {
  await db.organization.create({
    data: {
      id: "m19-shipper-org",
      name: "M19 Shipper",
      type: "SHIPPER",
      contactEmail: "m19shipper@test.com",
      contactPhone: "+25190000101",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await db.organization.create({
    data: {
      id: "m19-carrier-org",
      name: "M19 Carrier",
      type: "CARRIER_COMPANY",
      contactEmail: "m19carrier@test.com",
      contactPhone: "+25190000102",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await db.organization.create({
    data: {
      id: "m19-carrier2-org",
      name: "M19 Carrier2",
      type: "CARRIER_COMPANY",
      contactEmail: "m19carrier2@test.com",
      contactPhone: "+25190000103",
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });

  await db.user.create({
    data: {
      id: "m19-shipper-user",
      email: "m19shipper@test.com",
      passwordHash: "hash",
      firstName: "M19",
      lastName: "Shipper",
      role: "SHIPPER",
      status: "ACTIVE",
      organizationId: "m19-shipper-org",
    },
  });
  await db.user.create({
    data: {
      id: "m19-carrier-user",
      email: "m19carrier@test.com",
      passwordHash: "hash",
      firstName: "M19",
      lastName: "Carrier",
      role: "CARRIER",
      status: "ACTIVE",
      organizationId: "m19-carrier-org",
    },
  });

  await db.truck.create({
    data: {
      id: "m19-truck-1",
      carrierId: "m19-carrier-org",
      licensePlate: "M19-TRUCK-1",
      truckType: "FLATBED",
      capacity: 20000,
      isAvailable: true,
      approvalStatus: "APPROVED",
    },
  });
}

async function createM19Load(id: string, status = "SEARCHING") {
  return db.load.create({
    data: {
      id,
      shipperId: "m19-shipper-org",
      status,
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupDate: new Date(),
      deliveryDate: new Date(Date.now() + 86400000),
      truckType: "FLATBED",
      weight: 10000,
      cargoDescription: "M19 test cargo",
      fullPartial: "FULL",
      currency: "ETB",
      bookMode: "REQUEST",
    },
  });
}

async function createM19LoadRequest(
  id: string,
  loadId: string,
  overrides: Record<string, unknown> = {}
) {
  return db.loadRequest.create({
    data: {
      id,
      loadId,
      truckId: "m19-truck-1",
      carrierId: "m19-carrier-org",
      shipperId: "m19-shipper-org",
      requestedById: "m19-carrier-user",
      expiresAt: new Date(Date.now() + 86400000),
      status: "SHIPPER_APPROVED",
      ...overrides,
    },
  });
}

function callConfirm(requestId: string, body: Record<string, unknown>) {
  const req = createRequest(
    "POST",
    `http://localhost:3000/api/load-requests/${requestId}/confirm`,
    { body }
  );
  return callHandler(POST, req, { id: requestId });
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("Load Request Confirm — M19 Gaps", () => {
  beforeAll(async () => {
    await seedM19Data();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(carrierSession);
  });

  // ─── G-M19-4: DISPATCHER → 404 ─────────────────────────────────────────────

  describe("G-M19-4: DISPATCHER exclusion", () => {
    it("DISPATCHER → 404", async () => {
      const load = await createM19Load("m19-4-load");
      const lr = await createM19LoadRequest("m19-4-lr", load.id);

      setAuthSession(dispatcherSession);
      const res = await callConfirm(lr.id, { action: "CONFIRM" });
      expect(res.status).toBe(404);
    });
  });

  // ─── G-M19-3: Carrier wallet gate ──────────────────────────────────────────

  describe("G-M19-3: Carrier wallet gate on CONFIRM", () => {
    it("CONFIRM when carrier below minimum balance → 402", async () => {
      const load = await createM19Load("m19-3a-load");
      const lr = await createM19LoadRequest("m19-3a-lr", load.id);

      // Set carrier wallet below minimum
      await db.financialAccount.create({
        data: {
          id: "m19-carrier-wallet",
          organizationId: "m19-carrier-org",
          isActive: true,
          balance: 100,
          minimumBalance: 5000,
        },
      });

      const res = await callConfirm(lr.id, { action: "CONFIRM" });
      expect(res.status).toBe(402);
      const data = await parseResponse(res);
      expect(data.error).toContain("wallet balance");

      // Cleanup
      await db.financialAccount.delete({ where: { id: "m19-carrier-wallet" } });
    });

    it("DECLINE succeeds even when carrier below minimum balance", async () => {
      const load = await createM19Load("m19-3b-load");
      const lr = await createM19LoadRequest("m19-3b-lr", load.id);

      await db.financialAccount.create({
        data: {
          id: "m19-carrier-wallet-3b",
          organizationId: "m19-carrier-org",
          isActive: true,
          balance: 100,
          minimumBalance: 5000,
        },
      });

      const res = await callConfirm(lr.id, { action: "DECLINE" });
      expect(res.status).toBe(200);
      const data = await parseResponse(res);
      expect(data.message).toContain("declined");

      // Verify request was cancelled
      const updated = await db.loadRequest.findUnique({ where: { id: lr.id } });
      expect(updated?.status).toBe("CANCELLED");

      // Cleanup
      await db.financialAccount.delete({
        where: { id: "m19-carrier-wallet-3b" },
      });
    });

    it("Admin bypasses wallet gate on CONFIRM", async () => {
      const load = await createM19Load("m19-3c-load");
      const lr = await createM19LoadRequest("m19-3c-lr", load.id);

      await db.financialAccount.create({
        data: {
          id: "m19-carrier-wallet-3c",
          organizationId: "m19-carrier-org",
          isActive: true,
          balance: 100,
          minimumBalance: 5000,
        },
      });

      setAuthSession(adminSession);
      const res = await callConfirm(lr.id, { action: "CONFIRM" });
      // Admin skips wallet check — should succeed (200) not 402
      expect(res.status).toBe(200);

      // Cleanup
      await db.financialAccount.delete({
        where: { id: "m19-carrier-wallet-3c" },
      });
    });
  });

  // ─── G-M19-1: DECLINE transaction atomicity ────────────────────────────────

  describe("G-M19-1: DECLINE path atomicity", () => {
    it("DECLINE reverts load to POSTED when zero remaining requests", async () => {
      const load = await createM19Load("m19-1a-load", "SEARCHING");
      const lr = await createM19LoadRequest("m19-1a-lr", load.id);

      const res = await callConfirm(lr.id, { action: "DECLINE" });
      expect(res.status).toBe(200);

      // Load should revert to POSTED
      const updatedLoad = await db.load.findUnique({
        where: { id: load.id },
      });
      expect(updatedLoad?.status).toBe("POSTED");

      // LoadEvent should be created
      const events = await db.loadEvent.findMany({
        where: { loadId: load.id, eventType: "LOAD_REQUEST_CANCELLED" },
      });
      expect(events.length).toBeGreaterThanOrEqual(1);
    });

    it("DECLINE with other PENDING requests does NOT revert load", async () => {
      const load = await createM19Load("m19-1b-load", "SEARCHING");
      // Two requests: one will be declined, the other stays PENDING
      const lr1 = await createM19LoadRequest("m19-1b-lr1", load.id);
      await createM19LoadRequest("m19-1b-lr2", load.id, {
        status: "PENDING",
        carrierId: "m19-carrier2-org",
        truckId: "m19-truck-1",
      });

      const res = await callConfirm(lr1.id, { action: "DECLINE" });
      expect(res.status).toBe(200);

      // Load should stay SEARCHING (other pending request exists)
      const updatedLoad = await db.load.findUnique({
        where: { id: load.id },
      });
      expect(updatedLoad?.status).toBe("SEARCHING");
    });
  });
});

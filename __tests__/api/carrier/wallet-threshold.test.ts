/**
 * Wallet Threshold Check Tests (Round A4)
 *
 * G-A4-1: GET /api/truck-postings — Shipper blocked if balance < minimumBalance
 * G-A4-2: GET /api/truck-postings/[id]/matching-loads — Carrier blocked
 * G-A4-3: GET /api/trucks/[id]/nearby-loads — Carrier blocked
 *
 * All three search routes must return 402 when the authenticated user's
 * org wallet balance is below the configured minimum threshold.
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
  mockApiErrors,
  mockLogger,
  SeedData,
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
mockApiErrors();
mockLogger();

const { GET: getTruckPostings } = require("@/app/api/truck-postings/route");
const {
  GET: getMatchingLoads,
} = require("@/app/api/truck-postings/[id]/matching-loads/route");
const {
  GET: getNearbyLoads,
} = require("@/app/api/trucks/[id]/nearby-loads/route");

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Org + wallet seeded with balance below minimum threshold */
async function seedLowBalanceOrg(id: string, role: "SHIPPER" | "CARRIER") {
  const org = await db.organization.create({
    data: {
      id,
      name: `Low Balance ${role}`,
      type: role === "SHIPPER" ? "SHIPPER" : "CARRIER_COMPANY",
      contactEmail: `${id}@test.com`,
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await db.financialAccount.create({
    data: {
      id: `wallet-${id}`,
      organizationId: id,
      accountType: role === "SHIPPER" ? "SHIPPER_WALLET" : "CARRIER_WALLET",
      balance: 0, // below threshold
      minimumBalance: 500,
      currency: "ETB",
    },
  });
  return org;
}

/** Org + wallet seeded with balance above minimum threshold */
async function seedHealthyBalanceOrg(id: string, role: "SHIPPER" | "CARRIER") {
  const org = await db.organization.create({
    data: {
      id,
      name: `Healthy Balance ${role}`,
      type: role === "SHIPPER" ? "SHIPPER" : "CARRIER_COMPANY",
      contactEmail: `${id}@test.com`,
      isVerified: true,
      verificationStatus: "APPROVED",
    },
  });
  await db.financialAccount.create({
    data: {
      id: `wallet-${id}`,
      organizationId: id,
      accountType: role === "SHIPPER" ? "SHIPPER_WALLET" : "CARRIER_WALLET",
      balance: 1000, // above threshold
      minimumBalance: 500,
      currency: "ETB",
    },
  });
  return org;
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Wallet Threshold — Marketplace Search Guard (Round A4)", () => {
  let seed: SeedData;

  beforeAll(async () => {
    seed = await seedTestData();
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── G-A4-1: GET /api/truck-postings ───────────────────────────────────────

  describe("G-A4-1: GET /api/truck-postings", () => {
    it("T-WT-1: Shipper with balance < minimum → 402", async () => {
      const lowOrg = await seedLowBalanceOrg("shipper-low-wt1", "SHIPPER");
      setAuthSession(
        createMockSession({ role: "SHIPPER", organizationId: lowOrg.id })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings"
      );
      const res = await callHandler(getTruckPostings, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(402);
      expect(body.error).toMatch(/wallet/i);
    });

    it("T-WT-2: Shipper with balance >= minimum → not 402", async () => {
      const healthyOrg = await seedHealthyBalanceOrg(
        "shipper-ok-wt2",
        "SHIPPER"
      );
      setAuthSession(
        createMockSession({ role: "SHIPPER", organizationId: healthyOrg.id })
      );

      const req = createRequest(
        "GET",
        "http://localhost:3000/api/truck-postings"
      );
      const res = await callHandler(getTruckPostings, req);

      expect(res.status).not.toBe(402);
    });
  });

  // ── G-A4-2: GET /api/truck-postings/[id]/matching-loads ──────────────────

  describe("G-A4-2: GET /api/truck-postings/[id]/matching-loads", () => {
    it("T-WT-3: Carrier with balance < minimum → 402", async () => {
      const lowOrg = await seedLowBalanceOrg("carrier-low-wt3", "CARRIER");
      setAuthSession(
        createMockSession({ role: "CARRIER", organizationId: lowOrg.id })
      );

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );
      const res = await callHandler(getMatchingLoads, req, {
        id: seed.truckPosting.id,
      });
      const body = await parseResponse(res);

      expect(res.status).toBe(402);
      expect(body.error).toMatch(/wallet/i);
    });

    it("T-WT-4: Carrier with balance >= minimum → not 402", async () => {
      const healthyOrg = await seedHealthyBalanceOrg(
        "carrier-ok-wt4",
        "CARRIER"
      );
      setAuthSession(
        createMockSession({ role: "CARRIER", organizationId: healthyOrg.id })
      );

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/truck-postings/${seed.truckPosting.id}/matching-loads`
      );
      const res = await callHandler(getMatchingLoads, req, {
        id: seed.truckPosting.id,
      });

      expect(res.status).not.toBe(402);
    });
  });

  // ── G-A4-3: GET /api/trucks/[id]/nearby-loads ────────────────────────────

  describe("G-A4-3: GET /api/trucks/[id]/nearby-loads", () => {
    it("T-WT-5: Carrier with balance < minimum → 402", async () => {
      const lowOrg = await seedLowBalanceOrg("carrier-low-wt5", "CARRIER");

      // Truck owned by this org
      const lowTruck = await db.truck.create({
        data: {
          id: "truck-low-wt5",
          truckType: "DRY_VAN",
          licensePlate: "WT-005",
          capacity: 10000,
          carrierId: lowOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      setAuthSession(
        createMockSession({ role: "CARRIER", organizationId: lowOrg.id })
      );

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${lowTruck.id}/nearby-loads`
      );
      const res = await callHandler(getNearbyLoads, req, { id: lowTruck.id });
      const body = await parseResponse(res);

      expect(res.status).toBe(402);
      expect(body.error).toMatch(/wallet/i);
    });

    it("T-WT-6: Carrier with balance >= minimum → not 402", async () => {
      const healthyOrg = await seedHealthyBalanceOrg(
        "carrier-ok-wt6",
        "CARRIER"
      );

      const healthyTruck = await db.truck.create({
        data: {
          id: "truck-ok-wt6",
          truckType: "DRY_VAN",
          licensePlate: "WT-006",
          capacity: 10000,
          carrierId: healthyOrg.id,
          createdById: seed.carrierUser.id,
          approvalStatus: "APPROVED",
        },
      });

      setAuthSession(
        createMockSession({ role: "CARRIER", organizationId: healthyOrg.id })
      );

      const req = createRequest(
        "GET",
        `http://localhost:3000/api/trucks/${healthyTruck.id}/nearby-loads`
      );
      const res = await callHandler(getNearbyLoads, req, {
        id: healthyTruck.id,
      });

      expect(res.status).not.toBe(402);
    });
  });
});

/**
 * Wallet Gate Extension Tests (Gap 1 — Phase 1A)
 *
 * Verifies that the minimumBalance 402 gate covers all booking-path entry points,
 * not just GET /api/truck-postings (which was the original Sprint 5 implementation).
 *
 * G-WGX-1: GET /api/loads         — CARRIER with balance < minimum → 402
 * G-WGX-2: POST /api/load-requests — CARRIER with balance < minimum → 402
 * G-WGX-3: POST /api/truck-requests — SHIPPER with balance < minimum → 402
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
} from "../utils/routeTestUtils";

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

const { GET: getLoads } = require("@/app/api/loads/route");
const { POST: postLoadRequest } = require("@/app/api/load-requests/route");
const { POST: postTruckRequest } = require("@/app/api/truck-requests/route");

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function seedLowBalanceOrg(id: string, role: "SHIPPER" | "CARRIER") {
  const org = await db.organization.create({
    data: {
      id,
      name: `Low Balance ${role} WGX`,
      type: role === "SHIPPER" ? "SHIPPER" : "CARRIER_COMPANY",
      contactEmail: `${id}@wgx-test.com`,
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

async function seedHealthyBalanceOrg(id: string, role: "SHIPPER" | "CARRIER") {
  const org = await db.organization.create({
    data: {
      id,
      name: `Healthy Balance ${role} WGX`,
      type: role === "SHIPPER" ? "SHIPPER" : "CARRIER_COMPANY",
      contactEmail: `${id}@wgx-test.com`,
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

describe("Wallet Gate Extension — All Booking Paths (Gap 1)", () => {
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

  // ── G-WGX-1: GET /api/loads (carrier marketplace) ─────────────────────────

  describe("G-WGX-1: GET /api/loads — carrier marketplace gate", () => {
    it("T-WGX-1: Carrier with balance < minimum → 402", async () => {
      const lowOrg = await seedLowBalanceOrg("carrier-low-wgx1", "CARRIER");
      setAuthSession(
        createMockSession({ role: "CARRIER", organizationId: lowOrg.id })
      );

      const req = createRequest("GET", "http://localhost:3000/api/loads");
      const res = await callHandler(getLoads, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(402);
      expect(body.error).toMatch(/wallet/i);
    });

    it("T-WGX-2: Carrier with balance >= minimum → not 402", async () => {
      const healthyOrg = await seedHealthyBalanceOrg(
        "carrier-ok-wgx2",
        "CARRIER"
      );
      setAuthSession(
        createMockSession({ role: "CARRIER", organizationId: healthyOrg.id })
      );

      const req = createRequest("GET", "http://localhost:3000/api/loads");
      const res = await callHandler(getLoads, req);

      expect(res.status).not.toBe(402);
    });
  });

  // ── G-WGX-2: POST /api/load-requests ──────────────────────────────────────

  describe("G-WGX-2: POST /api/load-requests — carrier booking gate", () => {
    it("T-WGX-3: Carrier with balance < minimum → 402", async () => {
      const lowOrg = await seedLowBalanceOrg("carrier-low-wgx3", "CARRIER");
      setAuthSession(
        createMockSession({ role: "CARRIER", organizationId: lowOrg.id })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        { loadId: seed.load.id, truckId: seed.truck.id }
      );
      const res = await callHandler(postLoadRequest, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(402);
      expect(body.error).toMatch(/wallet/i);
    });

    it("T-WGX-4: Carrier with balance >= minimum passes the gate", async () => {
      const healthyOrg = await seedHealthyBalanceOrg(
        "carrier-ok-wgx4",
        "CARRIER"
      );
      setAuthSession(
        createMockSession({ role: "CARRIER", organizationId: healthyOrg.id })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/load-requests",
        { loadId: seed.load.id, truckId: seed.truck.id }
      );
      const res = await callHandler(postLoadRequest, req);

      // Gate not triggered — response may be 400/404/etc based on data, but not 402
      expect(res.status).not.toBe(402);
    });
  });

  // ── G-WGX-3: POST /api/truck-requests ─────────────────────────────────────

  describe("G-WGX-3: POST /api/truck-requests — shipper booking gate", () => {
    it("T-WGX-5: Shipper with balance < minimum → 402", async () => {
      const lowOrg = await seedLowBalanceOrg("shipper-low-wgx5", "SHIPPER");
      setAuthSession(
        createMockSession({ role: "SHIPPER", organizationId: lowOrg.id })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-requests",
        { loadId: seed.load.id, truckId: seed.truck.id }
      );
      const res = await callHandler(postTruckRequest, req);
      const body = await parseResponse(res);

      expect(res.status).toBe(402);
      expect(body.error).toMatch(/wallet/i);
    });

    it("T-WGX-6: Shipper with balance >= minimum passes the gate", async () => {
      const healthyOrg = await seedHealthyBalanceOrg(
        "shipper-ok-wgx6",
        "SHIPPER"
      );
      setAuthSession(
        createMockSession({ role: "SHIPPER", organizationId: healthyOrg.id })
      );

      const req = createRequest(
        "POST",
        "http://localhost:3000/api/truck-requests",
        { loadId: seed.load.id, truckId: seed.truck.id }
      );
      const res = await callHandler(postTruckRequest, req);

      // Gate not triggered — response may be 400/403/etc based on data, but not 402
      expect(res.status).not.toBe(402);
    });
  });
});

/**
 * Admin Service Fee Metrics API Tests
 *
 * Tests for GET /api/admin/service-fees/metrics
 * Uses inline role check → ADMIN + SUPER_ADMIN only
 */

import {
  setAuthSession,
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
  mockStorage,
  mockLogger,
} from "../../utils/routeTestUtils";
import {
  useAdminSession,
  useSuperAdminSession,
  useShipperSession,
  useCarrierSession,
  useDispatcherSession,
  seedAdminTestData,
} from "./helpers";
import { db } from "@/lib/db";

// ─── Setup Mocks ──────────────────────────────────────────────────────────────
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
mockStorage();
mockLogger();

// Import route handler AFTER mocks
const {
  GET: getServiceFeeMetrics,
} = require("@/app/api/admin/service-fees/metrics/route");

describe("Admin Service Fee Metrics API", () => {
  beforeAll(async () => {
    await seedAdminTestData();
    // Seed a load with dual-party fees deducted within the current month (SFM-6, SFM-7)
    await db.load.create({
      data: {
        id: "sfm-fee-load-1",
        status: "COMPLETED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "DRY_VAN",
        weight: 5000,
        cargoDescription: "Fee metrics test cargo",
        shipperId: "shipper-org-1",
        createdById: "shipper-user-1",
        shipperServiceFee: 100,
        carrierServiceFee: 50,
        shipperFeeStatus: "DEDUCTED",
        carrierFeeStatus: "DEDUCTED",
        shipperFeeDeductedAt: new Date(),
        carrierFeeDeductedAt: new Date(),
        pickupDate: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
        deliveryDate: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
      },
    });
  });

  afterAll(() => {
    clearAllStores();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    setAuthSession(null);
  });

  // SFM-1: ADMIN GET → 200
  it("SFM-1: ADMIN GET → 200 with metrics", async () => {
    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);
    expect(body).toBeDefined();
  });

  // SFM-2: SUPER_ADMIN GET → 200
  it("SFM-2: SUPER_ADMIN GET → 200", async () => {
    useSuperAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    expect(res.status).toBe(200);
  });

  // SFM-3: SHIPPER GET → 403
  it("SFM-3: SHIPPER GET → 403", async () => {
    useShipperSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    expect(res.status).toBe(403);
  });

  // SFM-4: CARRIER GET → 403
  it("SFM-4: CARRIER GET → 403", async () => {
    useCarrierSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    expect(res.status).toBe(403);
  });

  // SFM-5: DISPATCHER GET → 403
  it("SFM-5: DISPATCHER GET → 403", async () => {
    useDispatcherSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics"
    );
    const res = await getServiceFeeMetrics(req);
    expect(res.status).toBe(403);
  });

  // SFM-6: response summary has per-party fee fields (not legacy single field)
  it("SFM-6: ?period=month response has shipperFeeCollected and carrierFeeCollected", async () => {
    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics?period=month"
    );
    const res = await getServiceFeeMetrics(req);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.shipperFeeCollected).toBe("number");
    expect(typeof body.summary.carrierFeeCollected).toBe("number");
    expect(typeof body.summary.totalFeesCollected).toBe("number");
    // The seeded load contributes 100 (shipper) + 50 (carrier) = 150 total
    expect(body.summary.shipperFeeCollected).toBeGreaterThanOrEqual(100);
    expect(body.summary.carrierFeeCollected).toBeGreaterThanOrEqual(50);
    expect(body.summary.totalFeesCollected).toBeGreaterThanOrEqual(150);
  });

  // SFM-7: no byStatus key; recentTransactions items have totalFee not serviceFee
  it("SFM-7: response has no byStatus; recentTransactions use totalFee/shipperFeeStatus/carrierFeeStatus", async () => {
    useAdminSession();
    const req = createRequest(
      "GET",
      "http://localhost:3000/api/admin/service-fees/metrics?period=month"
    );
    const res = await getServiceFeeMetrics(req);
    const body = await parseResponse(res);
    expect(res.status).toBe(200);
    // No legacy byStatus array
    expect(body.byStatus).toBeUndefined();
    // recentTransactions should be present
    expect(Array.isArray(body.recentTransactions)).toBe(true);
    if (body.recentTransactions.length > 0) {
      const tx = body.recentTransactions[0];
      // New shape fields
      expect(tx).toHaveProperty("totalFee");
      expect(tx).toHaveProperty("shipperFee");
      expect(tx).toHaveProperty("carrierFee");
      expect(tx).toHaveProperty("shipperFeeStatus");
      expect(tx).toHaveProperty("carrierFeeStatus");
      // Legacy field must NOT be present
      expect(tx.serviceFee).toBeUndefined();
      expect(tx.status).toBeUndefined();
    }
  });
});

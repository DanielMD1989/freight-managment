/**
 * Analytics Arithmetic Tests (Phase 2B)
 *
 * Tests getRevenueMetrics() in lib/admin/metrics.ts DIRECTLY — not via route handler.
 * The route-level tests (analytics.test.ts) mock getRevenueMetrics entirely.
 * These tests verify the function's own logic: WHERE clause construction,
 * period filter, sum pass-through, per-party independence, null→0 conversion.
 *
 * Why not seed real data and call aggregate normally?
 * jest.setup.js db.load.aggregate always returns 0 (ignores where + data).
 * We override per-test using mockResolvedValueOnce — tests what getRevenueMetrics()
 * DOES WITH the DB result, not what the DB does.
 *
 * AA-1: Shipper + carrier fees passed through and summed as serviceFeeCollected
 * AA-2: Period filter WHERE clause built with per-party deduction timestamps
 * AA-3: No dateRange → WHERE clause has no date filter on timestamps
 * AA-4: Per-party independence: carrier null → 0, doesn't affect shipper
 * AA-5: Status filter present regardless of period
 */

import {
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
  mockLogger,
} from "../../utils/routeTestUtils";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

// Standard env mocks (auth, csrf, etc.) — do NOT mock lib/admin/metrics
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
mockLogger();

// Import the REAL function (no jest.mock for @/lib/admin/metrics)
import { getRevenueMetrics } from "@/lib/admin/metrics";

describe("getRevenueMetrics — arithmetic unit tests", () => {
  beforeAll(() => {
    // db.journalLine is not in jest.setup.js — inject it for these tests
    (db as any).journalLine = {
      aggregate: jest.fn(),
    };
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Stub non-focus queries with neutral defaults
    (db.financialAccount.findFirst as jest.Mock).mockResolvedValue({
      balance: new Prisma.Decimal(50000),
    });
    (db.withdrawalRequest.count as jest.Mock).mockResolvedValue(2);
    ((db as any).journalLine.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(0) },
    });
  });

  // AA-1: Shipper + carrier fees passed through and summed as serviceFeeCollected
  it("AA-1: shipper + carrier fees summed into serviceFeeCollected", async () => {
    (db.load.aggregate as jest.Mock)
      .mockResolvedValueOnce({
        _sum: { shipperServiceFee: new Prisma.Decimal(5150) },
      })
      .mockResolvedValueOnce({
        _sum: { carrierServiceFee: new Prisma.Decimal(3090) },
      });

    const result = await getRevenueMetrics();

    expect(result.shipperFeeCollected).toBe(5150);
    expect(result.carrierFeeCollected).toBe(3090);
    expect(result.serviceFeeCollected).toBe(8240);
  });

  // AA-2: Period filter WHERE clause built with per-party deduction timestamps
  it("AA-2: dateRange → per-party WHERE clause contains gte/lte on deduction timestamps", async () => {
    (db.load.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { shipperServiceFee: null } })
      .mockResolvedValueOnce({ _sum: { carrierServiceFee: null } });

    const start = new Date("2025-01-01");
    const end = new Date("2025-01-31");
    await getRevenueMetrics({ start, end });

    const calls = (db.load.aggregate as jest.Mock).mock.calls;
    // First call — shipper date filter
    expect(calls[0][0].where.shipperFeeDeductedAt.gte).toBe(start);
    expect(calls[0][0].where.shipperFeeDeductedAt.lte).toBe(end);
    // Second call — carrier date filter
    expect(calls[1][0].where.carrierFeeDeductedAt.gte).toBe(start);
    expect(calls[1][0].where.carrierFeeDeductedAt.lte).toBe(end);
  });

  // AA-3: No dateRange → WHERE clause has no date filter on timestamps
  it("AA-3: no dateRange → WHERE clause omits deduction timestamp filter", async () => {
    (db.load.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { shipperServiceFee: null } })
      .mockResolvedValueOnce({ _sum: { carrierServiceFee: null } });

    await getRevenueMetrics();

    const calls = (db.load.aggregate as jest.Mock).mock.calls;
    expect(calls[0][0].where.shipperFeeDeductedAt).toBeUndefined();
    expect(calls[1][0].where.carrierFeeDeductedAt).toBeUndefined();
  });

  // AA-4: Per-party independence: carrier null → 0, doesn't affect shipper
  it("AA-4: carrier null sum → 0; shipper unaffected", async () => {
    (db.load.aggregate as jest.Mock)
      .mockResolvedValueOnce({
        _sum: { shipperServiceFee: new Prisma.Decimal(2575) },
      })
      .mockResolvedValueOnce({ _sum: { carrierServiceFee: null } });

    const result = await getRevenueMetrics();

    expect(result.shipperFeeCollected).toBe(2575);
    expect(result.carrierFeeCollected).toBe(0);
    expect(result.serviceFeeCollected).toBe(2575);
  });

  // AA-5: Status filter always present regardless of period
  it("AA-5: shipperFeeStatus=DEDUCTED and carrierFeeStatus=DEDUCTED always in WHERE", async () => {
    (db.load.aggregate as jest.Mock)
      .mockResolvedValueOnce({ _sum: { shipperServiceFee: null } })
      .mockResolvedValueOnce({ _sum: { carrierServiceFee: null } });

    await getRevenueMetrics({
      start: new Date("2025-01-01"),
      end: new Date("2025-12-31"),
    });

    const calls = (db.load.aggregate as jest.Mock).mock.calls;
    expect(calls[0][0].where.shipperFeeStatus).toBe("DEDUCTED");
    expect(calls[1][0].where.carrierFeeStatus).toBe("DEDUCTED");
  });
});

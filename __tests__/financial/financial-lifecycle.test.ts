/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * End-to-End Financial Lifecycle Tests
 *
 * Tests that wallet balances ACTUALLY MUTATE in the in-memory stores
 * when deductServiceFee / refundServiceFee / validateWalletBalancesForTrip
 * are called. Does NOT mock @/lib/db or @/lib/serviceFeeCalculation —
 * uses the real jest.setup.js in-memory Prisma stores and real Decimal.js math.
 */

// Mock cache (no Redis in tests)
jest.mock("@/lib/cache", () => ({
  cache: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
}));

import {
  deductServiceFee,
  refundServiceFee,
  validateWalletBalancesForTrip,
} from "@/lib/serviceFeeManagement";
import { db } from "@/lib/db";
import {
  seedFinancialTestData,
  getBalance,
  getLoadFeeStatus,
  getJournalEntries,
  clearStores,
} from "./helpers";

// ─── Setup ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  clearStores();
  jest.clearAllMocks();
});

// ─── 1. deductServiceFee — Balance Verification ─────────────────────────────

describe("deductServiceFee — Balance Verification", () => {
  it("deducts correct fees from both wallets and credits platform", async () => {
    const seed = await seedFinancialTestData();

    const result = await deductServiceFee(seed.load.id);

    expect(result.success).toBe(true);
    // Shipper: 515 × 5 = 2575
    expect(getBalance(seed.shipperWallet.id)).toBe(10000 - 2575);
    // Carrier: 515 × 3 = 1545
    expect(getBalance(seed.carrierWallet.id)).toBe(5000 - 1545);
    // Platform: 2575 + 1545 = 4120
    expect(getBalance(seed.platformAccount.id)).toBe(4120);
  });

  it("returns correct fee amounts in result", async () => {
    const seed = await seedFinancialTestData();

    const result = await deductServiceFee(seed.load.id);

    expect(result.shipperFee).toBe(2575);
    expect(result.carrierFee).toBe(1545);
    expect(result.totalPlatformFee).toBe(4120);
  });

  it("creates a journal entry with SERVICE_FEE_DEDUCT type", async () => {
    const seed = await seedFinancialTestData();

    await deductServiceFee(seed.load.id);

    const entries = getJournalEntries(seed.load.id);
    expect(entries.length).toBeGreaterThanOrEqual(1);
    const deductEntry = entries.find(
      (e: any) => e.transactionType === "SERVICE_FEE_DEDUCT"
    );
    expect(deductEntry).toBeDefined();
    expect(deductEntry.reference).toBe(seed.load.id);
  });

  it("updates load fee status to DEDUCTED", async () => {
    const seed = await seedFinancialTestData();

    await deductServiceFee(seed.load.id);

    const status = getLoadFeeStatus(seed.load.id);
    expect(status.shipperFeeStatus).toBe("DEDUCTED");
    expect(status.carrierFeeStatus).toBe("DEDUCTED");
  });

  it("sets load fee deducted timestamps", async () => {
    const seed = await seedFinancialTestData();

    await deductServiceFee(seed.load.id);

    const status = getLoadFeeStatus(seed.load.id);
    expect(status.shipperFeeDeductedAt).toBeDefined();
    expect(status.carrierFeeDeductedAt).toBeDefined();
  });

  it("is idempotent — second call returns already deducted error", async () => {
    const seed = await seedFinancialTestData();

    await deductServiceFee(seed.load.id);
    const secondResult = await deductServiceFee(seed.load.id);

    expect(secondResult.success).toBe(false);
    expect(secondResult.error).toMatch(/already deducted/i);
    // Balances unchanged from first deduction
    expect(getBalance(seed.shipperWallet.id)).toBe(10000 - 2575);
  });

  it("uses actualTripKm when available instead of estimatedTripKm", async () => {
    const seed = await seedFinancialTestData({
      loadOverrides: { actualTripKm: 600 },
    });

    const result = await deductServiceFee(seed.load.id);

    // 600 × 5 = 3000 shipper, 600 × 3 = 1800 carrier
    expect(result.shipperFee).toBe(3000);
    expect(result.carrierFee).toBe(1800);
    expect(getBalance(seed.shipperWallet.id)).toBe(10000 - 3000);
    expect(getBalance(seed.carrierWallet.id)).toBe(5000 - 1800);
  });

  it("waives fees when no corridor and no matching route", async () => {
    const seed = await seedFinancialTestData({
      loadOverrides: {
        corridorId: null,
        pickupCity: "UnknownCity1",
        deliveryCity: "UnknownCity2",
      },
    });

    const result = await deductServiceFee(seed.load.id);

    expect(result.success).toBe(true);
    expect(result.shipperFee).toBe(0);
    expect(result.carrierFee).toBe(0);
    const status = getLoadFeeStatus(seed.load.id);
    expect(status.shipperFeeStatus).toBe("WAIVED");
    expect(status.carrierFeeStatus).toBe("WAIVED");
    // Balances unchanged
    expect(getBalance(seed.shipperWallet.id)).toBe(10000);
  });

  it("finds corridor via route match when corridorId is null", async () => {
    const seed = await seedFinancialTestData({
      loadOverrides: {
        corridorId: null,
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
      },
    });

    const result = await deductServiceFee(seed.load.id);

    expect(result.success).toBe(true);
    expect(result.shipperFee).toBe(2575);
    expect(result.carrierFee).toBe(1545);
  });

  it("does not deduct shipper when balance insufficient", async () => {
    const seed = await seedFinancialTestData({ shipperBalance: 100 });

    const result = await deductServiceFee(seed.load.id);

    expect(result.success).toBe(true);
    expect(result.details!.shipper.walletDeducted).toBe(false);
    expect(result.details!.carrier.walletDeducted).toBe(true);
    // Shipper balance unchanged
    expect(getBalance(seed.shipperWallet.id)).toBe(100);
    // Carrier still deducted
    expect(getBalance(seed.carrierWallet.id)).toBe(5000 - 1545);
    // Platform only gets carrier fee
    expect(getBalance(seed.platformAccount.id)).toBe(1545);
  });

  it("does not deduct carrier when balance insufficient", async () => {
    const seed = await seedFinancialTestData({ carrierBalance: 100 });

    const result = await deductServiceFee(seed.load.id);

    expect(result.success).toBe(true);
    expect(result.details!.shipper.walletDeducted).toBe(true);
    expect(result.details!.carrier.walletDeducted).toBe(false);
    // Carrier balance unchanged
    expect(getBalance(seed.carrierWallet.id)).toBe(100);
    // Shipper still deducted
    expect(getBalance(seed.shipperWallet.id)).toBe(10000 - 2575);
    // Platform only gets shipper fee
    expect(getBalance(seed.platformAccount.id)).toBe(2575);
  });

  it("does not deduct either when both balances insufficient", async () => {
    const seed = await seedFinancialTestData({
      shipperBalance: 100,
      carrierBalance: 100,
    });

    const result = await deductServiceFee(seed.load.id);

    expect(result.success).toBe(true);
    expect(result.details!.shipper.walletDeducted).toBe(false);
    expect(result.details!.carrier.walletDeducted).toBe(false);
    // Both unchanged
    expect(getBalance(seed.shipperWallet.id)).toBe(100);
    expect(getBalance(seed.carrierWallet.id)).toBe(100);
    expect(getBalance(seed.platformAccount.id)).toBe(0);
  });

  it("auto-creates platform account if not found", async () => {
    const seed = await seedFinancialTestData({ skipPlatformAccount: true });

    const result = await deductServiceFee(seed.load.id);

    expect(result.success).toBe(true);
    expect(result.totalPlatformFee).toBe(4120);
    // A platform account was auto-created and credited
    expect(result.platformRevenue.toNumber()).toBe(4120);
  });

  it("applies shipper promo discount correctly", async () => {
    const seed = await seedFinancialTestData({
      corridorOverrides: {
        shipperPromoFlag: true,
        shipperPromoPct: 10,
      },
    });

    const result = await deductServiceFee(seed.load.id);

    // Shipper: 515×5 = 2575, 10% off = 257.5, final = 2317.5
    expect(result.shipperFee).toBe(2317.5);
    expect(result.details!.shipper.discount).toBe(257.5);
    expect(getBalance(seed.shipperWallet.id)).toBe(10000 - 2317.5);
  });

  it("syncs legacy serviceFeeEtb field with totalPlatformFee", async () => {
    const seed = await seedFinancialTestData();

    await deductServiceFee(seed.load.id);

    const status = getLoadFeeStatus(seed.load.id);
    expect(status.serviceFeeEtb).toBe(4120);
    expect(status.serviceFeeStatus).toBe("DEDUCTED");
  });
});

// ─── 2. refundServiceFee — Balance Verification ─────────────────────────────

describe("refundServiceFee — Balance Verification", () => {
  it("refunds shipper and decreases platform balance", async () => {
    const seed = await seedFinancialTestData();
    await deductServiceFee(seed.load.id);

    const shipperBalanceAfterDeduct = getBalance(seed.shipperWallet.id);
    const platformBalanceAfterDeduct = getBalance(seed.platformAccount.id);

    const result = await refundServiceFee(seed.load.id);

    expect(result.success).toBe(true);
    // Shipper gets back shipperFee (2575)
    expect(getBalance(seed.shipperWallet.id)).toBe(
      shipperBalanceAfterDeduct + 2575
    );
    // Platform loses 2575
    expect(getBalance(seed.platformAccount.id)).toBe(
      platformBalanceAfterDeduct - 2575
    );
  });

  it("creates journal entry with SERVICE_FEE_REFUND type", async () => {
    const seed = await seedFinancialTestData();
    await deductServiceFee(seed.load.id);

    await refundServiceFee(seed.load.id);

    const entries = getJournalEntries(seed.load.id);
    const refundEntry = entries.find(
      (e: any) => e.transactionType === "SERVICE_FEE_REFUND"
    );
    expect(refundEntry).toBeDefined();
  });

  it("updates load status to REFUNDED", async () => {
    const seed = await seedFinancialTestData();
    await deductServiceFee(seed.load.id);

    await refundServiceFee(seed.load.id);

    const status = getLoadFeeStatus(seed.load.id);
    expect(status.shipperFeeStatus).toBe("REFUNDED");
  });

  it("marks REFUNDED with no journal for zero fee", async () => {
    const seed = await seedFinancialTestData({
      loadOverrides: {
        corridorId: null,
        pickupCity: "UnknownA",
        deliveryCity: "UnknownB",
      },
    });
    // Waive fees first
    await deductServiceFee(seed.load.id);

    const entriesBefore = getJournalEntries(seed.load.id);
    const refundEntriesBefore = entriesBefore.filter(
      (e: any) => e.transactionType === "SERVICE_FEE_REFUND"
    );

    await refundServiceFee(seed.load.id);

    const entriesAfter = getJournalEntries(seed.load.id);
    const refundEntriesAfter = entriesAfter.filter(
      (e: any) => e.transactionType === "SERVICE_FEE_REFUND"
    );
    // No new refund journal entry for zero fee
    expect(refundEntriesAfter.length).toBe(refundEntriesBefore.length);
    const status = getLoadFeeStatus(seed.load.id);
    expect(status.shipperFeeStatus).toBe("REFUNDED");
  });

  it("returns error when platform account is missing", async () => {
    const seed = await seedFinancialTestData();
    await deductServiceFee(seed.load.id);
    // Delete platform account
    const stores = (db as any).__stores;
    stores.financialAccounts.delete(seed.platformAccount.id);
    // Also delete any auto-created platform accounts
    for (const [id, acct] of stores.financialAccounts.entries()) {
      if ((acct as any).accountType === "PLATFORM_REVENUE") {
        stores.financialAccounts.delete(id);
      }
    }

    const result = await refundServiceFee(seed.load.id);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/accounts not found/i);
  });

  it("returns error when shipper wallet is missing", async () => {
    const seed = await seedFinancialTestData();
    await deductServiceFee(seed.load.id);
    // Delete shipper wallet
    (db as any).__stores.financialAccounts.delete(seed.shipperWallet.id);

    const result = await refundServiceFee(seed.load.id);

    expect(result.success).toBe(false);
  });

  it("falls back to legacy serviceFeeEtb when shipperServiceFee is null", async () => {
    const seed = await seedFinancialTestData();
    await deductServiceFee(seed.load.id);
    // Manually set shipperServiceFee to null, keep serviceFeeEtb
    const stores = (db as any).__stores;
    const loadRecord = stores.loads.get(seed.load.id);
    loadRecord.shipperServiceFee = null;
    loadRecord.shipperFeeStatus = "DEDUCTED"; // Keep status so refund sees it
    loadRecord.serviceFeeEtb = 300;
    stores.loads.set(seed.load.id, loadRecord);

    const result = await refundServiceFee(seed.load.id);

    expect(result.success).toBe(true);
    expect(result.serviceFee.toNumber()).toBe(300);
  });
});

// ─── 3. validateWalletBalancesForTrip — Pre-trip Checks ─────────────────────

describe("validateWalletBalancesForTrip — Pre-trip Checks", () => {
  it("returns valid:true when both wallets have sufficient balance", async () => {
    const seed = await seedFinancialTestData();

    const result = await validateWalletBalancesForTrip(
      seed.load.id,
      seed.carrierOrg.id
    );

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
    expect(result.shipperFee).toBe(2575);
    expect(result.carrierFee).toBe(1545);
  });

  it("returns error when shipper balance is insufficient", async () => {
    const seed = await seedFinancialTestData({ shipperBalance: 100 });

    const result = await validateWalletBalancesForTrip(
      seed.load.id,
      seed.carrierOrg.id
    );

    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e: string) => /shipper/i.test(e) && /insufficient/i.test(e)
      )
    ).toBe(true);
  });

  it("returns error when carrier balance is insufficient", async () => {
    const seed = await seedFinancialTestData({ carrierBalance: 100 });

    const result = await validateWalletBalancesForTrip(
      seed.load.id,
      seed.carrierOrg.id
    );

    expect(result.valid).toBe(false);
    expect(
      result.errors.some(
        (e: string) => /carrier/i.test(e) && /insufficient/i.test(e)
      )
    ).toBe(true);
  });

  it("returns valid:true with fees 0 when no corridor", async () => {
    const seed = await seedFinancialTestData({
      loadOverrides: {
        corridorId: null,
        pickupCity: "NowhereA",
        deliveryCity: "NowhereB",
      },
    });

    const result = await validateWalletBalancesForTrip(
      seed.load.id,
      seed.carrierOrg.id
    );

    expect(result.valid).toBe(true);
    expect(result.shipperFee).toBe(0);
    expect(result.carrierFee).toBe(0);
  });

  it("does NOT mutate wallet balances (validation only)", async () => {
    const seed = await seedFinancialTestData();

    await validateWalletBalancesForTrip(seed.load.id, seed.carrierOrg.id);

    expect(getBalance(seed.shipperWallet.id)).toBe(10000);
    expect(getBalance(seed.carrierWallet.id)).toBe(5000);
  });
});

// ─── 4. Full Lifecycle Integration ──────────────────────────────────────────

describe("Full Lifecycle Integration", () => {
  it("validate → deduct: balances correct after full flow", async () => {
    const seed = await seedFinancialTestData();

    // Validate (no mutation)
    const validation = await validateWalletBalancesForTrip(
      seed.load.id,
      seed.carrierOrg.id
    );
    expect(validation.valid).toBe(true);
    expect(getBalance(seed.shipperWallet.id)).toBe(10000);

    // Deduct (mutation)
    const result = await deductServiceFee(seed.load.id);
    expect(result.success).toBe(true);
    expect(getBalance(seed.shipperWallet.id)).toBe(10000 - 2575);
    expect(getBalance(seed.carrierWallet.id)).toBe(5000 - 1545);
    expect(getBalance(seed.platformAccount.id)).toBe(4120);
  });

  it("deduct → refund: shipper balance restored, platform net = carrier fee only", async () => {
    const seed = await seedFinancialTestData();

    await deductServiceFee(seed.load.id);
    expect(getBalance(seed.shipperWallet.id)).toBe(10000 - 2575);

    await refundServiceFee(seed.load.id);

    // Shipper restored
    expect(getBalance(seed.shipperWallet.id)).toBe(10000);
    // Platform net = carrier fee only (4120 - 2575 = 1545)
    expect(getBalance(seed.platformAccount.id)).toBe(1545);
  });

  it("multi-load sequential deductions accumulate correctly", async () => {
    const seed = await seedFinancialTestData();

    // First load
    await deductServiceFee(seed.load.id);

    // Create second load on same corridor
    const load2 = await db.load.create({
      data: {
        id: "fin-load-2",
        status: "DELIVERED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        truckType: "DRY_VAN",
        weight: 3000,
        cargoDescription: "Second financial test load",
        shipperId: seed.shipperOrg.id,
        createdById: seed.shipperUser.id,
        corridorId: seed.corridor.id,
        assignedTruckId: seed.truck.id,
        estimatedTripKm: 515,
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
        serviceFeeStatus: "PENDING",
      },
    });

    await deductServiceFee(load2.id);

    // Shipper: 10000 - 2575 - 2575 = 4850
    expect(getBalance(seed.shipperWallet.id)).toBe(10000 - 2575 * 2);
    // Carrier: 5000 - 1545 - 1545 = 1910
    expect(getBalance(seed.carrierWallet.id)).toBe(5000 - 1545 * 2);
    // Platform: 4120 * 2 = 8240
    expect(getBalance(seed.platformAccount.id)).toBe(4120 * 2);
  });

  it("uses actualTripKm over estimatedTripKm for fee calculation", async () => {
    const seed = await seedFinancialTestData({
      loadOverrides: { actualTripKm: 600, estimatedTripKm: 515 },
    });

    const result = await deductServiceFee(seed.load.id);

    // Fees based on 600km, not 515km
    expect(result.shipperFee).toBe(3000); // 600 × 5
    expect(result.carrierFee).toBe(1800); // 600 × 3
  });

  it("falls back through distance chain: actualTripKm→estimatedTripKm→tripKm→corridor.distanceKm", async () => {
    // No actualTripKm, no estimatedTripKm, no tripKm → corridor.distanceKm
    const seed = await seedFinancialTestData({
      loadOverrides: {
        actualTripKm: null,
        estimatedTripKm: null,
        tripKm: null,
      },
    });

    const result = await deductServiceFee(seed.load.id);

    // Falls back to corridor.distanceKm = 515
    expect(result.shipperFee).toBe(2575);
    expect(result.carrierFee).toBe(1545);
  });

  it("charges only shipper fee when carrierPricePerKm is 0", async () => {
    const seed = await seedFinancialTestData({
      corridorOverrides: { carrierPricePerKm: 0 },
    });

    const result = await deductServiceFee(seed.load.id);

    expect(result.shipperFee).toBe(2575);
    expect(result.carrierFee).toBe(0);
    expect(result.totalPlatformFee).toBe(2575);
    // Carrier wallet unchanged
    expect(getBalance(seed.carrierWallet.id)).toBe(5000);
  });

  it("isolates wallets across different shippers", async () => {
    const seed = await seedFinancialTestData();

    // Create a second shipper org + wallet + load
    const shipper2 = await db.organization.create({
      data: {
        id: "fin-shipper-org-2",
        name: "Second Shipper",
        type: "SHIPPER",
        contactEmail: "shipper2@test.com",
        contactPhone: "+251911200001",
        isVerified: true,
        verificationStatus: "APPROVED",
      },
    });
    const shipper2Wallet = await db.financialAccount.create({
      data: {
        id: "fin-wallet-shipper-2",
        organizationId: shipper2.id,
        accountType: "SHIPPER_WALLET",
        balance: 8000,
        currency: "ETB",
        isActive: true,
      },
    });
    const shipper2User = await db.user.create({
      data: {
        id: "fin-shipper-user-2",
        email: "shipper2@test.com",
        passwordHash: "hashed_Test1234!",
        firstName: "Shipper",
        lastName: "Two",
        phone: "+251911200001",
        role: "SHIPPER",
        status: "ACTIVE",
        organizationId: shipper2.id,
      },
    });
    const load2 = await db.load.create({
      data: {
        id: "fin-load-iso-2",
        status: "DELIVERED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Dire Dawa",
        truckType: "DRY_VAN",
        weight: 4000,
        cargoDescription: "Cross-org test load",
        shipperId: shipper2.id,
        createdById: shipper2User.id,
        corridorId: seed.corridor.id,
        assignedTruckId: seed.truck.id,
        estimatedTripKm: 515,
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
        serviceFeeStatus: "PENDING",
      },
    });

    // Deduct load 1 (shipper 1)
    await deductServiceFee(seed.load.id);
    // Deduct load 2 (shipper 2)
    await deductServiceFee(load2.id);

    // Each shipper only affected by their own load
    expect(getBalance(seed.shipperWallet.id)).toBe(10000 - 2575);
    expect(getBalance(shipper2Wallet.id)).toBe(8000 - 2575);
  });

  it("maintains Decimal.js precision for fractional fees", async () => {
    const seed = await seedFinancialTestData({
      corridorOverrides: {
        shipperPricePerKm: 3.33,
        carrierPricePerKm: 2.17,
      },
    });

    const result = await deductServiceFee(seed.load.id);

    // 515 × 3.33 = 1714.95 (Decimal.js: precise)
    expect(result.shipperFee).toBe(1714.95);
    // 515 × 2.17 = 1117.55
    expect(result.carrierFee).toBe(1117.55);
    expect(getBalance(seed.shipperWallet.id)).toBeCloseTo(10000 - 1714.95, 2);
    expect(getBalance(seed.carrierWallet.id)).toBeCloseTo(5000 - 1117.55, 2);
  });
});

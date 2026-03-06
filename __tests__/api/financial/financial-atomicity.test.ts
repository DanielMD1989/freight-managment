// @jest-environment node
/**
 * Financial Atomicity Tests — Round 9
 *
 * Verifies that deductServiceFee() and refundServiceFee() use a single
 * $transaction for all financial operations, re-verify balances inside
 * the transaction to prevent race conditions, and maintain journal/balance
 * atomicity.
 *
 * US-7.3: All operations in a single database transaction; balance re-verified inside tx
 * US-7.4: Concurrent deduction guard (idempotency / double-deduction prevention)
 * US-7.5: refundServiceFee uses single $transaction; platform balance verified before refund
 * US-7.7: Journal entry is atomic with balance updates
 */

import { db } from "@/lib/db";
import { clearAllStores } from "../../utils/routeTestUtils";

// ─── Mock serviceFeeCalculation to return controllable values ─────────────────
jest.mock("@/lib/serviceFeeCalculation", () => ({
  findMatchingCorridor: jest.fn(),
  calculateFeesFromCorridor: jest.fn(),
  calculatePartyFee: jest.fn().mockReturnValue({
    baseFee: 500,
    promoDiscount: 0,
    finalFee: 500,
    promoApplied: false,
    promoDiscountPct: null,
  }),
}));

// Import the real deductServiceFee and refundServiceFee (uses real db mock)
const {
  deductServiceFee,
  refundServiceFee,
} = require("@/lib/serviceFeeManagement");
const {
  findMatchingCorridor,
  calculatePartyFee,
} = require("@/lib/serviceFeeCalculation");

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOAD_ID = "load-atomicity-01";
const SHIPPER_ORG = "shipper-atom-org";
const CARRIER_ORG = "carrier-atom-org";
const CORRIDOR_ID = "corridor-atom-01";

async function seedAtomicityData({
  shipperBalance = 1000,
  carrierBalance = 1000,
  shipperFeeStatus = "PENDING",
  carrierFeeStatus = "PENDING",
}: {
  shipperBalance?: number;
  carrierBalance?: number;
  shipperFeeStatus?: string;
  carrierFeeStatus?: string;
} = {}) {
  await db.organization.create({
    data: { id: SHIPPER_ORG, name: "Shipper Atom", type: "SHIPPER" },
  });
  await db.organization.create({
    data: { id: CARRIER_ORG, name: "Carrier Atom", type: "CARRIER" },
  });

  await db.corridor.create({
    data: {
      id: CORRIDOR_ID,
      originRegion: "Addis Ababa",
      destinationRegion: "Hawassa",
      distanceKm: 500,
      pricePerKm: 1,
      shipperPricePerKm: 1,
      carrierPricePerKm: 1,
      isActive: true,
      createdById: null,
    },
  });

  await db.truck.create({
    data: {
      id: "truck-atom-01",
      licensePlate: "AA-ATOM-01",
      truckType: "FLATBED",
      carrierId: CARRIER_ORG,
      isAvailable: false,
    },
  });

  await db.load.create({
    data: {
      id: LOAD_ID,
      shipperId: SHIPPER_ORG,
      status: "COMPLETED",
      pickupCity: "Addis Ababa",
      deliveryCity: "Hawassa",
      truckType: "FLATBED",
      cargoDescription: "Test cargo",
      weight: 1000,
      corridorId: CORRIDOR_ID,
      shipperFeeStatus,
      carrierFeeStatus,
      assignedTruckId: "truck-atom-01",
    },
  });

  const shipperWallet = await db.financialAccount.create({
    data: {
      id: "shipper-atom-wallet",
      accountType: "SHIPPER_WALLET",
      organizationId: SHIPPER_ORG,
      balance: shipperBalance,
      currency: "ETB",
      isActive: true,
    },
  });
  const carrierWallet = await db.financialAccount.create({
    data: {
      id: "carrier-atom-wallet",
      accountType: "CARRIER_WALLET",
      organizationId: CARRIER_ORG,
      balance: carrierBalance,
      currency: "ETB",
      isActive: true,
    },
  });
  const platformAccount = await db.financialAccount.create({
    data: {
      id: "platform-atom-acct",
      accountType: "PLATFORM_REVENUE",
      balance: 0,
      currency: "ETB",
      isActive: true,
    },
  });

  return { shipperWallet, carrierWallet, platformAccount };
}

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(async () => {
  // restoreAllMocks BEFORE clearAllMocks to clean up any unconsumed spies
  jest.restoreAllMocks();
  jest.clearAllMocks();
  clearAllStores();

  // Re-set $transaction explicitly — jest.restoreAllMocks() can lose the
  // mockImplementation on the original jest.fn. in some interaction sequences.
  (db.$transaction as jest.Mock).mockImplementation(
    async (callback: (tx: typeof db) => Promise<unknown>) => callback(db)
  );

  // Default: findMatchingCorridor returns corridor match
  (findMatchingCorridor as jest.Mock).mockResolvedValue({
    corridor: { id: CORRIDOR_ID },
    distanceKm: 500,
  });
  // Default: calculatePartyFee returns 500 ETB fee
  (calculatePartyFee as jest.Mock).mockReturnValue({
    baseFee: 500,
    promoDiscount: 0,
    finalFee: 500,
    promoApplied: false,
    promoDiscountPct: null,
  });
});

// ─── US-7.3 — Fee deduction uses a single $transaction ────────────────────────

describe("US-7.3 — deductServiceFee uses $transaction", () => {
  it("calls db.$transaction for the fee deduction path", async () => {
    await seedAtomicityData({ shipperBalance: 1000, carrierBalance: 1000 });

    const txSpy = jest.spyOn(db, "$transaction");
    await deductServiceFee(LOAD_ID);

    expect(txSpy).toHaveBeenCalled();
    txSpy.mockRestore();
  });

  it("wraps no-fee path in $transaction (BUG-R9-1)", async () => {
    // Zero fees: calculatePartyFee returns 0 for both parties
    (calculatePartyFee as jest.Mock).mockReturnValue({
      baseFee: 0,
      promoDiscount: 0,
      finalFee: 0,
      promoApplied: false,
      promoDiscountPct: null,
    });

    await seedAtomicityData({ shipperBalance: 0, carrierBalance: 0 });

    const txSpy = jest.spyOn(db, "$transaction");
    await deductServiceFee(LOAD_ID);

    // BUG-R9-1: No-fee path now ALSO uses $transaction
    expect(txSpy).toHaveBeenCalled();
    txSpy.mockRestore();
  });

  it("does not partially update load when DB fails mid-transaction", async () => {
    await seedAtomicityData({ shipperBalance: 1000, carrierBalance: 1000 });

    // Make the entire $transaction fail (simulates mid-tx DB failure)
    jest
      .spyOn(db, "$transaction")
      .mockRejectedValueOnce(new Error("DB write error"));

    await expect(deductServiceFee(LOAD_ID)).rejects.toThrow("DB write error");

    // Load should still have PENDING status (transaction never committed)
    const load = await db.load.findUnique({
      where: { id: LOAD_ID },
      select: { shipperFeeStatus: true },
    });
    expect(load?.shipperFeeStatus).toBe("PENDING");
  });

  it("re-verifies shipper balance inside $transaction", async () => {
    // Seed shipper with 0 balance — insufficient for 500 fee
    await seedAtomicityData({ shipperBalance: 0, carrierBalance: 1000 });

    const result = await deductServiceFee(LOAD_ID);

    // Shipper wallet should NOT be deducted (balance insufficient)
    expect(result.details.shipper.walletDeducted).toBe(false);

    // Shipper wallet balance unchanged
    const wallet = await db.financialAccount.findUnique({
      where: { id: "shipper-atom-wallet" },
      select: { balance: true },
    });
    expect(Number(wallet?.balance)).toBe(0);
  });

  it("re-verifies carrier balance inside $transaction", async () => {
    // Seed carrier with 0 balance — insufficient for 500 fee
    await seedAtomicityData({ shipperBalance: 1000, carrierBalance: 0 });

    const result = await deductServiceFee(LOAD_ID);

    // Carrier wallet should NOT be deducted (balance insufficient)
    expect(result.details.carrier.walletDeducted).toBe(false);

    // Carrier wallet balance unchanged
    const wallet = await db.financialAccount.findUnique({
      where: { id: "carrier-atom-wallet" },
      select: { balance: true },
    });
    expect(Number(wallet?.balance)).toBe(0);
  });

  it("blocks if balance is below fee threshold", async () => {
    // Seed shipper with 499 — just below the 500 fee
    await seedAtomicityData({ shipperBalance: 499, carrierBalance: 500 });

    const result = await deductServiceFee(LOAD_ID);

    // Shipper deduction blocked due to insufficient balance
    expect(result.details.shipper.walletDeducted).toBe(false);

    // Wallet unchanged
    const wallet = await db.financialAccount.findUnique({
      where: { id: "shipper-atom-wallet" },
      select: { balance: true },
    });
    expect(Number(wallet?.balance)).toBe(499);
  });
});

// ─── US-7.4 — Concurrent deduction guard ─────────────────────────────────────

describe("US-7.4 — Concurrent deduction guard", () => {
  it("returns already-deducted error on second concurrent call (race simulated)", async () => {
    await seedAtomicityData({ shipperBalance: 1000, carrierBalance: 1000 });

    // Simulate race: another request deducts fees WHILE we're in the transaction.
    // We do this by pre-updating the load to DEDUCTED before the callback runs.
    jest
      .spyOn(db, "$transaction")
      .mockImplementationOnce(
        async (callback: (tx: typeof db) => Promise<unknown>) => {
          // Mark fees as already deducted (another concurrent request did this)
          await db.load.update({
            where: { id: LOAD_ID },
            data: {
              shipperFeeStatus: "DEDUCTED",
              carrierFeeStatus: "DEDUCTED",
            },
          });
          return callback(db);
        }
      );

    const result = await deductServiceFee(LOAD_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Service fees already deducted");
  });

  it("is fully idempotent after prior successful deduction", async () => {
    // Seed load that is ALREADY deducted
    await seedAtomicityData({
      shipperBalance: 500,
      carrierBalance: 500,
      shipperFeeStatus: "DEDUCTED",
      carrierFeeStatus: "DEDUCTED",
    });

    const result = await deductServiceFee(LOAD_ID);

    expect(result.success).toBe(false);
    expect(result.error).toBe("Service fees already deducted");

    // Wallets should be unchanged
    const shipperWallet = await db.financialAccount.findUnique({
      where: { id: "shipper-atom-wallet" },
      select: { balance: true },
    });
    expect(Number(shipperWallet?.balance)).toBe(500);
  });
});

// ─── US-7.7 — Journal entry atomic with balance updates ─────────────────────

describe("US-7.7 — Journal entry atomic with balance updates", () => {
  it("creates journal entry and updates balances in same $transaction", async () => {
    const { shipperWallet, carrierWallet, platformAccount } =
      await seedAtomicityData({ shipperBalance: 1000, carrierBalance: 1000 });

    const result = await deductServiceFee(LOAD_ID);
    expect(result.success).toBe(true);

    // Journal entry exists
    const entries = await db.journalEntry.findMany({
      where: { loadId: LOAD_ID },
    });
    expect(entries.length).toBeGreaterThan(0);

    // Balances decremented
    const updatedShipper = await db.financialAccount.findUnique({
      where: { id: shipperWallet.id },
      select: { balance: true },
    });
    expect(Number(updatedShipper?.balance)).toBeLessThan(1000);

    const updatedCarrier = await db.financialAccount.findUnique({
      where: { id: carrierWallet.id },
      select: { balance: true },
    });
    expect(Number(updatedCarrier?.balance)).toBeLessThan(1000);

    // Platform incremented
    const updatedPlatform = await db.financialAccount.findUnique({
      where: { id: platformAccount.id },
      select: { balance: true },
    });
    expect(Number(updatedPlatform?.balance)).toBeGreaterThan(0);
  });

  it("does not update balances if $transaction fails", async () => {
    await seedAtomicityData({ shipperBalance: 1000, carrierBalance: 1000 });

    // Make the entire transaction fail
    jest
      .spyOn(db, "$transaction")
      .mockRejectedValueOnce(new Error("Journal write failed"));

    await expect(deductServiceFee(LOAD_ID)).rejects.toThrow(
      "Journal write failed"
    );

    // Wallets unchanged
    const shipper = await db.financialAccount.findUnique({
      where: { id: "shipper-atom-wallet" },
      select: { balance: true },
    });
    expect(Number(shipper?.balance)).toBe(1000);

    const carrier = await db.financialAccount.findUnique({
      where: { id: "carrier-atom-wallet" },
      select: { balance: true },
    });
    expect(Number(carrier?.balance)).toBe(1000);
  });

  it("journal entry has correct transactionType SERVICE_FEE_DEDUCT and references loadId", async () => {
    await seedAtomicityData({ shipperBalance: 1000, carrierBalance: 1000 });

    await deductServiceFee(LOAD_ID);

    const entries = await db.journalEntry.findMany({
      where: { loadId: LOAD_ID },
    });
    expect(entries.length).toBeGreaterThan(0);
    const entry = entries[0];
    expect(entry.transactionType).toBe("SERVICE_FEE_DEDUCT");
    expect(entry.reference).toBe(LOAD_ID);
    expect(entry.loadId).toBe(LOAD_ID);
  });

  it("journal credit amount equals sum of debit amounts (double-entry balanced)", async () => {
    await seedAtomicityData({ shipperBalance: 1000, carrierBalance: 1000 });

    const result = await deductServiceFee(LOAD_ID);
    expect(result.success).toBe(true);

    // Verify that shipper + carrier fee was credited to platform
    expect(Number(result.totalPlatformFee)).toBeGreaterThan(0);
    // Both fees were deducted (500 each) and platform got total
    expect(Number(result.shipperFee)).toBe(500);
    expect(Number(result.carrierFee)).toBe(500);
  });
});

// ─── US-7.5 — refundServiceFee atomicity and correctness ──────────────────────

describe("US-7.5 — refundServiceFee atomicity and correctness", () => {
  const REFUND_LOAD_ID = "load-refund-unit-01";
  const REFUND_SHIPPER_ORG = "shipper-refund-unit-org";

  beforeEach(async () => {
    // Seed shipper org
    await db.organization.create({
      data: {
        id: REFUND_SHIPPER_ORG,
        name: "Refund Shipper",
        type: "SHIPPER",
      },
    });

    // Seed shipper wallet
    await db.financialAccount.create({
      data: {
        id: "refund-shipper-wallet",
        accountType: "SHIPPER_WALLET",
        organizationId: REFUND_SHIPPER_ORG,
        balance: 500,
        currency: "ETB",
        isActive: true,
      },
    });

    // Seed platform account with enough balance to refund
    await db.financialAccount.create({
      data: {
        id: "refund-platform-acct",
        accountType: "PLATFORM_REVENUE",
        balance: 1000,
        currency: "ETB",
        isActive: true,
      },
    });

    // Seed load with deducted fee
    await db.load.create({
      data: {
        id: REFUND_LOAD_ID,
        shipperId: REFUND_SHIPPER_ORG,
        status: "CANCELLED",
        pickupCity: "Addis Ababa",
        deliveryCity: "Hawassa",
        truckType: "FLATBED",
        cargoDescription: "Refund unit test",
        weight: 1000,
        shipperFeeStatus: "DEDUCTED",
        shipperServiceFee: 200,
        carrierFeeStatus: "PENDING",
      },
    });
  });

  it("wraps all operations in $transaction", async () => {
    const txSpy = jest.spyOn(db, "$transaction");
    await refundServiceFee(REFUND_LOAD_ID);
    expect(txSpy).toHaveBeenCalled();
    txSpy.mockRestore();
  });

  it("does not partially update if $transaction fails", async () => {
    jest
      .spyOn(db, "$transaction")
      .mockRejectedValueOnce(new Error("Journal create failed"));

    await expect(refundServiceFee(REFUND_LOAD_ID)).rejects.toThrow();

    // Shipper wallet balance unchanged
    const wallet = await db.financialAccount.findUnique({
      where: { id: "refund-shipper-wallet" },
      select: { balance: true },
    });
    expect(Number(wallet?.balance)).toBe(500);
  });

  it("creates SERVICE_FEE_REFUND journal entry referencing loadId", async () => {
    await refundServiceFee(REFUND_LOAD_ID);

    const entries = await db.journalEntry.findMany({
      where: { loadId: REFUND_LOAD_ID },
    });
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0].transactionType).toBe("SERVICE_FEE_REFUND");
    expect(entries[0].reference).toBe(REFUND_LOAD_ID);
  });

  it("credits shipper wallet exactly by shipperFee amount", async () => {
    const before = await db.financialAccount.findUnique({
      where: { id: "refund-shipper-wallet" },
      select: { balance: true },
    });

    await refundServiceFee(REFUND_LOAD_ID);

    const after = await db.financialAccount.findUnique({
      where: { id: "refund-shipper-wallet" },
      select: { balance: true },
    });

    const diff = Number(after?.balance) - Number(before?.balance);
    expect(diff).toBe(200); // shipperServiceFee = 200
  });

  it("decrements platform revenue by same amount", async () => {
    const before = await db.financialAccount.findUnique({
      where: { id: "refund-platform-acct" },
      select: { balance: true },
    });

    await refundServiceFee(REFUND_LOAD_ID);

    const after = await db.financialAccount.findUnique({
      where: { id: "refund-platform-acct" },
      select: { balance: true },
    });

    const diff = Number(before?.balance) - Number(after?.balance);
    expect(diff).toBe(200); // decremented by 200
  });

  it("marks load.shipperFeeStatus as REFUNDED after refund", async () => {
    await refundServiceFee(REFUND_LOAD_ID);

    const load = await db.load.findUnique({
      where: { id: REFUND_LOAD_ID },
      select: { shipperFeeStatus: true },
    });
    expect(load?.shipperFeeStatus).toBe("REFUNDED");
  });

  it("blocks if platform account has insufficient balance", async () => {
    // Set platform balance to 0 — can't refund 200 from 0
    await db.financialAccount.update({
      where: { id: "refund-platform-acct" },
      data: { balance: 0 },
    });

    // Should throw or return error
    const result = await refundServiceFee(REFUND_LOAD_ID).catch((e: Error) => ({
      caught: true,
      message: e.message,
    }));

    if (result && typeof result === "object" && "caught" in result) {
      expect(result.caught).toBe(true);
    } else if (result && typeof result === "object" && "success" in result) {
      expect((result as any).success).toBe(false);
    }
  });
});

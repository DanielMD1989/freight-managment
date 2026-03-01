/**
 * Service Fee Management Tests
 *
 * Tests for service fee deduction, refund, and validation logic
 */

import {
  deductServiceFee,
  refundServiceFee,
  validateWalletBalancesForTrip,
  reserveServiceFee,
  assignCorridorToLoad,
} from "@/lib/serviceFeeManagement";
import { db } from "@/lib/db";
import {
  findMatchingCorridor,
  calculateFeesFromCorridor,
} from "@/lib/serviceFeeCalculation";

// Mock the db module
jest.mock("@/lib/db", () => ({
  db: {
    load: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    corridor: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    financialAccount: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    journalEntry: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock serviceFeeCalculation functions
jest.mock("@/lib/serviceFeeCalculation", () => ({
  calculateServiceFee: jest.fn(),
  findMatchingCorridor: jest.fn(),
  calculateFeesFromCorridor: jest.fn(),
  calculatePartyFee: jest.fn((distance, pricePerKm, promoFlag, promoPct) => {
    if (
      distance <= 0 ||
      pricePerKm <= 0 ||
      !Number.isFinite(distance) ||
      !Number.isFinite(pricePerKm)
    ) {
      return {
        baseFee: 0,
        finalFee: 0,
        promoDiscount: 0,
        promoApplied: false,
        pricePerKm: 0,
      };
    }
    const baseFee = distance * pricePerKm;
    const discount = promoFlag && promoPct ? baseFee * (promoPct / 100) : 0;
    const finalFee = baseFee - discount;
    return {
      baseFee,
      finalFee,
      promoDiscount: discount,
      promoApplied: promoFlag && promoPct > 0,
      pricePerKm,
    };
  }),
}));

const mockDb = db as unknown as {
  load: {
    findUnique: jest.Mock;
    update: jest.Mock;
  };
  corridor: {
    findUnique: jest.Mock;
    findFirst: jest.Mock;
  };
  financialAccount: {
    findFirst: jest.Mock;
    findUnique: jest.Mock;
    create: jest.Mock;
    update: jest.Mock;
  };
  journalEntry: {
    create: jest.Mock;
  };
  $transaction: jest.Mock;
};

describe("lib/serviceFeeManagement", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ============================================================================
  // deductServiceFee - Main fee deduction on trip completion
  // ============================================================================
  describe("deductServiceFee", () => {
    it("should return error when load not found", async () => {
      mockDb.load.findUnique.mockResolvedValue(null);

      const result = await deductServiceFee("non-existent-load");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Load not found");
      expect(result.shipperFee).toBe(0);
      expect(result.carrierFee).toBe(0);
    });

    it("should return error when fees already deducted", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        shipperFeeStatus: "DEDUCTED",
        carrierFeeStatus: "DEDUCTED",
        corridor: { distanceKm: 100 },
      });

      const result = await deductServiceFee("load-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Service fees already deducted");
    });

    it("should waive fees when no corridor found", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: null,
        corridor: null,
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
        pickupLocation: null,
        deliveryLocation: null,
        pickupCity: null,
        deliveryCity: null,
      });

      // Mock transaction
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => fn(mockDb)
      );

      const result = await deductServiceFee("load-1");

      expect(result.success).toBe(true);
      expect(result.error).toContain("waived");
      expect(result.shipperFee).toBe(0);
      expect(result.carrierFee).toBe(0);
    });

    it("should calculate fees based on corridor pricing", async () => {
      const mockCorridor = {
        id: "corridor-1",
        distanceKm: 100,
        shipperPricePerKm: 5,
        carrierPricePerKm: 3,
        shipperPromoFlag: false,
        carrierPromoFlag: false,
        shipperPromoPct: null,
        carrierPromoPct: null,
        pricePerKm: 5,
        promoFlag: false,
        promoDiscountPct: null,
      };

      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        corridor: mockCorridor,
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
        actualTripKm: null,
        estimatedTripKm: 100,
        tripKm: null,
        assignedTruck: {
          carrierId: "carrier-1",
          carrier: { id: "carrier-1", name: "Test Carrier" },
        },
        shipper: { id: "shipper-1", name: "Test Shipper" },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ id: "shipper-wallet", balance: 1000 }) // shipper wallet
        .mockResolvedValueOnce({ id: "carrier-wallet", balance: 1000 }) // carrier wallet
        .mockResolvedValueOnce({ id: "platform-account" }); // platform account

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          // Mock transaction context
          const tx = {
            financialAccount: {
              findUnique: jest.fn().mockResolvedValue({ balance: 1000 }),
              update: jest.fn().mockResolvedValue({ balance: 500 }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-1" }),
            },
            load: {
              findUnique: jest
                .fn()
                .mockResolvedValue({
                  shipperFeeStatus: "PENDING",
                  carrierFeeStatus: "PENDING",
                }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return fn(tx);
        }
      );

      const result = await deductServiceFee("load-1");

      expect(result.success).toBe(true);
      expect(result.shipperFee).toBe(500); // 100 * 5
      expect(result.carrierFee).toBe(300); // 100 * 3
      expect(result.totalPlatformFee).toBe(800);
    });

    it("should use actualTripKm over estimatedTripKm", async () => {
      const mockCorridor = {
        id: "corridor-1",
        distanceKm: 100,
        shipperPricePerKm: 5,
        carrierPricePerKm: 3,
        pricePerKm: 5,
      };

      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        corridor: mockCorridor,
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
        actualTripKm: 120, // GPS distance
        estimatedTripKm: 100, // Should be ignored
        tripKm: 90,
        assignedTruck: {
          carrierId: "carrier-1",
          carrier: { id: "carrier-1", name: "Test Carrier" },
        },
        shipper: { id: "shipper-1", name: "Test Shipper" },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ id: "shipper-wallet", balance: 1000 })
        .mockResolvedValueOnce({ id: "carrier-wallet", balance: 1000 })
        .mockResolvedValueOnce({ id: "platform-account" });

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            financialAccount: {
              findUnique: jest.fn().mockResolvedValue({ balance: 1000 }),
              update: jest.fn().mockResolvedValue({ balance: 400 }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-1" }),
            },
            load: {
              findUnique: jest
                .fn()
                .mockResolvedValue({
                  shipperFeeStatus: "PENDING",
                  carrierFeeStatus: "PENDING",
                }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return fn(tx);
        }
      );

      const result = await deductServiceFee("load-1");

      // Should use actualTripKm (120), not estimatedTripKm (100)
      expect(result.shipperFee).toBe(600); // 120 * 5
      expect(result.carrierFee).toBe(360); // 120 * 3
    });

    it("should handle insufficient shipper balance", async () => {
      const mockCorridor = {
        id: "corridor-1",
        distanceKm: 100,
        shipperPricePerKm: 5,
        carrierPricePerKm: 3,
        pricePerKm: 5,
      };

      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        corridor: mockCorridor,
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
        actualTripKm: null,
        estimatedTripKm: 100,
        assignedTruck: {
          carrierId: "carrier-1",
          carrier: { id: "carrier-1", name: "Test Carrier" },
        },
        shipper: { id: "shipper-1", name: "Test Shipper" },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ id: "shipper-wallet", balance: 100 }) // Insufficient
        .mockResolvedValueOnce({ id: "carrier-wallet", balance: 1000 })
        .mockResolvedValueOnce({ id: "platform-account" });

      // Carrier fee still deducted via transaction (totalDeducted > 0)
      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            financialAccount: {
              findUnique: jest.fn().mockResolvedValue({ balance: 1000 }),
              update: jest.fn().mockResolvedValue({ balance: 700 }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-1" }),
            },
            load: {
              findUnique: jest
                .fn()
                .mockResolvedValue({
                  shipperFeeStatus: "PENDING",
                  carrierFeeStatus: "PENDING",
                }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return fn(tx);
        }
      );
      mockDb.load.update.mockResolvedValue({});

      const result = await deductServiceFee("load-1");

      // Fee is calculated but shipper not deducted
      expect(result.success).toBe(true);
      expect(result.details?.shipper.walletDeducted).toBe(false);
      expect(result.details?.carrier.walletDeducted).toBe(true);
    });
  });

  // ============================================================================
  // refundServiceFee - Refund fees when load is cancelled
  // ============================================================================
  describe("refundServiceFee", () => {
    it("should return error when load not found", async () => {
      mockDb.load.findUnique.mockResolvedValue(null);

      const result = await refundServiceFee("non-existent-load");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Load not found");
    });

    it("should handle zero fee refund", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        shipperServiceFee: 0,
        serviceFeeEtb: 0,
        shipper: { name: "Test Shipper" },
      });

      mockDb.load.update.mockResolvedValue({});

      const result = await refundServiceFee("load-1");

      expect(result.success).toBe(true);
      expect(result.error).toBe("No fee to refund");
      expect(result.serviceFee.toNumber()).toBe(0);
    });

    it("should return error when accounts not found", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        shipperServiceFee: 500,
        serviceFeeEtb: 500,
        shipper: { name: "Test Shipper" },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce(null) // platform account not found
        .mockResolvedValueOnce(null); // shipper wallet not found

      const result = await refundServiceFee("load-1");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Required accounts not found");
    });

    it("should successfully refund fee", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        shipperServiceFee: 500,
        serviceFeeEtb: 500,
        shipper: { name: "Test Shipper" },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ id: "platform-account", balance: 1000 })
        .mockResolvedValueOnce({ id: "shipper-wallet", balance: 200 });

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            financialAccount: {
              findUnique: jest.fn().mockResolvedValue({ balance: 1000 }),
              update: jest.fn().mockResolvedValue({ balance: 700 }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-1" }),
            },
            load: {
              findUnique: jest
                .fn()
                .mockResolvedValue({
                  shipperFeeStatus: "PENDING",
                  carrierFeeStatus: "PENDING",
                }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return fn(tx);
        }
      );

      const result = await refundServiceFee("load-1");

      expect(result.success).toBe(true);
      expect(result.serviceFee.toNumber()).toBe(500);
    });

    it("should use legacy serviceFeeEtb when shipperServiceFee is null", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        shipperServiceFee: null,
        serviceFeeEtb: 300, // Legacy field
        shipper: { name: "Test Shipper" },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ id: "platform-account", balance: 1000 })
        .mockResolvedValueOnce({ id: "shipper-wallet", balance: 200 });

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            financialAccount: {
              findUnique: jest.fn().mockResolvedValue({ balance: 1000 }),
              update: jest.fn().mockResolvedValue({ balance: 500 }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-1" }),
            },
            load: {
              findUnique: jest
                .fn()
                .mockResolvedValue({
                  shipperFeeStatus: "PENDING",
                  carrierFeeStatus: "PENDING",
                }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return fn(tx);
        }
      );

      const result = await refundServiceFee("load-1");

      expect(result.success).toBe(true);
      expect(result.serviceFee.toNumber()).toBe(300);
    });
  });

  // ============================================================================
  // validateWalletBalancesForTrip - Pre-trip validation
  // ============================================================================
  describe("validateWalletBalancesForTrip", () => {
    it("should return error when load not found", async () => {
      mockDb.load.findUnique.mockResolvedValue(null);

      const result = await validateWalletBalancesForTrip("load-1", "carrier-1");

      expect(result.valid).toBe(false);
      expect(result.errors).toContain("Load not found");
    });

    it("should pass validation when no corridor (fees will be waived)", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: null,
        corridor: null,
      });

      const result = await validateWalletBalancesForTrip("load-1", "carrier-1");

      expect(result.valid).toBe(true);
      expect(result.shipperFee).toBe(0);
      expect(result.carrierFee).toBe(0);
      expect(result.errors).toHaveLength(0);
    });

    it("should validate sufficient balances", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        estimatedTripKm: 100,
        corridor: {
          distanceKm: 100,
          shipperPricePerKm: 5,
          carrierPricePerKm: 3,
          pricePerKm: 5,
        },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ balance: 1000 }) // shipper wallet
        .mockResolvedValueOnce({ balance: 1000 }); // carrier wallet

      const result = await validateWalletBalancesForTrip("load-1", "carrier-1");

      expect(result.valid).toBe(true);
      expect(result.shipperFee).toBe(500); // 100 * 5
      expect(result.carrierFee).toBe(300); // 100 * 3
      expect(result.errors).toHaveLength(0);
    });

    it("should detect insufficient shipper balance", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        estimatedTripKm: 100,
        corridor: {
          distanceKm: 100,
          shipperPricePerKm: 5,
          carrierPricePerKm: 3,
          pricePerKm: 5,
        },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ balance: 100 }) // shipper: insufficient
        .mockResolvedValueOnce({ balance: 1000 }); // carrier: sufficient

      const result = await validateWalletBalancesForTrip("load-1", "carrier-1");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain(
        "Shipper has insufficient wallet balance"
      );
    });

    it("should detect insufficient carrier balance", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        estimatedTripKm: 100,
        corridor: {
          distanceKm: 100,
          shipperPricePerKm: 5,
          carrierPricePerKm: 3,
          pricePerKm: 5,
        },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ balance: 1000 }) // shipper: sufficient
        .mockResolvedValueOnce({ balance: 100 }); // carrier: insufficient

      const result = await validateWalletBalancesForTrip("load-1", "carrier-1");

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain(
        "Carrier has insufficient wallet balance"
      );
    });

    it("should handle missing wallets", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        estimatedTripKm: 100,
        corridor: {
          distanceKm: 100,
          shipperPricePerKm: 5,
          carrierPricePerKm: 3,
          pricePerKm: 5,
        },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce(null) // shipper wallet not found
        .mockResolvedValueOnce(null); // carrier wallet not found

      const result = await validateWalletBalancesForTrip("load-1", "carrier-1");

      expect(result.valid).toBe(false);
      expect(result.shipperBalance).toBe(0);
      expect(result.carrierBalance).toBe(0);
    });
  });

  // ============================================================================
  // reserveServiceFee - Deprecated function
  // ============================================================================
  describe("reserveServiceFee (deprecated)", () => {
    it("should return success with warning message", async () => {
      const consoleSpy = jest.spyOn(console, "warn").mockImplementation();

      const result = await reserveServiceFee("load-1");

      expect(result.success).toBe(true);
      expect(result.serviceFee.toNumber()).toBe(0);
      expect(result.error).toContain("Reserve flow removed");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ============================================================================
  // assignCorridorToLoad - Assign corridor and pre-calculate fees
  // ============================================================================
  describe("assignCorridorToLoad", () => {
    const mockFindMatchingCorridor = findMatchingCorridor as jest.Mock;
    const mockCalculateFeesFromCorridor =
      calculateFeesFromCorridor as jest.Mock;

    beforeEach(() => {
      jest.clearAllMocks();
    });

    it("should return error when load not found", async () => {
      mockDb.load.findUnique.mockResolvedValue(null);

      const result = await assignCorridorToLoad("non-existent-load");

      expect(result.success).toBe(false);
      expect(result.error).toBe("Load not found");
    });

    it("should return existing corridor if already assigned", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        corridorId: "existing-corridor",
      });

      const result = await assignCorridorToLoad("load-1");

      expect(result.success).toBe(true);
      expect(result.corridorId).toBe("existing-corridor");
    });

    it("should handle missing region information", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        corridorId: null,
        pickupLocation: null,
        deliveryLocation: null,
        pickupCity: null,
        deliveryCity: null,
      });

      const result = await assignCorridorToLoad("load-1");

      expect(result.success).toBe(true);
      expect(result.error).toBe("No region information available");
    });

    it("should handle no matching corridor", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        corridorId: null,
        pickupLocation: { region: "Addis Ababa" },
        deliveryLocation: { region: "Unknown Region" },
        pickupCity: "Addis Ababa",
        deliveryCity: "Unknown",
      });

      mockFindMatchingCorridor.mockResolvedValue(null);

      const result = await assignCorridorToLoad("load-1");

      expect(result.success).toBe(true);
      expect(result.error).toBe("No matching corridor found");
    });

    it("should successfully assign corridor and calculate fees", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        corridorId: null,
        pickupLocation: { region: "Addis Ababa" },
        deliveryLocation: { region: "Djibouti" },
        pickupCity: "Addis Ababa",
        deliveryCity: "Djibouti",
      });

      const mockCorridorMatch = {
        corridor: {
          id: "corridor-1",
          distanceKm: 910,
          shipperPricePerKm: 3.5,
          carrierPricePerKm: 2.0,
        },
        direction: "ONE_WAY",
      };

      mockFindMatchingCorridor.mockResolvedValue(mockCorridorMatch);
      mockCalculateFeesFromCorridor.mockReturnValue({
        shipper: { finalFee: 3185 },
        carrier: { finalFee: 1820 },
        totalPlatformFee: 5005,
      });

      mockDb.load.update.mockResolvedValue({});

      const result = await assignCorridorToLoad("load-1");

      expect(result.success).toBe(true);
      expect(result.corridorId).toBe("corridor-1");
      expect(result.shipperFee).toBe(3185);
      expect(result.carrierFee).toBe(1820);
      expect(result.totalPlatformFee).toBe(5005);
      expect(mockDb.load.update).toHaveBeenCalled();
    });

    it("should use pickupCity when pickupLocation.region is null", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        corridorId: null,
        pickupLocation: null,
        deliveryLocation: null,
        pickupCity: "Addis Ababa",
        deliveryCity: "Djibouti",
      });

      const mockCorridorMatch = {
        corridor: {
          id: "corridor-1",
          distanceKm: 910,
        },
      };

      mockFindMatchingCorridor.mockResolvedValue(mockCorridorMatch);
      mockCalculateFeesFromCorridor.mockReturnValue({
        shipper: { finalFee: 3000 },
        carrier: { finalFee: 2000 },
        totalPlatformFee: 5000,
      });

      mockDb.load.update.mockResolvedValue({});

      const result = await assignCorridorToLoad("load-1");

      expect(result.success).toBe(true);
      expect(findMatchingCorridor).toHaveBeenCalledWith(
        "Addis Ababa",
        "Djibouti"
      );
    });
  });

  // ============================================================================
  // Integration scenarios
  // ============================================================================
  describe("business scenarios", () => {
    it("should handle full trip lifecycle: validate → deduct", async () => {
      // Step 1: Validate wallet balances before trip
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        estimatedTripKm: 100,
        corridor: {
          distanceKm: 100,
          shipperPricePerKm: 5,
          carrierPricePerKm: 3,
          pricePerKm: 5,
        },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ balance: 1000 })
        .mockResolvedValueOnce({ balance: 1000 });

      const validateResult = await validateWalletBalancesForTrip(
        "load-1",
        "carrier-1"
      );
      expect(validateResult.valid).toBe(true);

      // Step 2: Deduct fees on completion
      jest.clearAllMocks();
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        corridorId: "corridor-1",
        corridor: {
          id: "corridor-1",
          distanceKm: 100,
          shipperPricePerKm: 5,
          carrierPricePerKm: 3,
          pricePerKm: 5,
        },
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
        actualTripKm: null,
        estimatedTripKm: 100,
        assignedTruck: {
          carrierId: "carrier-1",
          carrier: { id: "carrier-1", name: "Test Carrier" },
        },
        shipper: { id: "shipper-1", name: "Test Shipper" },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ id: "shipper-wallet", balance: 1000 })
        .mockResolvedValueOnce({ id: "carrier-wallet", balance: 1000 })
        .mockResolvedValueOnce({ id: "platform-account" });

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            financialAccount: {
              findUnique: jest.fn().mockResolvedValue({ balance: 1000 }),
              update: jest.fn().mockResolvedValue({ balance: 500 }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-1" }),
            },
            load: {
              findUnique: jest
                .fn()
                .mockResolvedValue({
                  shipperFeeStatus: "PENDING",
                  carrierFeeStatus: "PENDING",
                }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return fn(tx);
        }
      );

      const deductResult = await deductServiceFee("load-1");
      expect(deductResult.success).toBe(true);
      expect(deductResult.totalPlatformFee).toBe(800); // 500 + 300
    });

    it("should handle trip cancellation: deduct → refund", async () => {
      // Fee already deducted
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-1",
        shipperId: "shipper-1",
        shipperServiceFee: 500,
        shipperFeeStatus: "DEDUCTED",
        serviceFeeEtb: 500,
        shipper: { name: "Test Shipper" },
      });

      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ id: "platform-account", balance: 500 })
        .mockResolvedValueOnce({ id: "shipper-wallet", balance: 0 });

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            financialAccount: {
              findUnique: jest.fn().mockResolvedValue({ balance: 500 }),
              update: jest.fn().mockResolvedValue({ balance: 500 }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-refund" }),
            },
            load: {
              findUnique: jest
                .fn()
                .mockResolvedValue({
                  shipperFeeStatus: "PENDING",
                  carrierFeeStatus: "PENDING",
                }),
              update: jest.fn().mockResolvedValue({}),
            },
          };
          return fn(tx);
        }
      );

      const refundResult = await refundServiceFee("load-1");

      expect(refundResult.success).toBe(true);
      expect(refundResult.serviceFee.toNumber()).toBe(500);
    });
  });
});

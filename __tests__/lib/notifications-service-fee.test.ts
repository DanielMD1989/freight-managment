/**
 * Service Fee Notification Tests — Round N4
 *
 * Tests that dormant NotificationType entries SERVICE_FEE_DEDUCTED and
 * SERVICE_FEE_REFUNDED are now fired by deductServiceFee() and refundServiceFee().
 *
 * SF-1: refundServiceFee fires SERVICE_FEE_REFUNDED to shipper org
 * SF-2: refundServiceFee fires SERVICE_FEE_REFUNDED to carrier org when carrier fee > 0
 * SF-3: refundServiceFee does NOT fire to carrier when carrierFeeToRefund = 0
 * SF-4: deductServiceFee fires SERVICE_FEE_DEDUCTED to shipper org on full deduction
 * SF-5: deductServiceFee fires SERVICE_FEE_DEDUCTED to carrier org on full deduction
 * SF-6: deductServiceFee does NOT fire SERVICE_FEE_DEDUCTED when no fees collected
 *
 * Gaps: G-W-N4-4 (refund), G-W-N4-5 (deduct)
 */

import { deductServiceFee, refundServiceFee } from "@/lib/serviceFeeManagement";
import { db } from "@/lib/db";

// Mock db
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
    organization: {
      findUnique: jest.fn(),
    },
    $transaction: jest.fn(),
  },
}));

// Mock service fee calculation
jest.mock("@/lib/serviceFeeCalculation", () => ({
  calculateServiceFee: jest.fn(),
  findMatchingCorridor: jest.fn(),
  calculateFeesFromCorridor: jest.fn(),
  calculatePartyFee: jest.fn((distance, pricePerKm) => {
    const baseFee = distance * pricePerKm;
    return {
      baseFee,
      finalFee: baseFee,
      promoDiscount: 0,
      promoApplied: false,
      pricePerKm,
    };
  }),
}));

// Mock notifications
let mockNotifyOrganization: jest.Mock;

jest.mock("@/lib/notifications", () => ({
  notifyOrganization: jest.fn(async () => {}),
  createNotificationForRole: jest.fn(async () => {}),
  NotificationType: {
    SERVICE_FEE_DEDUCTED: "SERVICE_FEE_DEDUCTED",
    SERVICE_FEE_REFUNDED: "SERVICE_FEE_REFUNDED",
    PARTIAL_FEE_COLLECTION: "PARTIAL_FEE_COLLECTION",
    LOW_BALANCE_WARNING: "LOW_BALANCE_WARNING",
  },
}));

const mockDb = db as any;

describe("Service Fee Notifications (G-W-N4-4, G-W-N4-5)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const notifications = require("@/lib/notifications");
    mockNotifyOrganization = notifications.notifyOrganization;
  });

  // ─── refundServiceFee ─────────────────────────────────────────────────────

  describe("refundServiceFee", () => {
    const makeLoad = (override: object = {}) => ({
      id: "load-sf-1",
      shipperId: "shipper-org-sf",
      shipperServiceFee: 500,
      shipperFeeStatus: "DEDUCTED",
      carrierServiceFee: 300,
      carrierFeeStatus: "DEDUCTED",
      serviceFeeEtb: 500,
      serviceFeeStatus: "DEDUCTED",
      shipper: { name: "Test Shipper SF" },
      assignedTruck: { carrierId: "carrier-org-sf" },
      ...override,
    });

    const makeAccounts = (
      overrides: {
        platform?: object;
        shipper?: object;
        carrier?: object | null;
      } = {}
    ) => {
      const platform = {
        id: "platform-sf",
        balance: 1000,
        ...overrides.platform,
      };
      const shipper = {
        id: "shipper-wallet-sf",
        balance: 5000,
        organizationId: "shipper-org-sf",
        ...overrides.shipper,
      };
      const carrier =
        overrides.carrier !== null
          ? {
              id: "carrier-wallet-sf",
              balance: 3000,
              organizationId: "carrier-org-sf",
              ...(overrides.carrier || {}),
            }
          : null;
      return [platform, shipper, carrier] as const;
    };

    function setupRefund(
      load: object,
      accounts: readonly [object, object, object | null]
    ) {
      mockDb.load.findUnique.mockResolvedValue(load);
      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce(accounts[0]) // platform
        .mockResolvedValueOnce(accounts[1]) // shipper
        .mockResolvedValueOnce(accounts[2]); // carrier

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<unknown>) => {
          const mockTx = {
            financialAccount: {
              findUnique: jest.fn().mockResolvedValue({ balance: 1000 }),
              update: jest.fn().mockImplementation((args: any) => {
                if (args.where.id === "shipper-wallet-sf") {
                  return Promise.resolve({ balance: 5500 });
                }
                return Promise.resolve({ balance: 0 });
              }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-sf-1" }),
            },
            load: { update: jest.fn().mockResolvedValue({}) },
          };
          return fn(mockTx);
        }
      );
    }

    // SF-1: refundServiceFee fires SERVICE_FEE_REFUNDED to shipper org
    it("SF-1: refundServiceFee → notifyOrganization called with SERVICE_FEE_REFUNDED for shipper org", async () => {
      const [platform, shipper, carrier] = makeAccounts();
      setupRefund(makeLoad(), [platform, shipper, carrier]);

      const result = await refundServiceFee("load-sf-1");
      expect(result.success).toBe(true);

      // Allow fire-and-forget to resolve
      await Promise.resolve();

      const shipperCall = mockNotifyOrganization.mock.calls.find(
        (c: any[]) =>
          c[0].organizationId === "shipper-org-sf" &&
          c[0].type === "SERVICE_FEE_REFUNDED"
      );
      expect(shipperCall).toBeDefined();
      expect(shipperCall![0]).toMatchObject({
        organizationId: "shipper-org-sf",
        type: "SERVICE_FEE_REFUNDED",
        title: "Service Fee Refunded",
      });
    });

    // SF-2: refundServiceFee fires SERVICE_FEE_REFUNDED to carrier org when carrier fee > 0
    it("SF-2: refundServiceFee → notifyOrganization called with SERVICE_FEE_REFUNDED for carrier org", async () => {
      const [platform, shipper, carrier] = makeAccounts();
      setupRefund(makeLoad(), [platform, shipper, carrier]);

      await refundServiceFee("load-sf-1");
      await Promise.resolve();

      const carrierCall = mockNotifyOrganization.mock.calls.find(
        (c: any[]) =>
          c[0].organizationId === "carrier-org-sf" &&
          c[0].type === "SERVICE_FEE_REFUNDED"
      );
      expect(carrierCall).toBeDefined();
      expect(carrierCall![0]).toMatchObject({
        organizationId: "carrier-org-sf",
        type: "SERVICE_FEE_REFUNDED",
      });
    });

    // SF-3: refundServiceFee does NOT fire to carrier when carrierFeeToRefund = 0
    it("SF-3: when carrier fee is 0 (PENDING), no SERVICE_FEE_REFUNDED notification for carrier", async () => {
      const loadNoCarrierFee = makeLoad({
        carrierServiceFee: 300,
        carrierFeeStatus: "PENDING", // not DEDUCTED → carrierFeeToRefund = 0
      });
      // When carrier fee = 0, carrier wallet is not fetched
      mockDb.load.findUnique.mockResolvedValue(loadNoCarrierFee);
      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({ id: "platform-sf", balance: 1000 })
        .mockResolvedValueOnce({
          id: "shipper-wallet-sf",
          balance: 5000,
          organizationId: "shipper-org-sf",
        });
      // No third call (carrier wallet fetch skipped)

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<unknown>) => {
          const mockTx = {
            financialAccount: {
              findUnique: jest.fn().mockResolvedValue({ balance: 1000 }),
              update: jest.fn().mockResolvedValue({ balance: 5500 }),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-sf-2" }),
            },
            load: { update: jest.fn().mockResolvedValue({}) },
          };
          return fn(mockTx);
        }
      );

      await refundServiceFee("load-sf-1");
      await Promise.resolve();

      const carrierCall = mockNotifyOrganization.mock.calls.find(
        (c: any[]) =>
          c[0].organizationId === "carrier-org-sf" &&
          c[0].type === "SERVICE_FEE_REFUNDED"
      );
      expect(carrierCall).toBeUndefined();
    });
  });

  // ─── deductServiceFee ─────────────────────────────────────────────────────

  describe("deductServiceFee", () => {
    const mockCorridor = {
      id: "corridor-sf",
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

    const makeDeductLoad = () => ({
      id: "load-sf-deduct",
      shipperId: "shipper-org-sf",
      corridorId: "corridor-sf",
      corridor: mockCorridor,
      shipperServiceFee: null,
      carrierServiceFee: null,
      shipperFeeStatus: "PENDING",
      carrierFeeStatus: "PENDING",
      actualTripKm: null,
      estimatedTripKm: 100,
      pickupCity: "Addis Ababa",
      deliveryCity: "Dire Dawa",
      pickupLocation: null,
      deliveryLocation: null,
      shipper: {
        name: "Test Shipper SF",
        shipperPricePerKm: null,
        shipperPromoFlag: false,
        shipperPromoPct: null,
      },
      assignedTruck: {
        carrierId: "carrier-org-sf",
        carrier: {
          name: "Test Carrier SF",
          carrierPricePerKm: null,
          carrierPromoFlag: false,
          carrierPromoPct: null,
        },
      },
    });

    function setupDeduct() {
      const {
        calculateFeesFromCorridor,
      } = require("@/lib/serviceFeeCalculation");
      calculateFeesFromCorridor.mockReturnValue({
        shipperPricePerKm: 5,
        carrierPricePerKm: 3,
        distanceKm: 100,
        distanceSource: "corridor",
      });

      mockDb.load.findUnique.mockResolvedValue(makeDeductLoad());
      mockDb.financialAccount.findFirst
        .mockResolvedValueOnce({
          id: "shipper-wallet-sf",
          balance: 5000,
          organizationId: "shipper-org-sf",
          minimumBalance: 1000,
        })
        .mockResolvedValueOnce({
          id: "carrier-wallet-sf",
          balance: 3000,
          organizationId: "carrier-org-sf",
          minimumBalance: 500,
        })
        .mockResolvedValueOnce(null); // platform account
      mockDb.financialAccount.create.mockResolvedValue({
        id: "platform-sf-new",
      });

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<unknown>) => {
          const mockTx = {
            load: {
              findUnique: jest
                .fn()
                .mockResolvedValue({
                  shipperFeeStatus: "PENDING",
                  carrierFeeStatus: "PENDING",
                }),
              update: jest.fn().mockResolvedValue({}),
            },
            financialAccount: {
              findUnique: jest
                .fn()
                .mockResolvedValueOnce({ balance: 5000 }) // shipper re-verify
                .mockResolvedValueOnce({ balance: 3000 }), // carrier re-verify
              update: jest.fn().mockResolvedValue({}),
            },
            journalEntry: {
              create: jest.fn().mockResolvedValue({ id: "journal-deduct-1" }),
            },
          };
          return fn(mockTx);
        }
      );
    }

    // SF-4: deductServiceFee fires SERVICE_FEE_DEDUCTED to shipper org
    it("SF-4: deductServiceFee → notifyOrganization called with SERVICE_FEE_DEDUCTED for shipper org", async () => {
      setupDeduct();

      const result = await deductServiceFee("load-sf-deduct");
      expect(result.success).toBe(true);

      await Promise.resolve();

      const shipperCall = mockNotifyOrganization.mock.calls.find(
        (c: any[]) =>
          c[0].organizationId === "shipper-org-sf" &&
          c[0].type === "SERVICE_FEE_DEDUCTED"
      );
      expect(shipperCall).toBeDefined();
      expect(shipperCall![0]).toMatchObject({
        type: "SERVICE_FEE_DEDUCTED",
        title: "Service Fee Deducted",
      });
    });

    // SF-5: deductServiceFee fires SERVICE_FEE_DEDUCTED to carrier org
    it("SF-5: deductServiceFee → notifyOrganization called with SERVICE_FEE_DEDUCTED for carrier org", async () => {
      setupDeduct();

      await deductServiceFee("load-sf-deduct");
      await Promise.resolve();

      const carrierCall = mockNotifyOrganization.mock.calls.find(
        (c: any[]) =>
          c[0].organizationId === "carrier-org-sf" &&
          c[0].type === "SERVICE_FEE_DEDUCTED"
      );
      expect(carrierCall).toBeDefined();
    });

    // SF-6: no SERVICE_FEE_DEDUCTED when no fees collected (zero-fee load — no corridor)
    it("SF-6: zero-fee load (no corridor) → no SERVICE_FEE_DEDUCTED notification", async () => {
      mockDb.load.findUnique.mockResolvedValue({
        id: "load-sf-zero",
        shipperId: "shipper-org-sf",
        corridorId: null,
        corridor: null,
        shipperFeeStatus: "PENDING",
        carrierFeeStatus: "PENDING",
        pickupCity: null,
        deliveryCity: null,
        pickupLocation: null,
        deliveryLocation: null,
        actualTripKm: null,
        estimatedTripKm: null,
        shipper: { name: "Zero Fee Shipper", shipperPricePerKm: null },
        assignedTruck: null,
      });

      mockDb.$transaction.mockImplementation(
        async (fn: (tx: any) => Promise<unknown>) => fn(mockDb)
      );

      const result = await deductServiceFee("load-sf-zero");
      expect(result.success).toBe(true);
      await Promise.resolve();

      const deductedCalls = mockNotifyOrganization.mock.calls.filter(
        (c: any[]) => c[0].type === "SERVICE_FEE_DEDUCTED"
      );
      expect(deductedCalls).toHaveLength(0);
    });
  });
});

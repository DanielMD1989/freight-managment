/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for wallet service — balance and transactions
 */
import { walletService } from "../../src/services/wallet";

const mockGet = jest.fn();

jest.mock("../../src/api/client", () => ({
  __esModule: true,
  default: {
    get: (...args: any[]) => mockGet(...args),
    defaults: { headers: { common: {} } },
  },
  getErrorMessage: jest.fn((e: any) => e.message),
}));

describe("Wallet Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("getBalance", () => {
    it("should call GET /api/wallet/balance", async () => {
      const mockData = {
        wallets: [
          {
            id: "w1",
            type: "MAIN",
            balance: 50000,
            currency: "ETB",
            updatedAt: "2026-02-20",
          },
        ],
        totalBalance: 50000,
        currency: "ETB",
        recentTransactionsCount: 3,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await walletService.getBalance();
      expect(mockGet).toHaveBeenCalledWith("/api/wallet/balance");
      expect(result.totalBalance).toBe(50000);
    });

    it("should return WalletBalanceResponse shape with wallets[], totalBalance, currency", async () => {
      const mockData = {
        wallets: [
          {
            id: "w1",
            type: "MAIN",
            balance: 25000,
            currency: "ETB",
            updatedAt: "2026-02-20",
          },
          {
            id: "w2",
            type: "ESCROW",
            balance: 10000,
            currency: "ETB",
            updatedAt: "2026-02-20",
          },
        ],
        totalBalance: 35000,
        currency: "ETB",
        recentTransactionsCount: 5,
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await walletService.getBalance();
      expect(result.wallets).toHaveLength(2);
      expect(result).toEqual(
        expect.objectContaining({
          wallets: expect.any(Array),
          totalBalance: expect.any(Number),
          currency: expect.any(String),
        })
      );
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Unauthorized"));

      await expect(walletService.getBalance()).rejects.toThrow("Unauthorized");
    });
  });

  describe("getTransactions", () => {
    it("should call GET /api/wallet/transactions", async () => {
      const mockData = {
        transactions: [{ id: "tx1", type: "CREDIT", amount: 1000 }],
        pagination: { limit: 20, offset: 0, totalCount: 1, hasMore: false },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await walletService.getTransactions();
      expect(mockGet).toHaveBeenCalledWith("/api/wallet/transactions", {
        params: undefined,
      });
      expect(result.transactions).toHaveLength(1);
    });

    it("should pass limit, offset, and type params", async () => {
      mockGet.mockResolvedValue({
        data: {
          transactions: [],
          pagination: { limit: 10, offset: 20, totalCount: 0, hasMore: false },
        },
      });

      await walletService.getTransactions({
        limit: 10,
        offset: 20,
        type: "CREDIT",
      });
      expect(mockGet).toHaveBeenCalledWith("/api/wallet/transactions", {
        params: { limit: 10, offset: 20, type: "CREDIT" },
      });
    });

    it("should return { transactions[], pagination } shape", async () => {
      const mockData = {
        transactions: [
          {
            id: "tx1",
            type: "CREDIT",
            description: "Payment",
            reference: "ref1",
            loadId: "l1",
            amount: 5000,
            createdAt: "2026-02-20",
          },
        ],
        pagination: { limit: 20, offset: 0, totalCount: 1, hasMore: false },
      };
      mockGet.mockResolvedValue({ data: mockData });

      const result = await walletService.getTransactions();
      expect(result).toEqual(
        expect.objectContaining({
          transactions: expect.any(Array),
          pagination: expect.objectContaining({
            limit: expect.any(Number),
            offset: expect.any(Number),
            totalCount: expect.any(Number),
            hasMore: expect.any(Boolean),
          }),
        })
      );
    });

    it("should use offset-based pagination (not page-based)", async () => {
      mockGet.mockResolvedValue({
        data: {
          transactions: [],
          pagination: { limit: 10, offset: 30, totalCount: 50, hasMore: true },
        },
      });

      await walletService.getTransactions({ limit: 10, offset: 30 });
      expect(mockGet).toHaveBeenCalledWith("/api/wallet/transactions", {
        params: expect.objectContaining({ offset: 30 }),
      });
      // Should NOT have a 'page' param
      expect(mockGet).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          params: expect.objectContaining({ page: expect.anything() }),
        })
      );
    });

    it("should propagate errors", async () => {
      mockGet.mockRejectedValue(new Error("Server error"));

      await expect(walletService.getTransactions()).rejects.toThrow(
        "Server error"
      );
    });
  });
});

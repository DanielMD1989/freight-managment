/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for wallet query hooks — read-only, no mutations
 */
import { walletService } from "../../src/services/wallet";

let capturedOptions: any = null;

jest.mock("@tanstack/react-query", () => ({
  useQuery: (options: any) => {
    capturedOptions = options;
    return { data: undefined, isLoading: true, error: null };
  },
}));

jest.mock("../../src/services/wallet", () => ({
  walletService: {
    getBalance: jest.fn(),
    getTransactions: jest.fn(),
  },
}));

import {
  useWalletBalance,
  useWalletTransactions,
} from "../../src/hooks/useWallet";

describe("Wallet Hooks", () => {
  beforeEach(() => {
    capturedOptions = null;
    jest.clearAllMocks();
  });

  describe("useWalletBalance", () => {
    it('should use queryKey ["wallet", "balance"]', () => {
      useWalletBalance();
      expect(capturedOptions.queryKey).toEqual(["wallet", "balance"]);
    });

    it("should call walletService.getBalance as queryFn", () => {
      useWalletBalance();
      capturedOptions.queryFn();
      expect(walletService.getBalance).toHaveBeenCalledTimes(1);
    });

    it("should NOT have refetchInterval", () => {
      useWalletBalance();
      expect(capturedOptions.refetchInterval).toBeUndefined();
    });
  });

  describe("useWalletTransactions", () => {
    it('should use queryKey ["wallet", "transactions", params]', () => {
      const params = { limit: 10, offset: 0, type: "CREDIT" };
      useWalletTransactions(params);
      expect(capturedOptions.queryKey).toEqual([
        "wallet",
        "transactions",
        params,
      ]);
    });

    it("should call walletService.getTransactions as queryFn", () => {
      const params = { limit: 20 };
      useWalletTransactions(params);
      capturedOptions.queryFn();
      expect(walletService.getTransactions).toHaveBeenCalledWith(params);
    });

    it("should NOT have refetchInterval", () => {
      useWalletTransactions();
      expect(capturedOptions.refetchInterval).toBeUndefined();
    });
  });
});

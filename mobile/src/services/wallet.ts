/**
 * Wallet Service - API calls for wallet balance and transactions
 */
import apiClient, { getErrorMessage } from "../api/client";

export interface WalletBalanceResponse {
  wallets: Array<{
    id: string;
    type: string;
    balance: number;
    currency: string;
    updatedAt: string;
  }>;
  totalBalance: number;
  currency: string;
  recentTransactionsCount: number;
}

export interface WalletTransaction {
  id: string;
  type: string;
  description: string;
  reference: string;
  loadId: string | null;
  amount: number;
  createdAt: string;
}

export interface WalletTransactionsResponse {
  transactions: WalletTransaction[];
  pagination: {
    limit: number;
    offset: number;
    totalCount: number;
    hasMore: boolean;
  };
}

class WalletService {
  /** Get wallet balance */
  async getBalance(): Promise<WalletBalanceResponse> {
    try {
      const response = await apiClient.get("/api/wallet/balance");
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get wallet transactions */
  async getTransactions(params?: {
    limit?: number;
    offset?: number;
    type?: string;
  }): Promise<WalletTransactionsResponse> {
    try {
      const response = await apiClient.get("/api/wallet/transactions", {
        params,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const walletService = new WalletService();

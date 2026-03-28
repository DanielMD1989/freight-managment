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

  /** §8 M1: Request a wallet deposit (Bank Transfer, Telebirr, M-Pesa) */
  async requestDeposit(data: {
    amount: number;
    paymentMethod: "BANK_TRANSFER_SLIP" | "TELEBIRR" | "MPESA";
    externalReference?: string;
    slipFileUrl?: string;
    notes?: string;
  }): Promise<{ deposit: WalletDeposit; message: string }> {
    try {
      const response = await apiClient.post("/api/wallet/deposit", data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get deposit requests */
  async getDeposits(params?: {
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    deposits: WalletDeposit[];
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      const response = await apiClient.get("/api/wallet/deposit", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export interface WalletDeposit {
  id: string;
  amount: number;
  paymentMethod: string;
  status: "PENDING" | "CONFIRMED" | "REJECTED";
  externalReference: string | null;
  notes: string | null;
  rejectionReason: string | null;
  createdAt: string;
  approvedAt: string | null;
  rejectedAt: string | null;
}

export const walletService = new WalletService();

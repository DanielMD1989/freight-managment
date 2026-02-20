/**
 * Wallet query hooks - TanStack Query wrappers
 */
import { useQuery } from "@tanstack/react-query";
import { walletService } from "../services/wallet";

const WALLET_KEY = ["wallet"] as const;

/** Fetch wallet balance */
export function useWalletBalance() {
  return useQuery({
    queryKey: [...WALLET_KEY, "balance"],
    queryFn: () => walletService.getBalance(),
  });
}

/** Fetch wallet transactions */
export function useWalletTransactions(params?: {
  limit?: number;
  offset?: number;
  type?: string;
}) {
  return useQuery({
    queryKey: [...WALLET_KEY, "transactions", params],
    queryFn: () => walletService.getTransactions(params),
  });
}

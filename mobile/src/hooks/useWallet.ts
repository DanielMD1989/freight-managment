/**
 * Wallet query hooks - TanStack Query wrappers
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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

/**
 * Submit a self-service wallet deposit request (Blueprint §8).
 * Mirrors the web shipper form added in commit eb68304.
 *
 * Status starts as PENDING; admin approves via /api/admin/wallet-deposits/[id]
 * and balance is only credited on approval.
 */
export function useRequestDeposit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      amount: number;
      paymentMethod: "BANK_TRANSFER_SLIP" | "TELEBIRR" | "MPESA";
      slipFileUrl?: string;
      externalReference?: string;
      notes?: string;
    }) => walletService.requestDeposit(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...WALLET_KEY, "deposits"] });
      // Balance won't change until admin approves, but invalidate so the
      // pending list updates.
    },
  });
}

/** List the current user's wallet deposit requests (PENDING/CONFIRMED/REJECTED) */
export function useWalletDeposits(
  status?: "PENDING" | "CONFIRMED" | "REJECTED"
) {
  return useQuery({
    queryKey: [...WALLET_KEY, "deposits", status],
    queryFn: () => walletService.getDeposits(status ? { status } : undefined),
  });
}

/**
 * Verification Status hook - TanStack Query wrapper
 * Fetches organization verification status including documentsLockedAt
 */
import { useQuery } from "@tanstack/react-query";
import apiClient from "../api/client";

interface VerificationStep {
  id: string;
  label: string;
  status: "completed" | "pending" | "not_started";
  description?: string;
}

interface VerificationStatusResponse {
  status: string;
  userRole: string;
  canAccessMarketplace: boolean;
  organization: {
    id: string;
    name: string;
    type: string;
    isVerified: boolean;
    verificationStatus: string;
    rejectionReason: string | null;
    documentsLockedAt: string | null;
  } | null;
  verification: {
    steps: VerificationStep[];
    progressPercent: number;
    documentsUploaded: boolean;
    documentCount: number;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
  };
  nextAction: {
    type: string;
    label: string;
    description: string;
  } | null;
  estimatedReviewTime: string | null;
}

export function useVerificationStatus(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["verification-status"],
    queryFn: async (): Promise<VerificationStatusResponse> => {
      const response = await apiClient.get("/api/user/verification-status");
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: 30_000, // G-M8-1: Auto-poll every 30 seconds
    enabled: options?.enabled,
  });
}

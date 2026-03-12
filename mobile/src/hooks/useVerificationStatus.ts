/**
 * Verification Status hook - TanStack Query wrapper
 * Fetches organization verification status including documentsLockedAt
 */
import { useQuery } from "@tanstack/react-query";
import apiClient from "../api/client";

interface VerificationStatusResponse {
  organization: {
    documentsLockedAt: string | null;
    verificationStatus: string;
    isVerified: boolean;
    rejectionReason: string | null;
  } | null;
  verification: {
    status: string;
    completedSteps: string[];
    nextStep: string | null;
  };
}

export function useVerificationStatus() {
  return useQuery({
    queryKey: ["verification-status"],
    queryFn: async (): Promise<VerificationStatusResponse> => {
      const response = await apiClient.get("/api/user/verification-status");
      return response.data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

/**
 * Dispute query hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { disputeService } from "../services/dispute";

const DISPUTES_KEY = ["disputes"] as const;

/** Fetch disputes */
export function useDisputes(params?: { status?: string; loadId?: string }) {
  return useQuery({
    queryKey: [...DISPUTES_KEY, params],
    queryFn: () => disputeService.getDisputes(params),
  });
}

/** Fetch single dispute */
export function useDispute(id: string | undefined) {
  return useQuery({
    queryKey: [...DISPUTES_KEY, id],
    queryFn: () => disputeService.getDispute(id!),
    enabled: !!id,
  });
}

/** Create dispute mutation */
export function useCreateDispute() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof disputeService.createDispute>[0]) =>
      disputeService.createDispute(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DISPUTES_KEY });
    },
  });
}

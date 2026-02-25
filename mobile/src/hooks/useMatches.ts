/**
 * Match query hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { matchService } from "../services/match";

const MATCHES_KEY = ["matching-trucks"] as const;
const PROPOSALS_KEY = ["match-proposals"] as const;

/** Fetch matching trucks for a load */
export function useMatchingTrucks(
  loadId: string | undefined,
  params?: { minScore?: number; limit?: number }
) {
  return useQuery({
    queryKey: [...MATCHES_KEY, loadId, params],
    queryFn: () => matchService.getMatchingTrucks(loadId!, params),
    enabled: !!loadId,
  });
}

/** Assign truck to load mutation */
export function useAssignTruck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ loadId, truckId }: { loadId: string; truckId: string }) =>
      matchService.assignTruck(loadId, truckId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MATCHES_KEY });
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

/** Fetch match proposals for carrier */
export function useMatchProposals(params?: {
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...PROPOSALS_KEY, params],
    queryFn: () => matchService.getMatchProposals(params),
  });
}

/** Respond to match proposal (accept/reject) */
export function useRespondToProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      proposalId,
      action,
      responseNotes,
    }: {
      proposalId: string;
      action: "ACCEPT" | "REJECT";
      responseNotes?: string;
    }) => matchService.respondToProposal(proposalId, action, responseNotes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PROPOSALS_KEY });
      queryClient.invalidateQueries({ queryKey: ["loads"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

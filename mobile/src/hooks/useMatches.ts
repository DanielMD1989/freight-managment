/**
 * Match query hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { matchService } from "../services/match";

const MATCHES_KEY = ["matching-trucks"] as const;

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

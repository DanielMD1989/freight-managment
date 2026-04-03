/**
 * Rating Hooks — §12 Ratings & Reviews
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ratingService } from "../services/rating";

const RATINGS_KEY = ["ratings"] as const;

/** Get ratings for a trip */
export function useTripRatings(tripId: string | undefined) {
  return useQuery({
    queryKey: [...RATINGS_KEY, "trip", tripId],
    queryFn: () => ratingService.getTripRatings(tripId!),
    enabled: !!tripId,
  });
}

/** Submit a rating */
export function useSubmitRating() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      data,
    }: {
      tripId: string;
      data: { stars: number; comment?: string };
    }) => ratingService.submitRating(tripId, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...RATINGS_KEY, "trip", variables.tripId],
      });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
    },
  });
}

/** Get ratings for an organization */
export function useOrgRatings(orgId: string | undefined) {
  return useQuery({
    queryKey: [...RATINGS_KEY, "org", orgId],
    queryFn: () => ratingService.getOrgRatings(orgId!),
    enabled: !!orgId,
  });
}

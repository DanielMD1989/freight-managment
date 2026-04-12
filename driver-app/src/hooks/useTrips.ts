/**
 * Trip query hooks for driver app
 * Adapted from mobile — removed useCancelTrip + useConfirmDelivery.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tripService } from "../services/trip";

const TRIPS_KEY = ["trips"] as const;

export function useTrips(
  params?: { page?: number; limit?: number; status?: string },
  options?: { refetchInterval?: number }
) {
  return useQuery({
    queryKey: [...TRIPS_KEY, params],
    queryFn: () => tripService.getTrips(params),
    ...(options?.refetchInterval && {
      refetchInterval: options.refetchInterval,
    }),
  });
}

export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: [...TRIPS_KEY, id],
    queryFn: () => tripService.getTrip(id!),
    enabled: !!id,
  });
}

export function useUpdateTripStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      status,
      extra,
    }: {
      id: string;
      status: string;
      extra?: {
        receiverName?: string;
        receiverPhone?: string;
        deliveryNotes?: string;
        exceptionReason?: string;
      };
    }) => tripService.updateTripStatus(id, status, extra),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
    },
  });
}

export function useUploadPod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      formData,
    }: {
      tripId: string;
      formData: FormData;
    }) => tripService.uploadPod(tripId, formData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
    },
  });
}

export function useTripPods(tripId: string | undefined) {
  return useQuery({
    queryKey: [...TRIPS_KEY, tripId, "pods"],
    queryFn: () => tripService.getTripPods(tripId!),
    enabled: !!tripId,
  });
}

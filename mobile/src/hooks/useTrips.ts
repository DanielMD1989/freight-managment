/**
 * Trip query hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { tripService } from "../services/trip";

const TRIPS_KEY = ["trips"] as const;

/** Fetch trips */
export function useTrips(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: [...TRIPS_KEY, params],
    queryFn: () => tripService.getTrips(params),
  });
}

/** Fetch single trip */
export function useTrip(id: string | undefined) {
  return useQuery({
    queryKey: [...TRIPS_KEY, id],
    queryFn: () => tripService.getTrip(id!),
    enabled: !!id,
  });
}

/** Update trip status mutation */
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
      };
    }) => tripService.updateTripStatus(id, status, extra),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
    },
  });
}

/** Cancel trip mutation */
export function useCancelTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) =>
      tripService.cancelTrip(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
    },
  });
}

/** Upload POD mutation */
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

/** Get trip PODs */
export function useTripPods(tripId: string | undefined) {
  return useQuery({
    queryKey: [...TRIPS_KEY, tripId, "pods"],
    queryFn: () => tripService.getTripPods(tripId!),
    enabled: !!tripId,
  });
}

/** Confirm delivery (shipper) */
export function useConfirmDelivery() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, notes }: { tripId: string; notes?: string }) =>
      tripService.confirmDelivery(tripId, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
    },
  });
}

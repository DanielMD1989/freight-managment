/**
 * Truck query hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { truckService } from "../services/truck";
import type { Truck, TruckPosting } from "../types";

const TRUCKS_KEY = ["trucks"] as const;
const TRUCK_POSTINGS_KEY = ["truck-postings"] as const;

/** Fetch all trucks for current carrier */
export function useTrucks(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: [...TRUCKS_KEY, params],
    queryFn: () => truckService.getTrucks(params),
  });
}

/** Fetch single truck */
export function useTruck(id: string | undefined) {
  return useQuery({
    queryKey: [...TRUCKS_KEY, id],
    queryFn: () => truckService.getTruck(id!),
    enabled: !!id,
  });
}

/** Create truck mutation */
export function useCreateTruck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof truckService.createTruck>[0]) =>
      truckService.createTruck(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRUCKS_KEY });
    },
  });
}

/** Update truck mutation */
export function useUpdateTruck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Truck> }) =>
      truckService.updateTruck(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRUCKS_KEY });
    },
  });
}

/** Delete truck mutation */
export function useDeleteTruck() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => truckService.deleteTruck(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRUCKS_KEY });
    },
  });
}

/** Fetch truck postings (marketplace) */
export function useTruckPostings(params?: {
  page?: number;
  limit?: number;
  truckType?: string;
  origin?: string;
  destination?: string;
}) {
  return useQuery({
    queryKey: [...TRUCK_POSTINGS_KEY, params],
    queryFn: () => truckService.getTruckPostings(params),
  });
}

/** Fetch single truck posting */
export function useTruckPosting(id: string | undefined) {
  return useQuery({
    queryKey: [...TRUCK_POSTINGS_KEY, id],
    queryFn: () => truckService.getTruckPosting(id!),
    enabled: !!id,
  });
}

/** Create truck posting mutation */
export function useCreateTruckPosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof truckService.createTruckPosting>[0]) =>
      truckService.createTruckPosting(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRUCK_POSTINGS_KEY });
    },
  });
}

/** Create truck request (shipper requests a truck) */
export function useCreateTruckRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof truckService.createTruckRequest>[0]) =>
      truckService.createTruckRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["truck-requests"] });
    },
  });
}

/** Get shipper's truck requests */
export function useMyTruckRequests(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: ["truck-requests", "mine", params],
    queryFn: () => truckService.getMyTruckRequests(params),
  });
}

/** Cancel a truck request */
export function useCancelTruckRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => truckService.cancelTruckRequest(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["truck-requests"] });
    },
  });
}

/** Received truck requests (carrier) */
export function useReceivedTruckRequests(params?: {
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: ["truck-requests", "received", params],
    queryFn: () => truckService.getReceivedTruckRequests(params),
  });
}

/** Respond to truck request */
export function useRespondToTruckRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      action,
      notes,
    }: {
      id: string;
      action: "APPROVED" | "REJECTED";
      notes?: string;
    }) => truckService.respondToTruckRequest(id, action, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["truck-requests"] });
    },
  });
}

/** My truck postings (carrier) */
export function useMyTruckPostings(params?: {
  page?: number;
  limit?: number;
  status?: string;
  organizationId?: string;
}) {
  return useQuery({
    queryKey: [...TRUCK_POSTINGS_KEY, "mine", params],
    queryFn: () => truckService.getMyTruckPostings(params),
    enabled: !!params?.organizationId,
  });
}

/** Update truck posting */
export function useUpdateTruckPosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<TruckPosting> }) =>
      truckService.updateTruckPosting(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRUCK_POSTINGS_KEY });
    },
  });
}

/** Cancel truck posting */
export function useCancelTruckPosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => truckService.cancelTruckPosting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRUCK_POSTINGS_KEY });
    },
  });
}

/** Get matching loads for a posting */
export function useMatchingLoadsForPosting(
  postingId: string | undefined,
  params?: { minScore?: number; limit?: number }
) {
  return useQuery({
    queryKey: [...TRUCK_POSTINGS_KEY, postingId, "matching-loads", params],
    queryFn: () => truckService.getMatchingLoadsForPosting(postingId!, params),
    enabled: !!postingId,
  });
}

/** Duplicate truck posting */
export function useDuplicateTruckPosting() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => truckService.duplicateTruckPosting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRUCK_POSTINGS_KEY });
    },
  });
}

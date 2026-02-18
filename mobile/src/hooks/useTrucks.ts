/**
 * Truck query hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { truckService } from "../services/truck";
import type { Truck } from "../types";

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

/** My truck postings (carrier) */
export function useMyTruckPostings(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: [...TRUCK_POSTINGS_KEY, "mine", params],
    queryFn: () => truckService.getMyTruckPostings(params),
  });
}

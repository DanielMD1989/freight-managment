/**
 * Load query hooks - TanStack Query wrappers
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { loadService } from "../services/load";
import type { Load } from "../types";

const LOADS_KEY = ["loads"] as const;
const LOAD_REQUESTS_KEY = ["load-requests"] as const;

/** Fetch loads */
export function useLoads(params?: {
  page?: number;
  limit?: number;
  status?: string;
  truckType?: string;
  origin?: string;
  destination?: string;
  myLoads?: boolean;
}) {
  return useQuery({
    queryKey: [...LOADS_KEY, params],
    queryFn: () => loadService.getLoads(params),
  });
}

/** Fetch single load */
export function useLoad(id: string | undefined) {
  return useQuery({
    queryKey: [...LOADS_KEY, id],
    queryFn: () => loadService.getLoad(id!),
    enabled: !!id,
  });
}

/** Create load mutation */
export function useCreateLoad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof loadService.createLoad>[0]) =>
      loadService.createLoad(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOADS_KEY });
    },
  });
}

/** Update load mutation */
export function useUpdateLoad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Load> }) =>
      loadService.updateLoad(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOADS_KEY });
    },
  });
}

/** Delete load mutation */
export function useDeleteLoad() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => loadService.deleteLoad(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOADS_KEY });
    },
  });
}

/** Create load request (carrier requests a load) */
export function useCreateLoadRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof loadService.createLoadRequest>[0]) =>
      loadService.createLoadRequest(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOAD_REQUESTS_KEY });
    },
  });
}

/** Get requests for a load */
export function useLoadRequests(loadId: string | undefined) {
  return useQuery({
    queryKey: [...LOAD_REQUESTS_KEY, loadId],
    queryFn: () => loadService.getLoadRequests(loadId!),
    enabled: !!loadId,
  });
}

/** Respond to load request */
export function useRespondToLoadRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      requestId,
      action,
      notes,
    }: {
      requestId: string;
      action: "APPROVED" | "REJECTED";
      notes?: string;
    }) => loadService.respondToLoadRequest(requestId, action, notes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOAD_REQUESTS_KEY });
      queryClient.invalidateQueries({ queryKey: LOADS_KEY });
    },
  });
}

/** Received load requests (shipper — carriers requesting your loads) */
export function useReceivedLoadRequests(params?: {
  status?: string;
  limit?: number;
}) {
  return useQuery({
    queryKey: [...LOAD_REQUESTS_KEY, "received", params],
    queryFn: () => loadService.getReceivedLoadRequests(params),
  });
}

/** Cancel load request (carrier) */
export function useCancelLoadRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (requestId: string) => loadService.cancelLoadRequest(requestId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: LOAD_REQUESTS_KEY });
    },
  });
}

/** My load requests (carrier) */
export function useMyLoadRequests(params?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  return useQuery({
    queryKey: [...LOAD_REQUESTS_KEY, "mine", params],
    queryFn: () => loadService.getMyLoadRequests(params),
  });
}

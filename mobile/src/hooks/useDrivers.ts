/**
 * Driver query hooks - TanStack Query wrappers
 * Task 22: Carrier mobile driver management
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient, { getErrorMessage } from "../api/client";

const DRIVERS_KEY = ["drivers"] as const;
const TRIPS_KEY = ["trips"] as const;

/** Fetch drivers for current carrier org */
export function useDrivers(params?: {
  page?: number;
  limit?: number;
  status?: string;
  available?: string;
}) {
  return useQuery({
    queryKey: [...DRIVERS_KEY, params],
    queryFn: async () => {
      const response = await apiClient.get("/api/drivers", { params });
      return response.data as {
        drivers: Array<{
          id: string;
          firstName: string | null;
          lastName: string | null;
          phone: string | null;
          email: string;
          status: string;
          createdAt: string;
          driverProfile: {
            cdlNumber: string | null;
            cdlExpiry: string | null;
            medicalCertExp: string | null;
            isAvailable: boolean;
            createdAt: string;
          } | null;
          activeTrips: number;
        }>;
        total: number;
      };
    },
  });
}

/** Fetch single driver detail */
export function useDriver(id: string | undefined) {
  return useQuery({
    queryKey: [...DRIVERS_KEY, id],
    queryFn: async () => {
      const response = await apiClient.get(`/api/drivers/${id}`);
      return response.data;
    },
    enabled: !!id,
  });
}

/** Invite a new driver */
export function useInviteDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: {
      name: string;
      phone: string;
      email?: string;
    }) => {
      const response = await apiClient.post("/api/drivers/invite", data);
      return response.data as {
        success: boolean;
        inviteCode: string;
        driverName: string;
        phone: string;
        expiresAt: string;
      };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVERS_KEY });
    },
  });
}

/** Approve a pending driver */
export function useApproveDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (driverId: string) => {
      const response = await apiClient.post(`/api/drivers/${driverId}/approve`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVERS_KEY });
    },
  });
}

/** Reject a pending driver */
export function useRejectDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      driverId,
      reason,
    }: {
      driverId: string;
      reason: string;
    }) => {
      const response = await apiClient.post(`/api/drivers/${driverId}/reject`, {
        reason,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVERS_KEY });
    },
  });
}

/** Suspend (soft-delete) a driver */
export function useSuspendDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (driverId: string) => {
      const response = await apiClient.delete(`/api/drivers/${driverId}`);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: DRIVERS_KEY });
    },
  });
}

/** Assign a driver to a trip */
export function useAssignDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tripId,
      driverId,
    }: {
      tripId: string;
      driverId: string;
    }) => {
      const response = await apiClient.post(
        `/api/trips/${tripId}/assign-driver`,
        { driverId }
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
      queryClient.invalidateQueries({ queryKey: DRIVERS_KEY });
    },
  });
}

/** Unassign a driver from a trip */
export function useUnassignDriver() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tripId: string) => {
      const response = await apiClient.post(
        `/api/trips/${tripId}/unassign-driver`
      );
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRIPS_KEY });
      queryClient.invalidateQueries({ queryKey: DRIVERS_KEY });
    },
  });
}

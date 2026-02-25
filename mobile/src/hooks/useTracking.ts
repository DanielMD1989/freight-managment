/**
 * Tracking query hooks - TanStack Query wrappers for GPS/progress
 */
import { useQuery } from "@tanstack/react-query";
import { trackingService } from "../services/tracking";

/** Fetch load progress with 30s polling */
export function useLoadProgress(loadId: string | undefined) {
  return useQuery({
    queryKey: ["load-progress", loadId],
    queryFn: () => trackingService.getLoadProgress(loadId!),
    enabled: !!loadId,
    refetchInterval: 30000,
  });
}

/** Fetch carrier GPS truck data with 30s polling */
export function useCarrierGPS() {
  return useQuery({
    queryKey: ["carrier-gps"],
    queryFn: () => trackingService.getCarrierGPS(),
    refetchInterval: 30000,
  });
}

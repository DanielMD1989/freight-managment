/**
 * Role-specific dashboard query hooks
 */
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "../services/dashboard";

/** Fetch carrier dashboard stats */
export function useCarrierDashboard() {
  return useQuery({
    queryKey: ["carrier-dashboard"],
    queryFn: () => dashboardService.getCarrierDashboard(),
    refetchInterval: 60000,
  });
}

/** Fetch shipper dashboard stats */
export function useShipperDashboard() {
  return useQuery({
    queryKey: ["shipper-dashboard"],
    queryFn: () => dashboardService.getShipperDashboard(),
    refetchInterval: 60000,
  });
}

/**
 * Dashboard query hooks
 */
import { useQuery } from "@tanstack/react-query";
import { dashboardService } from "../services/dashboard";

const DASHBOARD_KEY = ["dashboard"] as const;

/** Fetch dashboard stats */
export function useDashboard() {
  return useQuery({
    queryKey: DASHBOARD_KEY,
    queryFn: () => dashboardService.getDashboard(),
    refetchInterval: 60000, // Refresh every minute
  });
}

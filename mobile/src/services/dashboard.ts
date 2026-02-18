/**
 * Dashboard Service - API calls for dashboard stats
 * Ported from Flutter's dashboard_service.dart (129 LOC)
 */
import apiClient, { getErrorMessage } from "../api/client";
import type { DashboardStats } from "../types";

class DashboardService {
  /** Get dashboard stats */
  async getDashboard(): Promise<DashboardStats> {
    try {
      const response = await apiClient.get("/api/dashboard");
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const dashboardService = new DashboardService();

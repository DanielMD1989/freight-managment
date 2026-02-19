/**
 * Dashboard Service - Role-specific API calls for dashboard stats
 */
import apiClient, { getErrorMessage } from "../api/client";
import type { CarrierDashboardStats, ShipperDashboardStats } from "../types";

class DashboardService {
  /** Get carrier dashboard stats from /api/carrier/dashboard */
  async getCarrierDashboard(): Promise<CarrierDashboardStats> {
    try {
      const response = await apiClient.get("/api/carrier/dashboard");
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get shipper dashboard stats from /api/shipper/dashboard */
  async getShipperDashboard(): Promise<ShipperDashboardStats> {
    try {
      const response = await apiClient.get("/api/shipper/dashboard");
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const dashboardService = new DashboardService();

/**
 * Driver Service - Driver-specific API calls
 */
import apiClient, { getErrorMessage } from "../api/client";
import type {
  AcceptInvitePayload,
  AcceptInviteResponse,
  DriverProfile,
} from "../types";

class DriverService {
  async acceptInvite(
    payload: AcceptInvitePayload
  ): Promise<AcceptInviteResponse> {
    try {
      const response = await apiClient.post(
        "/api/drivers/accept-invite",
        payload
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getMyProfile(): Promise<{
    user: Record<string, unknown>;
    driverProfile: DriverProfile;
  }> {
    try {
      const response = await apiClient.get("/api/auth/me");
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async updateAvailability(
    driverId: string,
    isAvailable: boolean
  ): Promise<void> {
    try {
      await apiClient.put(`/api/drivers/${driverId}`, { isAvailable });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async updateProfile(
    driverId: string,
    data: Partial<DriverProfile>
  ): Promise<void> {
    try {
      await apiClient.put(`/api/drivers/${driverId}`, data);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const driverService = new DriverService();

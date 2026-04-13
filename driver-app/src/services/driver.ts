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

  async uploadCdlPhoto(
    driverId: string,
    fieldName: "cdlFront" | "cdlBack" | "medicalCert",
    uri: string,
    fileName: string,
    mimeType: string
  ): Promise<{
    cdlFrontUrl: string | null;
    cdlBackUrl: string | null;
    medicalCertUrl: string | null;
  }> {
    try {
      const formData = new FormData();
      formData.append(fieldName, {
        uri,
        name: fileName,
        type: mimeType,
      } as unknown as Blob);

      const response = await apiClient.post(
        `/api/drivers/${driverId}/cdl-upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );
      return response.data.updated;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const driverService = new DriverService();

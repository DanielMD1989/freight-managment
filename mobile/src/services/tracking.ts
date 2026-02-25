/**
 * Tracking Service - GPS and load progress API calls
 */
import apiClient, { getErrorMessage } from "../api/client";

export interface LoadProgress {
  loadId: string;
  status: string;
  trackingEnabled: boolean;
  progress: {
    percent: number;
    remainingKm: number | null;
    totalDistanceKm: number | null;
    travelledKm: number | null;
    estimatedArrival: string | null;
    isNearDestination: boolean;
  };
}

class TrackingService {
  /** Get load progress */
  async getLoadProgress(loadId: string): Promise<LoadProgress> {
    try {
      const response = await apiClient.get(`/api/loads/${loadId}/progress`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const trackingService = new TrackingService();

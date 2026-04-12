/**
 * Driver GPS Service — sends phone-based location to the trip GPS endpoint
 */
import apiClient, { getErrorMessage } from "../api/client";

export interface DriverGpsPoint {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
  altitude?: number;
  accuracy?: number;
  timestamp?: string;
}

class DriverGpsService {
  async sendPosition(tripId: string, point: DriverGpsPoint): Promise<void> {
    try {
      await apiClient.post(`/api/trips/${tripId}/gps`, {
        ...point,
        timestamp: point.timestamp || new Date().toISOString(),
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const driverGpsService = new DriverGpsService();

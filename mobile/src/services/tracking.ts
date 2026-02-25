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

export interface TruckGpsDevice {
  id: string;
  imei: string;
  status: string;
  lastSeenAt: string;
}

export interface TruckWithGPS {
  id: string;
  licensePlate: string;
  truckType: string;
  isAvailable: boolean;
  currentCity: string | null;
  gpsDevice: TruckGpsDevice | null;
}

export interface CarrierGPSResponse {
  trucks: TruckWithGPS[];
  timestamp: string;
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

  /** Get carrier's trucks with GPS device info */
  async getCarrierGPS(): Promise<CarrierGPSResponse> {
    try {
      const response = await apiClient.get("/api/carrier/gps");
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const trackingService = new TrackingService();

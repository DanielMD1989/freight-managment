/**
 * Match Service - API calls for truck-load matching
 */
import apiClient, { getErrorMessage } from "../api/client";

export interface TruckMatch {
  id: string;
  isExactMatch: boolean;
  score: number;
  currentCity: string;
  destinationCity: string | null;
  availableDate: string;
  truckType: string;
  maxWeight: number | null;
  lengthM: number | null;
  fullPartial: string;
  carrier: {
    id: string;
    name: string;
    isVerified: boolean;
    contactPhone: string | null;
    contactEmail: string | null;
  };
  contactName: string;
  contactPhone: string;
  createdAt: string;
  status: string;
  originCity: { name: string };
  truck: {
    id: string;
    truckType: string;
    capacity: number;
    lengthM: number;
    licensePlate: string;
  };
}

export interface MatchingTrucksResponse {
  trucks: TruckMatch[];
  total: number;
  exactMatches: number;
}

export interface AssignTruckResponse {
  load: { id: string; status: string };
  trip: { id: string; status: string; trackingUrl: string };
  trackingUrl: string | null;
  message: string;
}

class MatchService {
  /** Get matching trucks for a load */
  async getMatchingTrucks(
    loadId: string,
    params?: { minScore?: number; limit?: number }
  ): Promise<MatchingTrucksResponse> {
    try {
      const response = await apiClient.get(
        `/api/loads/${loadId}/matching-trucks`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Assign a truck to a load */
  async assignTruck(
    loadId: string,
    truckId: string
  ): Promise<AssignTruckResponse> {
    try {
      const response = await apiClient.post(`/api/loads/${loadId}/assign`, {
        truckId,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const matchService = new MatchService();

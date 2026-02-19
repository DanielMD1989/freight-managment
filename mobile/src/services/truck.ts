/**
 * Truck Service - API calls for trucks and truck postings
 * Ported from Flutter's truck_service.dart (960 LOC)
 */
import apiClient, { getErrorMessage } from "../api/client";
import type {
  Truck,
  TruckPosting,
  TrucksResponse,
  PaginationInfo,
} from "../types";

class TruckService {
  // ---- Trucks ----

  /** Get all trucks for current carrier */
  async getTrucks(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<TrucksResponse> {
    try {
      const response = await apiClient.get("/api/trucks", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get single truck by ID */
  async getTruck(id: string): Promise<Truck> {
    try {
      const response = await apiClient.get(`/api/trucks/${id}`);
      // Defensive: handle wrapped/unwrapped response
      return response.data.truck ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Create new truck */
  async createTruck(data: {
    truckType: string;
    licensePlate: string;
    capacity: number;
    volume?: number;
    lengthM?: number;
    ownerName?: string;
    contactName?: string;
    contactPhone?: string;
  }): Promise<Truck> {
    try {
      const response = await apiClient.post("/api/trucks", data);
      // POST wraps: { truck: {...} }
      return response.data.truck ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Update truck */
  async updateTruck(id: string, data: Partial<Truck>): Promise<Truck> {
    try {
      const response = await apiClient.patch(`/api/trucks/${id}`, data);
      return response.data.truck ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Delete truck */
  async deleteTruck(id: string): Promise<void> {
    try {
      await apiClient.delete(`/api/trucks/${id}`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  // ---- Truck Postings ----

  /** Get truck postings (public marketplace) */
  async getTruckPostings(params?: {
    page?: number;
    limit?: number;
    truckType?: string;
    origin?: string;
    destination?: string;
  }): Promise<{ postings: TruckPosting[]; pagination: PaginationInfo }> {
    try {
      const response = await apiClient.get("/api/truck-postings", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get single truck posting */
  async getTruckPosting(id: string): Promise<TruckPosting> {
    try {
      const response = await apiClient.get(`/api/truck-postings/${id}`);
      return response.data.posting ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Create truck posting */
  async createTruckPosting(data: {
    truckId: string;
    originCityId: string;
    destinationCityId?: string;
    availableFrom: string;
    availableTo?: string;
    fullPartial?: string;
    availableLength?: number;
    availableWeight?: number;
    contactName: string;
    contactPhone: string;
    ownerName?: string;
    notes?: string;
  }): Promise<TruckPosting> {
    try {
      const response = await apiClient.post("/api/truck-postings", data);
      return response.data.posting ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Update truck posting */
  async updateTruckPosting(
    id: string,
    data: Partial<TruckPosting>
  ): Promise<TruckPosting> {
    try {
      const response = await apiClient.patch(`/api/truck-postings/${id}`, data);
      return response.data.posting ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Cancel truck posting */
  async cancelTruckPosting(id: string): Promise<void> {
    try {
      await apiClient.patch(`/api/truck-postings/${id}`, {
        status: "CANCELLED",
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  // ---- Truck Requests (shipper requesting a truck) ----

  /** Create a truck request (shipper requests a truck for a load) */
  async createTruckRequest(data: {
    loadId: string;
    truckId: string;
    notes?: string;
    expiresInHours?: number;
  }): Promise<{ request: unknown; message: string }> {
    try {
      const response = await apiClient.post("/api/truck-requests", data);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get my truck requests (shipper) */
  async getMyTruckRequests(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ requests: unknown[]; total: number }> {
    try {
      const response = await apiClient.get("/api/truck-requests", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get my truck postings (carrier) */
  async getMyTruckPostings(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ postings: TruckPosting[]; pagination: PaginationInfo }> {
    try {
      const response = await apiClient.get("/api/truck-postings/mine", {
        params,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const truckService = new TruckService();

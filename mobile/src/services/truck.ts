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
      const { page, limit = 20, ...rest } = params || {};
      const offset = page && page > 1 ? (page - 1) * limit : 0;
      const response = await apiClient.get("/api/truck-postings", {
        params: { offset, limit, ...rest },
      });
      const data = response.data;
      const postings: TruckPosting[] =
        data.postings ?? data.truckPostings ?? [];
      const total: number = data.total ?? postings.length;
      return {
        postings,
        pagination: {
          page: page ?? 1,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
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

  /** Cancel a truck request */
  async cancelTruckRequest(id: string): Promise<void> {
    try {
      await apiClient.delete(`/api/truck-requests/${id}`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get received truck requests (carrier — shippers requesting carrier trucks) */
  async getReceivedTruckRequests(params?: {
    status?: string;
    limit?: number;
  }): Promise<{ requests: unknown[]; total: number }> {
    try {
      const response = await apiClient.get("/api/truck-requests", {
        params: { ...params, received: true },
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Respond to truck request */
  async respondToTruckRequest(
    id: string,
    action: "APPROVED" | "REJECTED",
    notes?: string
  ): Promise<unknown> {
    try {
      const apiAction = action === "APPROVED" ? "APPROVE" : "REJECT";
      const response = await apiClient.post(
        `/api/truck-requests/${id}/respond`,
        {
          action: apiAction,
          responseNotes: notes,
        }
      );
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
    organizationId?: string;
  }): Promise<{ postings: TruckPosting[]; pagination: PaginationInfo }> {
    try {
      const response = await apiClient.get("/api/truck-postings", {
        params,
      });
      const data = response.data;
      return {
        postings: data.postings ?? data.truckPostings ?? [],
        pagination: data.pagination ?? {
          total: data.total ?? 0,
          limit: params?.limit ?? 20,
          page: params?.page ?? 1,
          pages: 1,
        },
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get matching loads for a posting */
  async getMatchingLoadsForPosting(
    postingId: string,
    params?: { minScore?: number; limit?: number }
  ): Promise<{ matches: unknown[]; total: number }> {
    try {
      const response = await apiClient.get(
        `/api/truck-postings/${postingId}/matching-loads`,
        { params }
      );
      return {
        matches: response.data.matches ?? [],
        total: response.data.totalMatches ?? response.data.matches?.length ?? 0,
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Duplicate truck posting */
  async duplicateTruckPosting(id: string): Promise<TruckPosting> {
    try {
      const response = await apiClient.post(
        `/api/truck-postings/${id}/duplicate`
      );
      return response.data.posting ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const truckService = new TruckService();

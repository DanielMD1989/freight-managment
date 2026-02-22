/**
 * Load Service - API calls for loads and load requests
 * Ported from Flutter's load_service.dart (537 LOC)
 */
import apiClient, { getErrorMessage } from "../api/client";
import type {
  Load,
  LoadRequest,
  LoadsResponse,
  PaginationInfo,
} from "../types";

class LoadService {
  /** Get loads (with optional filters) */
  async getLoads(params?: {
    page?: number;
    limit?: number;
    status?: string;
    truckType?: string;
    origin?: string;
    destination?: string;
    myLoads?: boolean;
  }): Promise<LoadsResponse> {
    try {
      const response = await apiClient.get("/api/loads", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get single load by ID */
  async getLoad(id: string): Promise<Load> {
    try {
      const response = await apiClient.get(`/api/loads/${id}`);
      return response.data.load ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Create new load (shipper) */
  async createLoad(data: {
    pickupCity: string;
    pickupCityId?: string;
    deliveryCity: string;
    deliveryCityId?: string;
    pickupDate: string;
    deliveryDate: string;
    truckType: string;
    weight: number;
    cargoDescription: string;
    fullPartial?: string;
    bookMode?: string;
    isFragile?: boolean;
    requiresRefrigeration?: boolean;
    isAnonymous?: boolean;
    appointmentRequired?: boolean;
    volume?: number;
    shipperContactName?: string;
    shipperContactPhone?: string;
    pickupAddress?: string;
    deliveryAddress?: string;
    specialInstructions?: string;
    status?: string;
  }): Promise<Load> {
    try {
      const response = await apiClient.post("/api/loads", data);
      // POST wraps: { load: {...} }
      return response.data.load ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Update load */
  async updateLoad(id: string, data: Partial<Load>): Promise<Load> {
    try {
      const response = await apiClient.patch(`/api/loads/${id}`, data);
      return response.data.load ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Delete load */
  async deleteLoad(id: string): Promise<void> {
    try {
      await apiClient.delete(`/api/loads/${id}`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Post a draft load to marketplace */
  async postLoad(id: string): Promise<Load> {
    try {
      const response = await apiClient.patch(`/api/loads/${id}`, {
        status: "POSTED",
      });
      return response.data.load ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  // ---- Load Requests (carrier requesting a load) ----

  /** Create load request */
  async createLoadRequest(data: {
    loadId: string;
    truckId: string;
    notes?: string;
    proposedRate?: number;
  }): Promise<LoadRequest> {
    try {
      const response = await apiClient.post("/api/load-requests", data);
      return response.data.request ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get load requests for a load */
  async getLoadRequests(
    loadId: string
  ): Promise<{ requests: LoadRequest[]; pagination: PaginationInfo }> {
    try {
      const response = await apiClient.get("/api/load-requests", {
        params: { loadId },
      });
      return {
        requests: response.data.loadRequests ?? response.data.requests ?? [],
        pagination: response.data.pagination,
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Respond to load request (shipper approves/rejects) */
  async respondToLoadRequest(
    requestId: string,
    action: "APPROVED" | "REJECTED",
    notes?: string
  ): Promise<LoadRequest> {
    try {
      const apiAction = action === "APPROVED" ? "APPROVE" : "REJECT";
      const response = await apiClient.post(
        `/api/load-requests/${requestId}/respond`,
        {
          action: apiAction,
          responseNotes: notes,
        }
      );
      return response.data.request ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Cancel load request */
  async cancelLoadRequest(requestId: string): Promise<void> {
    try {
      await apiClient.patch(`/api/load-requests/${requestId}`, {
        status: "CANCELLED",
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get received load requests (shipper — carriers requesting your loads) */
  async getReceivedLoadRequests(params?: {
    status?: string;
    limit?: number;
  }): Promise<{ loadRequests: LoadRequest[]; pagination: PaginationInfo }> {
    try {
      const response = await apiClient.get("/api/load-requests", { params });
      return {
        loadRequests: response.data.loadRequests ?? [],
        pagination: response.data.pagination,
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get my load requests (carrier) */
  async getMyLoadRequests(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<{ requests: LoadRequest[]; pagination: PaginationInfo }> {
    try {
      const response = await apiClient.get("/api/load-requests", {
        params,
      });
      return {
        requests: response.data.loadRequests ?? response.data.requests ?? [],
        pagination: response.data.pagination,
      };
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const loadService = new LoadService();

/**
 * Dispute Service - API calls for dispute management
 */
import apiClient, { getErrorMessage } from "../api/client";
import type { Dispute, DisputesResponse } from "../types";

class DisputeService {
  /** Get disputes (with optional filters) */
  async getDisputes(params?: {
    status?: string;
    loadId?: string;
  }): Promise<DisputesResponse> {
    try {
      const response = await apiClient.get("/api/disputes", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get single dispute by ID */
  async getDispute(id: string): Promise<Dispute> {
    try {
      const response = await apiClient.get(`/api/disputes/${id}`);
      return response.data.dispute ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Create new dispute */
  async createDispute(data: {
    loadId: string;
    type: string;
    description: string;
    evidence?: string[];
  }): Promise<Dispute> {
    try {
      const response = await apiClient.post("/api/disputes", data);
      return response.data.dispute ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const disputeService = new DisputeService();

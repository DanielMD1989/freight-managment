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

  /** Get match proposals (carrier sees proposals for their trucks) */
  async getMatchProposals(params?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<MatchProposalsResponse> {
    try {
      const response = await apiClient.get("/api/match-proposals", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Respond to a match proposal (accept or reject) */
  async respondToProposal(
    proposalId: string,
    action: "ACCEPT" | "REJECT",
    responseNotes?: string
  ): Promise<{ proposal: MatchProposal; message: string }> {
    try {
      const response = await apiClient.post(
        `/api/match-proposals/${proposalId}/respond`,
        { action, responseNotes }
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export interface MatchProposal {
  id: string;
  loadId: string;
  truckId: string;
  carrierId: string;
  status: string;
  notes: string | null;
  proposedRate: number | null;
  expiresAt: string;
  createdAt: string;
  respondedAt: string | null;
  load: {
    pickupCity: string;
    deliveryCity: string;
    pickupDate: string | null;
    weight: number | null;
    truckType: string;
    status: string;
  };
  truck: {
    licensePlate: string;
    truckType: string;
    capacity: number | null;
  };
  carrier: {
    name: string;
  };
  proposedBy: {
    firstName: string | null;
    lastName: string | null;
  };
}

export interface MatchProposalsResponse {
  proposals: MatchProposal[];
  total: number;
  limit: number;
  offset: number;
}

export const matchService = new MatchService();

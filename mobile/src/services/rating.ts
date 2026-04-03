/**
 * Rating Service — §12 Ratings & Reviews
 */
import apiClient, { getErrorMessage } from "../api/client";

export interface Rating {
  id: string;
  stars: number;
  comment?: string | null;
  raterRole: "SHIPPER" | "CARRIER";
  tripId: string;
  raterId: string;
  rater?: { firstName?: string; lastName?: string } | null;
  ratedOrgId: string;
  createdAt: string;
}

class RatingService {
  async submitRating(
    tripId: string,
    data: { stars: number; comment?: string }
  ): Promise<Rating> {
    try {
      const response = await apiClient.post(`/api/trips/${tripId}/rate`, data);
      return response.data.rating ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getTripRatings(
    tripId: string
  ): Promise<{ ratings: Rating[]; myRating: Rating | null }> {
    try {
      const response = await apiClient.get(`/api/trips/${tripId}/rate`);
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getOrgRatings(
    orgId: string,
    params?: { page?: number; limit?: number }
  ): Promise<{
    ratings: Rating[];
    averageRating: number | null;
    totalRatings: number;
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      const response = await apiClient.get(
        `/api/organizations/${orgId}/ratings`,
        { params }
      );
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const ratingService = new RatingService();

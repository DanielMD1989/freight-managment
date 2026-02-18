/**
 * Trip Service - API calls for trips
 * Ported from Flutter's trip_service.dart (308 LOC)
 */
import apiClient, { getErrorMessage } from "../api/client";
import type { Trip, TripsResponse, TripPod } from "../types";

class TripService {
  /** Get trips */
  async getTrips(params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<TripsResponse> {
    try {
      const response = await apiClient.get("/api/trips", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get single trip */
  async getTrip(id: string): Promise<Trip> {
    try {
      const response = await apiClient.get(`/api/trips/${id}`);
      return response.data.trip ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Update trip status */
  async updateTripStatus(id: string, status: string): Promise<Trip> {
    try {
      const response = await apiClient.patch(`/api/trips/${id}/status`, {
        status,
      });
      return response.data.trip ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Cancel trip */
  async cancelTrip(id: string, reason: string): Promise<Trip> {
    try {
      const response = await apiClient.patch(`/api/trips/${id}/status`, {
        status: "CANCELLED",
        cancelReason: reason,
      });
      return response.data.trip ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Upload POD (proof of delivery) */
  async uploadPod(tripId: string, formData: FormData): Promise<TripPod> {
    try {
      const response = await apiClient.post(
        `/api/trips/${tripId}/pod`,
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      return response.data.pod ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get PODs for a trip */
  async getTripPods(tripId: string): Promise<TripPod[]> {
    try {
      const response = await apiClient.get(`/api/trips/${tripId}/pod`);
      return response.data.pods ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Confirm delivery (shipper) */
  async confirmDelivery(tripId: string): Promise<Trip> {
    try {
      const response = await apiClient.post(`/api/trips/${tripId}/confirm`);
      return response.data.trip ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const tripService = new TripService();

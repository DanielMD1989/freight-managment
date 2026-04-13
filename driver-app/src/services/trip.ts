/**
 * Trip Service - API calls for trips
 * Ported from Flutter's trip_service.dart (308 LOC)
 */
import apiClient, { getErrorMessage } from "../api/client";
import type { Trip, TripsResponse, TripPod } from "../types";
import { queueStatusChange } from "./status-queue";

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

  /** Update trip status — queues offline if network unavailable */
  async updateTripStatus(
    id: string,
    status: string,
    extra?: {
      receiverName?: string;
      receiverPhone?: string;
      deliveryNotes?: string;
      exceptionReason?: string;
    }
  ): Promise<Trip & { _queued?: boolean }> {
    try {
      const response = await apiClient.patch(`/api/trips/${id}`, {
        status,
        ...extra,
      });
      return response.data.trip ?? response.data;
    } catch (error) {
      if (this.isNetworkError(error)) {
        await queueStatusChange({
          tripId: id,
          status,
          extra,
          queuedAt: Date.now(),
        });
        return { id, status, _queued: true } as Trip & { _queued?: boolean };
      }
      throw new Error(getErrorMessage(error));
    }
  }

  private isNetworkError(error: unknown): boolean {
    if (error && typeof error === "object") {
      const e = error as {
        response?: unknown;
        code?: string;
        message?: string;
      };
      if (!e.response) return true;
      if (e.code === "ERR_NETWORK" || e.code === "ECONNABORTED") return true;
      if (e.message?.includes("Network Error")) return true;
    }
    return false;
  }

  /** Cancel trip */
  async cancelTrip(id: string, reason: string): Promise<Trip> {
    try {
      const response = await apiClient.post(`/api/trips/${id}/cancel`, {
        reason,
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
  async confirmDelivery(tripId: string, notes?: string): Promise<Trip> {
    try {
      const response = await apiClient.post(`/api/trips/${tripId}/confirm`, {
        ...(notes ? { notes } : {}),
      });
      return response.data.trip ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const tripService = new TripService();

/**
 * Notification Service - API calls for notifications
 * Ported from Flutter's notification_service.dart (156 LOC)
 */
import apiClient, { getErrorMessage } from "../api/client";
import type { Notification } from "../types";

class NotificationService {
  /** Get notifications */
  async getNotifications(params?: { page?: number; limit?: number }): Promise<{
    notifications: Notification[];
    unreadCount: number;
    pagination: { page: number; limit: number; total: number; pages: number };
  }> {
    try {
      const response = await apiClient.get("/api/notifications", { params });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Mark notification as read */
  async markAsRead(id: string): Promise<void> {
    try {
      await apiClient.put(`/api/notifications/${id}/read`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Mark all as read */
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.put("/api/notifications/mark-all-read");
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get notification preferences */
  async getPreferences(): Promise<Record<string, boolean>> {
    try {
      const response = await apiClient.get(
        "/api/user/notification-preferences"
      );
      return response.data.preferences ?? {};
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Update notification preferences */
  async updatePreferences(preferences: Record<string, boolean>): Promise<void> {
    try {
      await apiClient.post("/api/user/notification-preferences", {
        preferences,
      });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const notificationService = new NotificationService();

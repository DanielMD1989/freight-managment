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
      await apiClient.patch(`/api/notifications/${id}`, { read: true });
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Mark all as read */
  async markAllAsRead(): Promise<void> {
    try {
      await apiClient.post("/api/notifications/mark-all-read");
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  /** Get unread count */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await apiClient.get("/api/notifications/unread-count");
      return response.data.count ?? 0;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const notificationService = new NotificationService();

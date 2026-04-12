/**
 * Messaging Service — §13 In-App Messaging
 * Copied from mobile, with DRIVER added to senderRole union.
 */
import apiClient, { getErrorMessage } from "../api/client";

export interface Message {
  id: string;
  content: string;
  senderId: string;
  senderRole: "SHIPPER" | "CARRIER" | "DRIVER";
  attachmentUrl?: string | null;
  readAt?: string | null;
  createdAt: string;
  sender?: { firstName?: string; lastName?: string } | null;
}

export interface MessagesResponse {
  messages: Message[];
  readOnly: boolean;
  tripStatus: string;
}

class MessagingService {
  async sendMessage(
    tripId: string,
    data: { content: string; attachmentUrl?: string }
  ): Promise<Message> {
    try {
      const response = await apiClient.post(
        `/api/trips/${tripId}/messages`,
        data
      );
      return response.data.message ?? response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getMessages(
    tripId: string,
    params?: { limit?: number; before?: string }
  ): Promise<MessagesResponse> {
    try {
      const response = await apiClient.get(`/api/trips/${tripId}/messages`, {
        params,
      });
      return response.data;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async markAsRead(tripId: string, messageId: string): Promise<void> {
    try {
      await apiClient.put(`/api/trips/${tripId}/messages/${messageId}/read`);
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }

  async getUnreadCount(tripId: string): Promise<number> {
    try {
      const response = await apiClient.get(
        `/api/trips/${tripId}/messages/unread-count`
      );
      return response.data.unreadCount ?? 0;
    } catch (error) {
      throw new Error(getErrorMessage(error));
    }
  }
}

export const messagingService = new MessagingService();

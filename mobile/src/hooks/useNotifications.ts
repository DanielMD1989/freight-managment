/**
 * Notification query hooks
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { notificationService } from "../services/notification";

const NOTIFICATIONS_KEY = ["notifications"] as const;

/** Fetch notifications */
export function useNotifications(params?: { page?: number; limit?: number }) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, params],
    queryFn: () => notificationService.getNotifications(params),
    refetchInterval: 30000, // Refresh every 30s
  });
}

/** Derived unread count — reads from the already-fetched notifications query, no extra HTTP call */
export function useNotificationUnreadCount() {
  const { data } = useNotifications();
  return data?.unreadCount ?? 0;
}

/** Mark as read */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationService.markAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

/** Mark all as read */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
    },
  });
}

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

// ── Notification Preferences (§14) ──

const PREFS_KEY = ["notification-preferences"] as const;

/** Get notification preferences */
export function useNotificationPreferences() {
  return useQuery({
    queryKey: [...PREFS_KEY],
    queryFn: () => notificationService.getPreferences(),
  });
}

/** Update notification preferences */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (preferences: Record<string, boolean>) =>
      notificationService.updatePreferences(preferences),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PREFS_KEY });
    },
  });
}

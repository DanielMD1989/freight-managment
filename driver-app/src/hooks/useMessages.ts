/**
 * Messaging Hooks — §13 In-App Messaging
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { messagingService } from "../services/messaging";

const MESSAGES_KEY = ["messages"] as const;

/** Get messages for a trip (polls every 5s when chat is open) */
export function useTripMessages(
  tripId: string | undefined,
  options?: { enabled?: boolean; refetchInterval?: number }
) {
  return useQuery({
    queryKey: [...MESSAGES_KEY, "trip", tripId],
    queryFn: () => messagingService.getMessages(tripId!),
    enabled: !!tripId && options?.enabled !== false,
    refetchInterval: options?.refetchInterval ?? 5000, // 5s polling (MVP)
  });
}

/** Send a message */
export function useSendMessage() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      data,
    }: {
      tripId: string;
      data: { content: string; attachmentUrl?: string };
    }) => messagingService.sendMessage(tripId, data),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...MESSAGES_KEY, "trip", variables.tripId],
      });
    },
  });
}

/** Mark a message as read */
export function useMarkMessageRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      messageId,
    }: {
      tripId: string;
      messageId: string;
    }) => messagingService.markAsRead(tripId, messageId),
    onSuccess: (_result, variables) => {
      queryClient.invalidateQueries({
        queryKey: [...MESSAGES_KEY, "trip", variables.tripId],
      });
      queryClient.invalidateQueries({
        queryKey: [...MESSAGES_KEY, "unread", variables.tripId],
      });
    },
  });
}

/** Get unread count for a trip (polls every 30s for badge) */
export function useTripUnreadCount(
  tripId: string | undefined,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: [...MESSAGES_KEY, "unread", tripId],
    queryFn: () => messagingService.getUnreadCount(tripId!),
    enabled: !!tripId && options?.enabled !== false,
    refetchInterval: 30000, // 30s poll for badge count
  });
}

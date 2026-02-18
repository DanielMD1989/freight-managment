/**
 * Notifications Screen
 */
import React from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "../../src/hooks/useNotifications";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { EmptyState } from "../../src/components/EmptyState";
import { formatDateTime } from "../../src/utils/format";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Notification } from "../../src/types";

export default function NotificationsScreen() {
  const { data, isLoading, refetch, isRefetching } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllNotificationsRead();

  const notifications = data?.notifications ?? [];

  const renderNotification = ({ item }: { item: Notification }) => (
    <TouchableOpacity
      onPress={() => !item.read && markRead.mutate(item.id)}
      activeOpacity={0.7}
    >
      <Card style={[styles.card, !item.read ? styles.unread : undefined]}>
        <View style={styles.row}>
          <Ionicons
            name={item.read ? "notifications-outline" : "notifications"}
            size={20}
            color={item.read ? colors.slate400 : colors.primary500}
          />
          <View style={styles.content}>
            <Text style={[styles.title, !item.read && styles.titleUnread]}>
              {item.title}
            </Text>
            <Text style={styles.message} numberOfLines={2}>
              {item.message}
            </Text>
            <Text style={styles.time}>{formatDateTime(item.createdAt)}</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={notifications}
          renderItem={renderNotification}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState icon="notifications-outline" title="No notifications" />
          }
          ListHeaderComponent={
            notifications.some((n) => !n.read) ? (
              <Button
                title="Mark all read"
                onPress={() => markAllRead.mutate()}
                variant="ghost"
                size="sm"
                style={styles.markAll}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.sm },
  markAll: { alignSelf: "flex-end", marginBottom: spacing.sm },
  card: { marginBottom: spacing.sm },
  unread: { borderLeftWidth: 3, borderLeftColor: colors.primary500 },
  row: { flexDirection: "row", gap: spacing.md },
  content: { flex: 1 },
  title: { ...typography.titleSmall, color: colors.textPrimary },
  titleUnread: { fontWeight: "700" },
  message: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  time: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
});

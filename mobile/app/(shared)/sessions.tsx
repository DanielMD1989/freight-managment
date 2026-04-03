/**
 * Active Sessions Screen — §14 Mobile Security Settings
 *
 * View active sessions, revoke individual sessions, revoke all.
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import {
  useSessions,
  useRevokeSession,
  useRevokeAllSessions,
} from "../../src/hooks/useSecurity";

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getDeviceIcon(deviceInfo: string): keyof typeof Ionicons.glyphMap {
  const lower = deviceInfo.toLowerCase();
  if (lower.includes("iphone") || lower.includes("ios"))
    return "phone-portrait-outline";
  if (lower.includes("android")) return "phone-portrait-outline";
  if (lower.includes("mobile")) return "phone-portrait-outline";
  if (lower.includes("mac")) return "laptop-outline";
  if (lower.includes("windows")) return "desktop-outline";
  if (lower.includes("linux")) return "desktop-outline";
  return "globe-outline";
}

export default function SessionsScreen() {
  const { data, isLoading, refetch, isRefetching } = useSessions();
  const revokeSession = useRevokeSession();
  const revokeAll = useRevokeAllSessions();

  const sessions = data?.sessions ?? [];
  const otherSessions = sessions.filter((s) => !s.isCurrent);

  const handleRevoke = (sessionId: string, deviceInfo: string) => {
    Alert.alert(
      "Revoke Session",
      `Log out "${deviceInfo}"? This device will need to sign in again.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Revoke",
          style: "destructive",
          onPress: () => {
            revokeSession.mutate(sessionId, {
              onError: (error) => {
                Alert.alert("Error", error.message);
              },
            });
          },
        },
      ]
    );
  };

  const handleRevokeAll = () => {
    Alert.alert(
      "Log Out All Devices",
      `This will log out ${otherSessions.length} other session(s). You will stay logged in on this device.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Log Out All",
          style: "destructive",
          onPress: () => {
            revokeAll.mutate(undefined, {
              onSuccess: (result) => {
                Alert.alert(
                  "Done",
                  `${result.revokedCount} session(s) revoked.`
                );
              },
              onError: (error) => {
                Alert.alert("Error", error.message);
              },
            });
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Current Session */}
      {sessions
        .filter((s) => s.isCurrent)
        .map((session) => (
          <Card key={session.id} style={styles.card}>
            <View style={styles.currentBadge}>
              <Ionicons
                name="checkmark-circle"
                size={16}
                color={colors.success}
              />
              <Text style={styles.currentLabel}>Current Session</Text>
            </View>
            <View style={styles.sessionRow}>
              <Ionicons
                name={getDeviceIcon(session.deviceInfo)}
                size={24}
                color={colors.primary600}
              />
              <View style={styles.sessionInfo}>
                <Text style={styles.deviceText}>{session.deviceInfo}</Text>
                <Text style={styles.metaText}>
                  {session.ipAddress} · Active now
                </Text>
              </View>
            </View>
          </Card>
        ))}

      {/* Other Sessions */}
      <Card style={styles.card}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Other Sessions ({otherSessions.length})
          </Text>
          {otherSessions.length > 1 && (
            <Button
              title="Log Out All"
              onPress={handleRevokeAll}
              variant="destructive"
              size="sm"
              loading={revokeAll.isPending}
            />
          )}
        </View>

        {otherSessions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="shield-checkmark-outline"
              size={32}
              color={colors.textTertiary}
            />
            <Text style={styles.emptyText}>No other active sessions</Text>
          </View>
        ) : (
          otherSessions.map((session) => (
            <View key={session.id} style={styles.sessionItem}>
              <View style={styles.sessionRow}>
                <Ionicons
                  name={getDeviceIcon(session.deviceInfo)}
                  size={22}
                  color={colors.slate500}
                />
                <View style={styles.sessionInfo}>
                  <Text style={styles.deviceText}>{session.deviceInfo}</Text>
                  <Text style={styles.metaText}>
                    {session.ipAddress} · Last seen{" "}
                    {formatDate(session.lastSeenAt)}
                  </Text>
                </View>
                <Button
                  title="Revoke"
                  onPress={() => handleRevoke(session.id, session.deviceInfo)}
                  variant="outline"
                  size="sm"
                  disabled={revokeSession.isPending}
                />
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  card: { margin: spacing.lg, marginBottom: 0 },
  currentBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  currentLabel: {
    ...typography.labelMedium,
    color: colors.success,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  sessionInfo: { flex: 1 },
  deviceText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 2,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.textTertiary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  sessionItem: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  emptyState: {
    alignItems: "center",
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
  },
});

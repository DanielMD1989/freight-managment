/**
 * Carrier Dashboard
 * Shows stats cards, recent activity, quick actions
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useCarrierDashboard } from "../../src/hooks/useDashboard";
import { useAuthStore } from "../../src/stores/auth";
import { Card } from "../../src/components/Card";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function CarrierDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useCarrierDashboard();

  if (isLoading && !data) {
    return <LoadingSpinner fullScreen />;
  }

  const completionRate =
    data && data.completedDeliveries + data.inTransitTrips > 0
      ? data.completedDeliveries /
        (data.completedDeliveries + data.inTransitTrips)
      : 0;

  const stats = [
    {
      label: "Active Trips",
      value: data?.inTransitTrips ?? 0,
      icon: "navigate" as const,
      color: colors.primary500,
    },
    {
      label: "My Trucks",
      value: data?.totalTrucks ?? 0,
      icon: "bus" as const,
      color: colors.accent500,
    },
    {
      label: "Available",
      value: data?.activeTrucks ?? 0,
      icon: "checkmark-circle" as const,
      color: colors.success,
    },
    {
      label: "Pending",
      value: data?.pendingApprovals ?? 0,
      icon: "time" as const,
      color: colors.warning,
    },
  ];

  const quickActions = [
    {
      label: t("carrier.findLoads"),
      icon: "search-outline" as const,
      route: "/(carrier)/loadboard",
    },
    {
      label: t("carrier.postTrucks"),
      icon: "add-circle-outline" as const,
      route: "/(carrier)/post-trucks",
    },
    {
      label: t("carrier.myTrips"),
      icon: "navigate-outline" as const,
      route: "/(carrier)/trips",
    },
    {
      label: t("carrier.myTrucks"),
      icon: "bus-outline" as const,
      route: "/(carrier)/trucks",
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Welcome */}
      <View style={styles.welcome}>
        <Text style={styles.greeting}>
          Welcome back, {user?.firstName ?? "Carrier"}
        </Text>
        <Text style={styles.subtitle}>{t("carrier.dashboard")}</Text>
      </View>

      {/* Error Banner */}
      {isError && (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={20} color={colors.white} />
          <Text style={styles.errorText}>
            {error?.message ?? "Failed to load dashboard"}
          </Text>
          <TouchableOpacity onPress={() => refetch()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <Card key={stat.label} style={styles.statCard} padding="lg">
            <Ionicons name={stat.icon} size={28} color={stat.color} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </Card>
        ))}
      </View>

      {/* Quick Actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        {quickActions.map((action) => (
          <TouchableOpacity
            key={action.label}
            style={styles.actionCard}
            onPress={() => router.push(action.route as `/${string}`)}
          >
            <View style={styles.actionIcon}>
              <Ionicons
                name={action.icon}
                size={24}
                color={colors.primary600}
              />
            </View>
            <Text style={styles.actionLabel}>{action.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Completion Rate */}
      {completionRate > 0 && (
        <Card style={styles.rateCard}>
          <View style={styles.rateRow}>
            <Text style={styles.rateLabel}>Completion Rate</Text>
            <Text style={styles.rateValue}>
              {Math.round(completionRate * 100)}%
            </Text>
          </View>
          <View style={styles.rateBar}>
            <View
              style={[
                styles.rateBarFill,
                { width: `${completionRate * 100}%` },
              ]}
            />
          </View>
        </Card>
      )}

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  welcome: {
    padding: spacing["2xl"],
    paddingBottom: spacing.lg,
  },
  greeting: {
    ...typography.headlineLarge,
    color: colors.textPrimary,
  },
  subtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.error,
    marginHorizontal: spacing["2xl"],
    marginBottom: spacing.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: 8,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.white,
    flex: 1,
  },
  retryText: {
    ...typography.labelMedium,
    color: colors.white,
    textDecorationLine: "underline",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing["2xl"],
  },
  statCard: {
    width: "47%",
    alignItems: "center",
  },
  statValue: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginTop: spacing.sm,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
    marginBottom: spacing.md,
  },
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    paddingHorizontal: spacing["2xl"],
  },
  actionCard: {
    width: "47%",
    alignItems: "center",
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.primary50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  actionLabel: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    textAlign: "center",
  },
  rateCard: {
    marginHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
    padding: spacing.lg,
  },
  rateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  rateLabel: {
    ...typography.titleSmall,
    color: colors.textSecondary,
  },
  rateValue: {
    ...typography.titleMedium,
    color: colors.success,
  },
  rateBar: {
    height: 8,
    backgroundColor: colors.slate100,
    borderRadius: 4,
  },
  rateBarFill: {
    height: 8,
    backgroundColor: colors.success,
    borderRadius: 4,
  },
});

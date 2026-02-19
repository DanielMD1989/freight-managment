/**
 * Shipper Dashboard - Enhanced with spending stats and loads-by-status
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
import { useShipperDashboard } from "../../src/hooks/useDashboard";
import { useLoads } from "../../src/hooks/useLoads";
import { useAuthStore } from "../../src/stores/auth";
import { Card } from "../../src/components/Card";
import { StatusBadge } from "../../src/components/StatusBadge";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { formatDate } from "../../src/utils/format";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Load } from "../../src/types";

export default function ShipperDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useShipperDashboard();
  const { data: recentLoadsData } = useLoads({ limit: 4, myLoads: true });

  if (isLoading && !data) return <LoadingSpinner fullScreen />;

  const recentLoads = recentLoadsData?.loads ?? [];

  const stats = [
    {
      label: "Active Loads",
      value: data?.stats?.activeLoads ?? 0,
      icon: "cube" as const,
      color: colors.primary500,
    },
    {
      label: "In Transit",
      value: data?.stats?.inTransitLoads ?? 0,
      icon: "navigate" as const,
      color: colors.accent500,
    },
    {
      label: "Total Loads",
      value: data?.stats?.totalLoads ?? 0,
      icon: "layers" as const,
      color: colors.info,
    },
    {
      label: "Delivered",
      value: data?.stats?.deliveredLoads ?? 0,
      icon: "checkmark-circle" as const,
      color: colors.success,
    },
    {
      label: "Pending",
      value: data?.stats?.pendingPayments
        ? `${data.stats.pendingPayments.toLocaleString()} ETB`
        : "0 ETB",
      icon: "time-outline" as const,
      color: colors.warning,
    },
    {
      label: "Total Spent",
      value: data?.stats?.totalSpent
        ? `${data.stats.totalSpent.toLocaleString()} ETB`
        : "0 ETB",
      icon: "cash-outline" as const,
      color: colors.error,
    },
  ];

  const quickActions = [
    {
      label: t("shipper.postLoad"),
      icon: "add-circle-outline" as const,
      route: "/(shipper)/loads/create",
    },
    {
      label: t("shipper.findTrucks"),
      icon: "search-outline" as const,
      route: "/(shipper)/trucks",
    },
    {
      label: t("shipper.shipments"),
      icon: "navigate-outline" as const,
      route: "/(shipper)/trips",
    },
    {
      label: t("shipper.myLoads"),
      icon: "cube-outline" as const,
      route: "/(shipper)/loads",
    },
  ];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <View style={styles.welcome}>
        <Text style={styles.greeting}>
          Welcome back, {user?.firstName ?? "Shipper"}
        </Text>
        <Text style={styles.subtitle}>{t("shipper.dashboard")}</Text>
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

      <View style={styles.statsGrid}>
        {stats.map((stat) => (
          <Card key={stat.label} style={styles.statCard} padding="lg">
            <Ionicons name={stat.icon} size={28} color={stat.color} />
            <Text style={styles.statValue}>{stat.value}</Text>
            <Text style={styles.statLabel}>{stat.label}</Text>
          </Card>
        ))}
      </View>

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

      {/* Loads by status breakdown */}
      {data?.loadsByStatus && data.loadsByStatus.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>Loads by Status</Text>
          <Card style={styles.statusBreakdown} padding="lg">
            {data.loadsByStatus.map((item) => (
              <View key={item.status} style={styles.statusRow}>
                <StatusBadge status={item.status} type="load" />
                <View style={styles.statusBar}>
                  <View
                    style={[
                      styles.statusBarFill,
                      {
                        width: `${Math.min(
                          100,
                          ((item.count ?? 0) /
                            Math.max(data.stats?.totalLoads ?? 1, 1)) *
                            100
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.statusCount}>{item.count ?? 0}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      {/* Recent loads */}
      {recentLoads.length > 0 && (
        <>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Recent Loads</Text>
            <TouchableOpacity
              onPress={() => router.push("/(shipper)/loads" as `/${string}`)}
            >
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>
          {recentLoads.slice(0, 4).map((load: Load) => (
            <TouchableOpacity
              key={load.id}
              onPress={() =>
                router.push(`/(shipper)/loads/${load.id}` as `/${string}`)
              }
              style={styles.recentLoadWrapper}
            >
              <Card style={styles.recentLoadCard}>
                <View style={styles.recentLoadHeader}>
                  <Text style={styles.recentLoadRoute}>
                    {load.pickupCity} → {load.deliveryCity}
                  </Text>
                  <StatusBadge status={load.status} type="load" />
                </View>
                <Text style={styles.recentLoadDate}>
                  {formatDate(load.pickupDate)}
                </Text>
              </Card>
            </TouchableOpacity>
          ))}
        </>
      )}

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  welcome: { padding: spacing["2xl"], paddingBottom: spacing.lg },
  greeting: { ...typography.headlineLarge, color: colors.textPrimary },
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
  statCard: { width: "47%", alignItems: "center" },
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
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
    marginBottom: spacing.md,
  },
  viewAll: {
    ...typography.labelMedium,
    color: colors.primary600,
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
  statusBreakdown: {
    marginHorizontal: spacing["2xl"],
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  statusBar: {
    flex: 1,
    height: 6,
    backgroundColor: colors.slate100,
    borderRadius: 3,
  },
  statusBarFill: {
    height: 6,
    backgroundColor: colors.primary400,
    borderRadius: 3,
  },
  statusCount: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    minWidth: 24,
    textAlign: "right",
  },
  recentLoadWrapper: {
    paddingHorizontal: spacing["2xl"],
    marginBottom: spacing.sm,
  },
  recentLoadCard: {},
  recentLoadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  recentLoadRoute: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    flex: 1,
  },
  recentLoadDate: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});

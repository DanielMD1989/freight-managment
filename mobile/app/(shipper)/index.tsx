/**
 * Shipper Dashboard
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
import { useDashboard } from "../../src/hooks/useDashboard";
import { useAuthStore } from "../../src/stores/auth";
import { Card } from "../../src/components/Card";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function ShipperDashboard() {
  const router = useRouter();
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const { data, isLoading, refetch, isRefetching } = useDashboard();

  if (isLoading && !data) return <LoadingSpinner fullScreen />;

  const stats = [
    {
      label: "Active Loads",
      value: data?.activeLoads ?? 0,
      icon: "cube" as const,
      color: colors.primary500,
    },
    {
      label: "Active Trips",
      value: data?.activeTrips ?? 0,
      icon: "navigate" as const,
      color: colors.accent500,
    },
    {
      label: "Total Loads",
      value: data?.totalLoads ?? 0,
      icon: "layers" as const,
      color: colors.info,
    },
    {
      label: "Pending",
      value: data?.pendingRequests ?? 0,
      icon: "time" as const,
      color: colors.warning,
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
});

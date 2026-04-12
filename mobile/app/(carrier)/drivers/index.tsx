/**
 * Driver List Screen — Task 22
 * Lists carrier's drivers with status filter tabs.
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Card, StatusBadge, Button, EmptyState } from "../../../src/components";
import { colors, spacing, typography } from "../../../src/theme";
import {
  useDrivers,
  useApproveDriver,
  useRejectDriver,
  useSuspendDriver,
} from "../../../src/hooks";

type FilterTab = "ALL" | "ACTIVE" | "PENDING_VERIFICATION" | "SUSPENDED";
const TABS: FilterTab[] = [
  "ALL",
  "ACTIVE",
  "PENDING_VERIFICATION",
  "SUSPENDED",
];

const TAB_LABELS: Record<FilterTab, string> = {
  ALL: "All",
  ACTIVE: "Active",
  PENDING_VERIFICATION: "Pending",
  SUSPENDED: "Suspended",
};

type Driver = NonNullable<
  ReturnType<typeof useDrivers>["data"]
>["drivers"][number];

export default function DriversListScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>("ALL");
  const { data, isLoading, refetch } = useDrivers({ limit: 200 });
  const approveDriver = useApproveDriver();
  const rejectDriver = useRejectDriver();
  const suspendDriver = useSuspendDriver();

  const allDrivers = data?.drivers ?? [];

  const filtered = useMemo(() => {
    if (activeTab === "ALL") return allDrivers;
    return allDrivers.filter((d) => d.status === activeTab);
  }, [allDrivers, activeTab]);

  const tabCounts = useMemo(() => {
    const counts: Record<FilterTab, number> = {
      ALL: allDrivers.length,
      ACTIVE: 0,
      PENDING_VERIFICATION: 0,
      SUSPENDED: 0,
    };
    for (const d of allDrivers) {
      if (d.status in counts) counts[d.status as FilterTab]++;
    }
    return counts;
  }, [allDrivers]);

  const handleApprove = (id: string) => {
    Alert.alert("Approve Driver", "Approve this driver?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: () => approveDriver.mutateAsync(id).catch(() => {}),
      },
    ]);
  };

  const handleReject = (id: string) => {
    Alert.prompt(
      "Reject Driver",
      "Enter rejection reason:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: (reason: string | undefined) => {
            if (reason?.trim()) {
              rejectDriver
                .mutateAsync({ driverId: id, reason: reason.trim() })
                .catch(() => {});
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const handleSuspend = (id: string) => {
    Alert.alert("Suspend Driver", "This will revoke their access.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Suspend",
        style: "destructive",
        onPress: () => suspendDriver.mutateAsync(id).catch(() => {}),
      },
    ]);
  };

  const driverName = (d: Driver) =>
    [d.firstName, d.lastName].filter(Boolean).join(" ") || "(no name)";

  const renderDriver = ({ item }: { item: Driver }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(carrier)/drivers/${item.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.name}>{driverName(item)}</Text>
          <StatusBadge status={item.status} />
        </View>
        <Text style={styles.metaText}>{item.phone ?? "-"}</Text>
        {item.driverProfile && (
          <Text style={styles.metaText}>
            {item.driverProfile.isAvailable ? "Available" : "Unavailable"} |
            Active trips: {item.activeTrips}
          </Text>
        )}
        {item.status === "PENDING_VERIFICATION" && (
          <View style={styles.actionRow}>
            <Button
              title="Approve"
              onPress={() => handleApprove(item.id)}
              variant="primary"
              size="sm"
            />
            <Button
              title="Reject"
              onPress={() => handleReject(item.id)}
              variant="destructive"
              size="sm"
            />
          </View>
        )}
        {item.status === "ACTIVE" && (
          <View style={styles.actionRow}>
            <Button
              title="Suspend"
              onPress={() => handleSuspend(item.id)}
              variant="outline"
              size="sm"
            />
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Invite button */}
      <View style={styles.headerRow}>
        <Text style={styles.totalText}>{data?.total ?? 0} drivers</Text>
        <Button
          title="Invite Driver"
          onPress={() => router.push("/(carrier)/drivers/invite")}
          variant="primary"
          size="sm"
        />
      </View>

      {/* Filter tabs */}
      <FlatList
        horizontal
        data={TABS}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.tab, activeTab === item && styles.tabActive]}
            onPress={() => setActiveTab(item)}
          >
            <Text
              style={[
                styles.tabText,
                activeTab === item && styles.tabTextActive,
              ]}
            >
              {TAB_LABELS[item]} ({tabCounts[item]})
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={styles.tabBar}
      />

      {/* Driver list */}
      <FlatList
        data={filtered}
        renderItem={renderDriver}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} />
        }
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <EmptyState
            icon="people-outline"
            title="No Drivers"
            message="Invite your first driver to get started."
            actionLabel="Invite Driver"
            onAction={() => router.push("/(carrier)/drivers/invite")}
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  totalText: { ...typography.titleSmall, color: colors.textSecondary },
  tabBar: { paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    marginRight: spacing.sm,
  },
  tabActive: { backgroundColor: colors.primary600 },
  tabText: { ...typography.labelMedium, color: colors.textSecondary },
  tabTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"] },
  emptyContainer: { flex: 1 },
  card: { marginBottom: spacing.md },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  name: { ...typography.titleMedium, color: colors.textPrimary },
  metaText: { ...typography.bodySmall, color: colors.textSecondary },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});

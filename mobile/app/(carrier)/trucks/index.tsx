/**
 * My Trucks list screen (Carrier)
 * G-M10-4: Approval status tabs (Approved / Pending / Rejected)
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useTrucks } from "../../../src/hooks/useTrucks";
import { useOrganization } from "../../../src/hooks/useOrganization";
import { useAuthStore } from "../../../src/stores/auth";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { Button } from "../../../src/components/Button";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { formatTruckType, formatWeight } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { Truck } from "../../../src/types";

type ApprovalTab = "APPROVED" | "PENDING" | "REJECTED";

const TABS: { key: ApprovalTab; label: string }[] = [
  { key: "APPROVED", label: "Approved" },
  { key: "PENDING", label: "Pending" },
  { key: "REJECTED", label: "Rejected" },
];

export default function TrucksListScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string }>();
  const [activeTab, setActiveTab] = useState<ApprovalTab>("APPROVED");
  useEffect(() => {
    if (
      params.tab &&
      (params.tab === "APPROVED" ||
        params.tab === "PENDING" ||
        params.tab === "REJECTED") &&
      params.tab !== activeTab
    ) {
      setActiveTab(params.tab as ApprovalTab);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.tab]);
  // Sprint: data-consistency audit — fetch all owned trucks (default
  // limit=20 was hiding APPROVED trucks behind status-coverage fixtures
  // when the carrier had >20 trucks total)
  const { data, isLoading, refetch, isRefetching } = useTrucks({ limit: 200 });
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const { data: org } = useOrganization(organizationId);
  const isOrgApproved =
    (org as unknown as { verificationStatus?: string })?.verificationStatus ===
    "APPROVED";

  const allTrucks = data?.trucks ?? [];

  // Client-side filter by approval status tab
  const trucks = useMemo(
    () => allTrucks.filter((t) => t.approvalStatus === activeTab),
    [allTrucks, activeTab]
  );

  // Count per tab for badge display
  const counts = useMemo(() => {
    const c = { APPROVED: 0, PENDING: 0, REJECTED: 0 };
    for (const t of allTrucks) {
      if (t.approvalStatus in c) c[t.approvalStatus as ApprovalTab]++;
    }
    return c;
  }, [allTrucks]);

  const emptyMessages: Record<ApprovalTab, string> = {
    APPROVED: isOrgApproved
      ? "No approved trucks yet. Add a truck and wait for admin approval."
      : "Your organization must be approved before you can add trucks",
    PENDING: "No trucks pending review",
    REJECTED: "No rejected trucks",
  };

  const renderTruck = ({ item }: { item: Truck }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(carrier)/trucks/${item.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.truckCard}>
        <View style={styles.truckHeader}>
          <View style={styles.truckInfo}>
            <Text style={styles.licensePlate}>{item.licensePlate}</Text>
            <Text style={styles.truckType}>
              {formatTruckType(item.truckType)}
            </Text>
          </View>
          <StatusBadge
            status={
              item.approvalStatus === "APPROVED"
                ? item.isAvailable
                  ? "ACTIVE"
                  : "IN_TRANSIT"
                : item.approvalStatus
            }
          />
        </View>
        {item.approvalStatus === "REJECTED" && item.rejectionReason && (
          <Text style={styles.rejectionReason} numberOfLines={2}>
            {item.rejectionReason}
          </Text>
        )}
        <View style={styles.truckDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="scale-outline" size={14} color={colors.slate400} />
            <Text style={styles.detailText}>{formatWeight(item.capacity)}</Text>
          </View>
          {item.currentCity && (
            <View style={styles.detailItem}>
              <Ionicons
                name="location-outline"
                size={14}
                color={colors.slate400}
              />
              <Text style={styles.detailText}>{item.currentCity}</Text>
            </View>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Hidden per-status counts for stable test reads */}
      <Text
        testID="trucks-tab-count-approved"
        style={{ position: "absolute", left: -9999, opacity: 0 }}
      >
        {counts.APPROVED}
      </Text>
      <Text
        testID="trucks-tab-count-pending"
        style={{ position: "absolute", left: -9999, opacity: 0 }}
      >
        {counts.PENDING}
      </Text>
      <Text
        testID="trucks-tab-count-rejected"
        style={{ position: "absolute", left: -9999, opacity: 0 }}
      >
        {counts.REJECTED}
      </Text>
      {/* G-M10-4: Approval status tabs */}
      <View style={styles.tabBar}>
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const count = counts[tab.key];
          return (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, isActive && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
              </Text>
              {count > 0 && (
                <View
                  style={[
                    styles.tabBadge,
                    isActive && styles.tabBadgeActive,
                    tab.key === "REJECTED" &&
                      count > 0 &&
                      styles.tabBadgeRejected,
                  ]}
                >
                  <Text
                    style={[
                      styles.tabBadgeText,
                      isActive && styles.tabBadgeTextActive,
                      tab.key === "REJECTED" &&
                        count > 0 &&
                        styles.tabBadgeTextRejected,
                    ]}
                  >
                    {count}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading && !data ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={trucks}
          renderItem={renderTruck}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bus-outline"
              title={
                activeTab === "APPROVED"
                  ? "No trucks yet"
                  : `No ${activeTab.toLowerCase()} trucks`
              }
              message={emptyMessages[activeTab]}
              actionLabel={
                activeTab === "APPROVED" && isOrgApproved
                  ? "Add Truck"
                  : undefined
              }
              onAction={
                activeTab === "APPROVED" && isOrgApproved
                  ? () => router.push("/(carrier)/trucks/add")
                  : undefined
              }
            />
          }
          ListHeaderComponent={
            allTrucks.length > 0 && isOrgApproved ? (
              <Button
                title="Add Truck"
                onPress={() => router.push("/(carrier)/trucks/add")}
                variant="primary"
                size="md"
                icon={<Ionicons name="add" size={20} color={colors.white} />}
                style={styles.addButton}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
    paddingHorizontal: spacing.md,
  },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary600,
  },
  tabText: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary600,
  },
  tabBadge: {
    backgroundColor: colors.slate100,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  tabBadgeActive: {
    backgroundColor: colors.primary100,
  },
  tabBadgeRejected: {
    backgroundColor: colors.errorLight,
  },
  tabBadgeText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  tabBadgeTextActive: {
    color: colors.primary600,
  },
  tabBadgeTextRejected: {
    color: colors.error,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  addButton: {
    marginBottom: spacing.md,
    alignSelf: "flex-end",
  },
  truckCard: {
    marginBottom: spacing.md,
  },
  truckHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  truckInfo: {
    flex: 1,
  },
  licensePlate: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  truckType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  rejectionReason: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  truckDetails: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  detailItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});

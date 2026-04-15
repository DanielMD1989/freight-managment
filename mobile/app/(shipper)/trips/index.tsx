/**
 * Shipper Trips / Shipments List
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { useTrips } from "../../../src/hooks/useTrips";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { Trip } from "../../../src/types";

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "PICKUP_PENDING", label: "Pickup Pending" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "EXCEPTION", label: "Exception" },
];

export default function ShipperTripsScreen() {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState("");
  // Fetch all trips for counts
  const { data: allData } = useTrips({ limit: 500 });
  const { data, isLoading, refetch, isRefetching } = useTrips(
    activeStatus ? { status: activeStatus } : undefined
  );
  const trips = data?.trips ?? [];
  const allTrips = allData?.trips ?? [];
  const totalCount = allData?.pagination?.total ?? allTrips.length;

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const trip of allTrips) {
      counts[trip.status] = (counts[trip.status] || 0) + 1;
    }
    return counts;
  }, [allTrips]);

  const renderTrip = ({ item }: { item: Trip }) => {
    const driverName = item.driver
      ? [item.driver.firstName, item.driver.lastName].filter(Boolean).join(" ")
      : "";
    return (
      <TouchableOpacity
        onPress={() => router.push(`/(shipper)/trips/${item.id}`)}
        activeOpacity={0.7}
      >
        <Card style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.route}>
              {item.pickupCity} → {item.deliveryCity}
            </Text>
            <StatusBadge status={item.status} type="trip" />
          </View>
          <Text style={styles.meta}>Driver: {driverName || "Unassigned"}</Text>
          <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Total count header */}
      <View style={styles.totalHeader}>
        <Text style={styles.totalText}>Total: {totalCount} trips</Text>
      </View>

      {/* Status filter chips */}
      <View style={styles.filters}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipScroll}
        >
          {STATUS_FILTERS.map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.chip, activeStatus === f.key && styles.chipActive]}
              onPress={() => setActiveStatus(f.key)}
            >
              <Text
                style={[
                  styles.chipText,
                  activeStatus === f.key && styles.chipTextActive,
                ]}
              >
                {f.label}
              </Text>
              {(f.key === ""
                ? totalCount > 0
                : (statusCounts[f.key] ?? 0) > 0) && (
                <View
                  style={[
                    styles.chipBadge,
                    activeStatus === f.key && styles.chipBadgeActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.chipBadgeText,
                      activeStatus === f.key && styles.chipBadgeTextActive,
                    ]}
                  >
                    {f.key === "" ? totalCount : statusCounts[f.key]}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTrip}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="navigate-outline"
              title="No shipments"
              message="Your shipments will appear here"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  totalHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
    backgroundColor: colors.white,
  },
  totalText: { ...typography.labelMedium, color: colors.textSecondary },
  filters: {
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chipScroll: { paddingHorizontal: spacing.md, gap: spacing.sm },
  chip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.slate100,
  },
  chipActive: { backgroundColor: colors.primary500 },
  chipText: { ...typography.labelSmall, color: colors.textSecondary },
  chipTextActive: { color: colors.white, fontWeight: "600" as const },
  chipBadge: {
    backgroundColor: colors.slate200,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginLeft: 4,
  },
  chipBadgeActive: { backgroundColor: "rgba(255,255,255,0.25)" },
  chipBadgeText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    fontSize: 11,
  },
  chipBadgeTextActive: { color: colors.white },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: spacing.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  route: { ...typography.titleSmall, color: colors.textPrimary, flex: 1 },
  meta: { ...typography.bodySmall, color: colors.textTertiary },
});

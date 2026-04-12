/**
 * Carrier Trips List Screen
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

const statusFilters = [
  "ALL",
  "ASSIGNED",
  "PICKUP_PENDING",
  "IN_TRANSIT",
  "EXCEPTION",
  "DELIVERED",
  "COMPLETED",
  "CANCELLED",
];

export default function CarrierTripsScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("ALL");
  // Fetch all trips for total count and per-status badge counts
  const { data: allData } = useTrips({ limit: 500 });
  const { data, isLoading, refetch, isRefetching } = useTrips(
    statusFilter === "ALL" ? undefined : { status: statusFilter }
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

  const renderTrip = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(carrier)/trips/${item.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <Text style={styles.route}>
            {item.pickupCity ?? "N/A"} → {item.deliveryCity ?? "N/A"}
          </Text>
          <StatusBadge status={item.status} type="trip" />
        </View>
        <View style={styles.tripMeta}>
          {item.startedAt && (
            <Text style={styles.metaText}>
              Started: {formatDate(item.startedAt)}
            </Text>
          )}
          {item.estimatedDistanceKm && (
            <Text style={styles.metaText}>{item.estimatedDistanceKm} km</Text>
          )}
          <Text style={styles.metaText}>
            Driver:{" "}
            {item.driver
              ? [item.driver.firstName, item.driver.lastName]
                  .filter(Boolean)
                  .join(" ")
              : "No driver"}
          </Text>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Total count header */}
      <View style={styles.totalHeader}>
        <Text style={styles.totalText}>Total: {totalCount} trips</Text>
      </View>

      {/* Status filter chips */}
      <View style={styles.filters}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={statusFilters}
          keyExtractor={(item) => item}
          renderItem={({ item }) => {
            const count =
              item === "ALL" ? totalCount : (statusCounts[item] ?? 0);
            return (
              <TouchableOpacity
                style={[
                  styles.chip,
                  statusFilter === item && styles.chipActive,
                ]}
                onPress={() => setStatusFilter(item)}
              >
                <Text
                  style={[
                    styles.chipText,
                    statusFilter === item && styles.chipTextActive,
                  ]}
                >
                  {item === "ALL" ? "All" : item.replace(/_/g, " ")}
                </Text>
                {count > 0 && (
                  <View
                    style={[
                      styles.chipBadge,
                      statusFilter === item && styles.chipBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.chipBadgeText,
                        statusFilter === item && styles.chipBadgeTextActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            gap: spacing.sm,
          }}
        />
      </View>

      {isLoading && !data ? (
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
              title="No trips"
              message="Your trips will appear here"
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
    paddingVertical: spacing.md,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  chip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.slate100,
  },
  chipActive: { backgroundColor: colors.primary600 },
  chipText: { ...typography.labelSmall, color: colors.slate600 },
  chipTextActive: { color: colors.white },
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
    color: colors.slate600,
    fontSize: 11,
  },
  chipBadgeTextActive: { color: colors.white },
  list: { padding: spacing.lg, gap: spacing.md },
  tripCard: { marginBottom: spacing.md },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  route: { ...typography.titleSmall, color: colors.textPrimary, flex: 1 },
  tripMeta: { flexDirection: "row", gap: spacing.lg },
  metaText: { ...typography.bodySmall, color: colors.textSecondary },
});

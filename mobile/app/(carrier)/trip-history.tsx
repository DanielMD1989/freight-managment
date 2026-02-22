/**
 * Trip History Screen - Completed trips for carrier
 */
import React, { useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTrips } from "../../src/hooks/useTrips";
import { Card } from "../../src/components/Card";
import { StatusBadge } from "../../src/components/StatusBadge";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { EmptyState } from "../../src/components/EmptyState";
import { formatDate, formatDistance } from "../../src/utils/format";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Trip } from "../../src/types";

export default function TripHistoryScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useTrips({
    status: "DELIVERED",
  });

  const trips = useMemo(() => data?.trips ?? [], [data?.trips]);

  const stats = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonth = trips.filter((trip: Trip) => {
      const deliveredDate = trip.deliveredAt
        ? new Date(trip.deliveredAt)
        : trip.updatedAt
          ? new Date(trip.updatedAt)
          : null;
      return deliveredDate && deliveredDate >= thisMonthStart;
    });

    return {
      total: trips.length,
      thisMonth: thisMonth.length,
    };
  }, [trips]);

  const renderTrip = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(carrier)/trips/${item.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <Text style={styles.route} numberOfLines={1}>
            {item.pickupCity ?? "N/A"} → {item.deliveryCity ?? "N/A"}
          </Text>
          <StatusBadge status={item.status} type="trip" />
        </View>

        <View style={styles.tripMeta}>
          {item.startedAt && (
            <View style={styles.metaItem}>
              <Ionicons
                name="calendar-outline"
                size={14}
                color={colors.slate400}
              />
              <Text style={styles.metaText}>{formatDate(item.startedAt)}</Text>
            </View>
          )}
          {item.deliveredAt && (
            <View style={styles.metaItem}>
              <Ionicons
                name="checkmark-circle-outline"
                size={14}
                color={colors.success}
              />
              <Text style={styles.metaText}>
                {formatDate(item.deliveredAt)}
              </Text>
            </View>
          )}
          {item.estimatedDistanceKm && (
            <View style={styles.metaItem}>
              <Ionicons
                name="speedometer-outline"
                size={14}
                color={colors.slate400}
              />
              <Text style={styles.metaText}>
                {formatDistance(item.estimatedDistanceKm)}
              </Text>
            </View>
          )}
        </View>

        {item.truck && (
          <View style={styles.truckInfo}>
            <Ionicons name="bus-outline" size={14} color={colors.slate400} />
            <Text style={styles.truckText}>
              {item.truck.licensePlate ?? "N/A"}
            </Text>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Summary stats */}
      <View style={styles.statsRow}>
        <Card style={styles.statCard} padding="lg">
          <View style={styles.statContent}>
            <Ionicons name="checkmark-done" size={24} color={colors.success} />
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Completed</Text>
          </View>
        </Card>
        <Card style={styles.statCard} padding="lg">
          <View style={styles.statContent}>
            <Ionicons name="calendar" size={24} color={colors.primary500} />
            <Text style={styles.statValue}>{stats.thisMonth}</Text>
            <Text style={styles.statLabel}>This Month</Text>
          </View>
        </Card>
      </View>

      {/* Trip list */}
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
              icon="trophy-outline"
              title="No Completed Trips"
              message="Your delivered trips will appear here"
            />
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
  statsRow: {
    flexDirection: "row",
    gap: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statCard: {
    flex: 1,
  },
  statContent: {
    alignItems: "center",
  },
  statValue: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  statLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  tripCard: {
    marginBottom: spacing.md,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  route: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  tripMeta: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  truckInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  truckText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
});

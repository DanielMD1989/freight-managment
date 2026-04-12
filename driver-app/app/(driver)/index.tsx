/**
 * My Trips — Driver's trip list with availability toggle
 */
import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  StyleSheet,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Card, StatusBadge, EmptyState } from "../../src/components";
import { colors, spacing, typography } from "../../src/theme";
import { useTrips } from "../../src/hooks/useTrips";
import { useMyProfile, useToggleAvailability } from "../../src/hooks/useDriver";
import { useAuthStore } from "../../src/stores/auth";
import { formatDate } from "../../src/utils/format";
import type { Trip } from "../../src/types";

const STATUSES = [
  "ALL",
  "ASSIGNED",
  "PICKUP_PENDING",
  "IN_TRANSIT",
  "DELIVERED",
  "COMPLETED",
] as const;

const STATUS_LABELS: Record<string, string> = {
  ALL: "All",
  ASSIGNED: "Assigned",
  PICKUP_PENDING: "Pickup",
  IN_TRANSIT: "Transit",
  DELIVERED: "Delivered",
  COMPLETED: "Done",
};

export default function DriverTripsScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeFilter, setActiveFilter] = useState("ALL");

  const {
    data: allData,
    isLoading: allLoading,
    refetch: refetchAll,
  } = useTrips({ limit: 200 }, { refetchInterval: 30_000 });
  const { data: profileData, refetch: refetchProfile } = useMyProfile();
  const toggleAvailability = useToggleAvailability();

  const allTrips = (allData?.trips ?? []) as Trip[];

  const filtered = useMemo(() => {
    if (activeFilter === "ALL") return allTrips;
    return allTrips.filter((t) => t.status === activeFilter);
  }, [allTrips, activeFilter]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: allTrips.length };
    for (const t of allTrips) {
      counts[t.status] = (counts[t.status] ?? 0) + 1;
    }
    return counts;
  }, [allTrips]);

  const isAvailable = profileData?.driverProfile?.isAvailable ?? true;

  const handleToggle = async () => {
    if (!user?.id) return;
    try {
      await toggleAvailability.mutateAsync({
        driverId: user.id,
        isAvailable: !isAvailable,
      });
      refetchProfile();
    } catch {
      // Best effort
    }
  };

  const renderTrip = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(driver)/trips/${item.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <Text style={styles.route}>
            {item.pickupCity ?? "N/A"} &rarr; {item.deliveryCity ?? "N/A"}
          </Text>
          <StatusBadge status={item.status} type="trip" />
        </View>
        <View style={styles.tripMeta}>
          {item.truck && (
            <Text style={styles.metaText}>
              Truck:{" "}
              {(item.truck as { licensePlate?: string })?.licensePlate ?? "-"}
            </Text>
          )}
          {item.startedAt && (
            <Text style={styles.metaText}>
              Started: {formatDate(item.startedAt)}
            </Text>
          )}
          {item.estimatedDistanceKm && (
            <Text style={styles.metaText}>
              {Number(item.estimatedDistanceKm)} km
            </Text>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Availability toggle */}
      <TouchableOpacity
        style={[
          styles.availabilityBar,
          isAvailable ? styles.availableBar : styles.unavailableBar,
        ]}
        onPress={handleToggle}
        disabled={toggleAvailability.isPending}
        activeOpacity={0.8}
      >
        <Ionicons
          name={isAvailable ? "radio-button-on" : "radio-button-off"}
          size={20}
          color={isAvailable ? colors.successDark : colors.errorDark}
        />
        <Text
          style={[
            styles.availabilityText,
            { color: isAvailable ? colors.successDark : colors.errorDark },
          ]}
        >
          {isAvailable ? "Available for trips" : "Unavailable"}
        </Text>
        <Text style={styles.availabilityHint}>Tap to toggle</Text>
      </TouchableOpacity>

      {/* Status filter chips */}
      <FlatList
        horizontal
        data={STATUSES as unknown as string[]}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, activeFilter === item && styles.chipActive]}
            onPress={() => setActiveFilter(item)}
          >
            <Text
              style={[
                styles.chipText,
                activeFilter === item && styles.chipTextActive,
              ]}
            >
              {STATUS_LABELS[item] ?? item} ({statusCounts[item] ?? 0})
            </Text>
          </TouchableOpacity>
        )}
        keyExtractor={(item) => item}
        showsHorizontalScrollIndicator={false}
        style={styles.chipBar}
      />

      {/* Trip list */}
      <FlatList
        data={filtered}
        renderItem={renderTrip}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl
            refreshing={allLoading}
            onRefresh={() => {
              refetchAll();
              refetchProfile();
            }}
          />
        }
        contentContainerStyle={
          filtered.length === 0 ? styles.emptyContainer : styles.list
        }
        ListEmptyComponent={
          <EmptyState
            icon="navigate-outline"
            title="No Trips"
            message="You have no assigned trips yet. Your carrier will assign you when a trip is ready."
          />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  availabilityBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  availableBar: { backgroundColor: colors.successLight },
  unavailableBar: { backgroundColor: colors.errorLight },
  availabilityText: { ...typography.labelLarge, flex: 1 },
  availabilityHint: { ...typography.bodySmall, color: colors.textTertiary },
  chipBar: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary600 },
  chipText: { ...typography.labelMedium, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing["3xl"] },
  emptyContainer: { flex: 1 },
  tripCard: { marginBottom: spacing.md },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  route: { ...typography.titleMedium, color: colors.textPrimary, flex: 1 },
  tripMeta: { gap: 2 },
  metaText: { ...typography.bodySmall, color: colors.textSecondary },
});

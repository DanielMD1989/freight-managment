/**
 * Shipper Map Screen - Shipment Tracking
 * Shows active shipments with progress tracking
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTrips } from "../../src/hooks/useTrips";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { Button } from "../../src/components/Button";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { EmptyState } from "../../src/components/EmptyState";
import { StatusBadge } from "../../src/components/StatusBadge";
import { formatDate, formatDistance } from "../../src/utils/format";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Trip } from "../../src/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function ShipperMapScreen() {
  const { t } = useTranslation();
  const {
    data: tripsData,
    isLoading,
    refetch,
    isRefetching,
  } = useTrips({
    status: "IN_TRANSIT",
  });
  const [selectedTripId, setSelectedTripId] = useState<string | null>(null);

  const trips = tripsData?.trips ?? [];
  const effectiveSelectedId = selectedTripId ?? trips[0]?.id ?? null;
  const selectedTrip = trips.find(
    (trip: Trip) => trip.id === effectiveSelectedId
  );

  if (isLoading) return <LoadingSpinner fullScreen />;

  if (trips.length === 0) {
    return (
      <EmptyState
        icon="navigate-outline"
        title="No active shipments"
        message="Your in-transit shipments will appear here for tracking"
      />
    );
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Map placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons
            name="navigate-outline"
            size={48}
            color={colors.primary300}
          />
          <Text style={styles.mapPlaceholderText}>Shipment Tracking Map</Text>
          <Text style={styles.mapSubtext}>
            Google Maps integration required
          </Text>
        </View>
      </View>

      {/* Trip selector chips */}
      {trips.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipContainer}
        >
          {trips.map((trip: Trip) => (
            <Button
              key={trip.id}
              title={`${trip.pickupCity ?? "N/A"} → ${trip.deliveryCity ?? "N/A"}`}
              onPress={() => setSelectedTripId(trip.id)}
              variant={trip.id === effectiveSelectedId ? "primary" : "outline"}
              size="sm"
            />
          ))}
        </ScrollView>
      )}

      {selectedTrip && (
        <>
          {/* Trip info card */}
          <Card style={styles.card}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardTitle}>Shipment Info</Text>
              <StatusBadge status={selectedTrip.status} type="trip" size="sm" />
            </View>

            <View style={styles.routeDisplay}>
              <View style={styles.routeEndpoint}>
                <Ionicons
                  name="radio-button-on"
                  size={14}
                  color={colors.success}
                />
                <Text style={styles.routeText}>
                  {selectedTrip.pickupCity ?? "N/A"}
                </Text>
              </View>
              <View style={styles.routeLine} />
              <View style={styles.routeEndpoint}>
                <Ionicons name="location" size={14} color={colors.error} />
                <Text style={styles.routeText}>
                  {selectedTrip.deliveryCity ?? "N/A"}
                </Text>
              </View>
            </View>

            {selectedTrip.truck && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Truck</Text>
                <Text style={styles.infoValue}>
                  {selectedTrip.truck.licensePlate}
                </Text>
              </View>
            )}

            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Distance</Text>
              <Text style={styles.infoValue}>
                {formatDistance(selectedTrip.estimatedDistanceKm)}
              </Text>
            </View>

            {selectedTrip.startedAt && (
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Started</Text>
                <Text style={styles.infoValue}>
                  {formatDate(selectedTrip.startedAt)}
                </Text>
              </View>
            )}
          </Card>

          {/* Progress card */}
          <Card style={styles.card}>
            <Text style={styles.cardTitle}>Trip Progress</Text>

            <View style={styles.progressBarContainer}>
              <View style={styles.progressBarBg}>
                <View
                  style={[
                    styles.progressBarFill,
                    {
                      width: `${getProgressPercent(selectedTrip.status)}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {getProgressPercent(selectedTrip.status)}% complete
              </Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.stat}>
                <Ionicons
                  name="time-outline"
                  size={16}
                  color={colors.slate400}
                />
                <Text style={styles.statLabel}>Status</Text>
                <Text style={styles.statValue}>
                  {selectedTrip.status.replace(/_/g, " ")}
                </Text>
              </View>
            </View>
          </Card>
        </>
      )}

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

function getProgressPercent(status: string): number {
  switch (status) {
    case "ASSIGNED":
      return 10;
    case "PICKUP_PENDING":
      return 30;
    case "IN_TRANSIT":
      return 60;
    case "DELIVERED":
      return 90;
    case "COMPLETED":
      return 100;
    default:
      return 0;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapContainer: { height: SCREEN_HEIGHT * 0.3 },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.primary50,
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholderText: {
    ...typography.titleMedium,
    color: colors.primary500,
    marginTop: spacing.sm,
  },
  mapSubtext: {
    ...typography.bodySmall,
    color: colors.primary300,
    marginTop: spacing.xs,
  },
  chipContainer: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  card: { margin: spacing.lg, marginBottom: 0 },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  cardTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  routeDisplay: {
    marginBottom: spacing.md,
    paddingLeft: spacing.sm,
  },
  routeEndpoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  routeLine: {
    width: 1,
    height: 20,
    backgroundColor: colors.slate300,
    marginLeft: 6,
    marginVertical: 2,
  },
  routeText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  infoLabel: { ...typography.bodySmall, color: colors.textSecondary },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  progressBarContainer: { marginVertical: spacing.md },
  progressBarBg: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.slate100,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 4,
    backgroundColor: colors.primary500,
  },
  progressText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: "right",
  },
  statsRow: {
    flexDirection: "row",
    gap: spacing.lg,
  },
  stat: { alignItems: "center", gap: 2 },
  statLabel: { ...typography.labelSmall, color: colors.textTertiary },
  statValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "500",
  },
});

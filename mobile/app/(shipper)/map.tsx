/**
 * Shipper Map Screen - Shipment Tracking
 * Shows active shipments on a real map with GPS markers and progress tracking
 */
import React, { useState, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Dimensions,
  RefreshControl,
  TouchableOpacity,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";

// react-native-maps only works on iOS/Android — use a placeholder on web

let MapView: React.ComponentType<Record<string, unknown>> | null = null;
let Marker: React.ComponentType<Record<string, unknown>> | null = null;
let PROVIDER_GOOGLE: string | undefined = undefined;
if (Platform.OS !== "web") {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Maps = require("react-native-maps");
  MapView = Maps.default;
  Marker = Maps.Marker;
  PROVIDER_GOOGLE = Maps.PROVIDER_GOOGLE;
}
import { useRouter } from "expo-router";
import { useTrips } from "../../src/hooks/useTrips";
import { useLoadProgress } from "../../src/hooks/useTracking";
import { Card } from "../../src/components/Card";
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

// Ethiopia center
const INITIAL_REGION = {
  latitude: 9.0,
  longitude: 38.7,
  latitudeDelta: 6,
  longitudeDelta: 6,
};

export default function ShipperMapScreen() {
  const router = useRouter();
  const mapRef = useRef(null);
  const {
    data: tripsData,
    isLoading,
    refetch,
    isRefetching,
  } = useTrips({
    status: "IN_TRANSIT",
  });
  const [expandedTripId, setExpandedTripId] = useState<string | null>(null);

  const trips = tripsData?.trips ?? [];
  const selectedTrip = trips.find((t) => t.id === expandedTripId);

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

  const toggleExpand = (tripId: string) => {
    setExpandedTripId(expandedTripId === tripId ? null : tripId);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Map */}
      <View style={styles.mapContainer}>
        {Platform.OS !== "web" && MapView && Marker ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
            initialRegion={INITIAL_REGION}
            showsUserLocation={false}
            showsCompass
            showsScale
          >
            {trips.map((trip: Trip) => (
              <React.Fragment key={trip.id}>
                {/* Pickup marker (green) */}
                {trip.pickupLat != null && trip.pickupLng != null && (
                  <Marker
                    coordinate={{
                      latitude: trip.pickupLat,
                      longitude: trip.pickupLng,
                    }}
                    title={`Pickup: ${trip.pickupCity ?? "N/A"}`}
                    pinColor="green"
                  />
                )}
                {/* Delivery marker (red) */}
                {trip.deliveryLat != null && trip.deliveryLng != null && (
                  <Marker
                    coordinate={{
                      latitude: trip.deliveryLat,
                      longitude: trip.deliveryLng,
                    }}
                    title={`Delivery: ${trip.deliveryCity ?? "N/A"}`}
                    pinColor="red"
                  />
                )}
                {/* Truck marker (blue) - last known position */}
                {trip.currentLat != null && trip.currentLng != null && (
                  <Marker
                    coordinate={{
                      latitude: trip.currentLat,
                      longitude: trip.currentLng,
                    }}
                    title={`Truck: ${trip.truck?.licensePlate ?? "In Transit"}`}
                    pinColor="blue"
                  />
                )}
              </React.Fragment>
            ))}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Ionicons name="map-outline" size={48} color={colors.slate300} />
            <Text style={styles.mapPlaceholderText}>Shipment Map</Text>
            <Text style={styles.mapSubtext}>
              Map available on iOS and Android
            </Text>
          </View>
        )}
      </View>

      {/* Summary bar */}
      <View style={styles.summaryBar}>
        <View style={styles.summaryChip}>
          <View
            style={[styles.summaryDot, { backgroundColor: colors.primary500 }]}
          />
          <Text style={styles.summaryText}>
            {trips.length} Active Shipment{trips.length !== 1 ? "s" : ""}
          </Text>
        </View>
      </View>

      {/* Progress card for selected trip */}
      {selectedTrip?.load?.id && <ProgressCard loadId={selectedTrip.load.id} />}

      {/* Active shipment cards */}
      <View style={styles.tripsSection}>
        <Text style={styles.sectionTitle}>Active Shipments</Text>

        {trips.map((trip: Trip) => {
          const isExpanded = expandedTripId === trip.id;

          return (
            <TouchableOpacity
              key={trip.id}
              onPress={() => toggleExpand(trip.id)}
              activeOpacity={0.7}
            >
              <Card
                style={[
                  styles.tripCard,
                  isExpanded ? styles.tripCardExpanded : undefined,
                ]}
              >
                {/* Trip header row */}
                <View style={styles.tripHeader}>
                  <View style={styles.routeContainer}>
                    <View style={styles.routeEndpoint}>
                      <Ionicons
                        name="radio-button-on"
                        size={12}
                        color={colors.success}
                      />
                      <Text style={styles.routeCity} numberOfLines={1}>
                        {trip.pickupCity ?? "N/A"}
                      </Text>
                    </View>
                    <Ionicons
                      name="arrow-forward"
                      size={14}
                      color={colors.slate400}
                      style={styles.routeArrow}
                    />
                    <View style={styles.routeEndpoint}>
                      <Ionicons
                        name="location"
                        size={12}
                        color={colors.error}
                      />
                      <Text style={styles.routeCity} numberOfLines={1}>
                        {trip.deliveryCity ?? "N/A"}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.headerRight}>
                    <StatusBadge status={trip.status} type="trip" size="sm" />
                    <Ionicons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={18}
                      color={colors.slate400}
                      style={styles.expandIcon}
                    />
                  </View>
                </View>

                {/* Summary info (always visible) */}
                <View style={styles.tripSummary}>
                  {trip.carrier && (
                    <View style={styles.detailChip}>
                      <Ionicons
                        name="business-outline"
                        size={14}
                        color={colors.slate500}
                      />
                      <Text style={styles.detailText}>
                        {trip.carrier.name ?? "Carrier"}
                      </Text>
                    </View>
                  )}
                  {trip.truck && (
                    <View style={styles.detailChip}>
                      <Ionicons
                        name="bus-outline"
                        size={14}
                        color={colors.slate500}
                      />
                      <Text style={styles.detailText}>
                        {trip.truck.licensePlate}
                      </Text>
                    </View>
                  )}
                  <View style={styles.detailChip}>
                    <Ionicons
                      name="speedometer-outline"
                      size={14}
                      color={colors.slate500}
                    />
                    <Text style={styles.detailText}>
                      {formatDistance(trip.estimatedDistanceKm)}
                    </Text>
                  </View>
                </View>

                {/* Progress bar */}
                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBg}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {
                          width: `${getProgressPercent(trip.status)}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={styles.progressText}>
                    {getProgressPercent(trip.status)}% complete
                  </Text>
                </View>

                {/* Expanded details */}
                {isExpanded && (
                  <View style={styles.expandedDetails}>
                    <View style={styles.divider} />

                    {trip.pickupAddress && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Pickup</Text>
                        <Text style={styles.infoValue} numberOfLines={2}>
                          {trip.pickupAddress}
                        </Text>
                      </View>
                    )}

                    {trip.deliveryAddress && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Delivery</Text>
                        <Text style={styles.infoValue} numberOfLines={2}>
                          {trip.deliveryAddress}
                        </Text>
                      </View>
                    )}

                    {trip.startedAt && (
                      <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Started</Text>
                        <Text style={styles.infoValue}>
                          {formatDate(trip.startedAt)}
                        </Text>
                      </View>
                    )}

                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Status</Text>
                      <Text style={styles.infoValue}>
                        {trip.status.replace(/_/g, " ")}
                      </Text>
                    </View>

                    <Button
                      title="View Full Details"
                      onPress={() =>
                        router.push(
                          `/(shipper)/trips/${trip.id}` as `/${string}`
                        )
                      }
                      variant="outline"
                      size="sm"
                      style={styles.viewButton}
                    />
                  </View>
                )}
              </Card>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

/** Progress card component that polls for live tracking data */
function ProgressCard({ loadId }: { loadId: string }) {
  const { data: progress } = useLoadProgress(loadId);

  if (!progress?.progress) return null;

  const p = progress.progress;
  return (
    <Card style={styles.progressCard}>
      <View style={styles.progressCardHeader}>
        <Ionicons
          name="analytics-outline"
          size={18}
          color={colors.primary500}
        />
        <Text style={styles.progressCardTitle}>Live Progress</Text>
      </View>
      <View style={styles.progressBarBg}>
        <View style={[styles.progressBarFill, { width: `${p.percent}%` }]} />
      </View>
      <View style={styles.progressStats}>
        <Text style={styles.progressStat}>{p.percent}% complete</Text>
        {p.remainingKm != null && (
          <Text style={styles.progressStat}>
            {formatDistance(p.remainingKm)} remaining
          </Text>
        )}
        {p.estimatedArrival && (
          <Text style={styles.progressStat}>
            ETA:{" "}
            {new Date(p.estimatedArrival).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        )}
      </View>
    </Card>
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
  mapContainer: { height: SCREEN_HEIGHT * 0.35 },
  map: { flex: 1 },
  mapPlaceholder: {
    flex: 1,
    backgroundColor: colors.slate100,
    justifyContent: "center",
    alignItems: "center",
  },
  mapPlaceholderText: {
    ...typography.titleMedium,
    color: colors.slate400,
    marginTop: spacing.sm,
  },
  mapSubtext: {
    ...typography.bodySmall,
    color: colors.slate300,
    marginTop: spacing.xs,
  },
  summaryBar: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  summaryChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  summaryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  summaryText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  progressCard: {
    margin: spacing.lg,
    marginBottom: 0,
  },
  progressCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  progressCardTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  progressStats: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  progressStat: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  tripsSection: {
    padding: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  tripCard: {
    marginBottom: spacing.md,
  },
  tripCardExpanded: {
    borderWidth: 1,
    borderColor: colors.primary200,
  },
  tripHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  routeContainer: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: spacing.sm,
  },
  routeEndpoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 1,
  },
  routeCity: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  routeArrow: {
    marginHorizontal: spacing.xs,
  },
  headerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  expandIcon: {
    marginLeft: 2,
  },
  tripSummary: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  detailChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  detailText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  progressBarContainer: {
    marginTop: spacing.xs,
  },
  progressBarBg: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.slate100,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    borderRadius: 3,
    backgroundColor: colors.primary500,
  },
  progressText: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginTop: 4,
    textAlign: "right",
  },
  expandedDetails: {
    marginTop: spacing.sm,
  },
  divider: {
    height: 1,
    backgroundColor: colors.slate100,
    marginBottom: spacing.sm,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
  },
  infoLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    flex: 1,
  },
  infoValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 2,
    textAlign: "right",
  },
  viewButton: {
    marginTop: spacing.md,
  },
});

/**
 * Carrier Fleet Map Screen
 * Shows fleet trucks on map with active trips and status list
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Dimensions,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTrucks } from "../../src/hooks/useTrucks";
import { useTrips } from "../../src/hooks/useTrips";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { StatusBadge } from "../../src/components/StatusBadge";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { formatDistance } from "../../src/utils/format";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Truck, Trip } from "../../src/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

type SectionItem =
  | { type: "trip"; data: Trip }
  | { type: "truck"; data: Truck };

export default function CarrierMapScreen() {
  const router = useRouter();
  const {
    data: trucksData,
    isLoading: trucksLoading,
    refetch: refetchTrucks,
    isRefetching: isRefetchingTrucks,
  } = useTrucks();
  const {
    data: tripsData,
    isLoading: tripsLoading,
    refetch: refetchTrips,
    isRefetching: isRefetchingTrips,
  } = useTrips({ status: "IN_TRANSIT" });
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);

  const trucks = trucksData?.trucks ?? [];
  const trips = tripsData?.trips ?? [];
  const activeTrucks = trucks.filter((truck: Truck) => truck.isAvailable);
  const offlineTrucks = trucks.filter((truck: Truck) => !truck.isAvailable);
  const isLoading = trucksLoading || tripsLoading;
  const isRefetching = isRefetchingTrucks || isRefetchingTrips;

  if (isLoading) return <LoadingSpinner fullScreen />;

  const handleRefresh = () => {
    refetchTrucks();
    refetchTrips();
  };

  const sections: Array<{
    title: string;
    data: SectionItem[];
    emptyText?: string;
  }> = [
    {
      title: `Active Deliveries (${trips.length})`,
      data: trips.map((trip: Trip) => ({ type: "trip" as const, data: trip })),
      emptyText: "No active deliveries in transit",
    },
    {
      title: "Fleet Trucks",
      data: trucks.map((truck: Truck) => ({
        type: "truck" as const,
        data: truck,
      })),
      emptyText: "No trucks added yet",
    },
  ];

  const renderItem = ({ item }: { item: SectionItem }) => {
    if (item.type === "trip") {
      return renderTripItem(item.data);
    }
    return renderTruckItem(item.data);
  };

  const renderTripItem = (trip: Trip) => (
    <TouchableOpacity
      onPress={() => router.push(`/(carrier)/trips/${trip.id}` as `/${string}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.itemCard} padding="md">
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
              <Ionicons name="location" size={12} color={colors.error} />
              <Text style={styles.routeCity} numberOfLines={1}>
                {trip.deliveryCity ?? "N/A"}
              </Text>
            </View>
          </View>
          <StatusBadge status={trip.status} type="trip" size="sm" />
        </View>

        <View style={styles.tripDetails}>
          {trip.truck && (
            <View style={styles.detailChip}>
              <Ionicons name="bus-outline" size={14} color={colors.slate500} />
              <Text style={styles.detailText}>{trip.truck.licensePlate}</Text>
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
      </Card>
    </TouchableOpacity>
  );

  const renderTruckItem = (truck: Truck) => (
    <TouchableOpacity
      onPress={() =>
        setSelectedTruckId(truck.id === selectedTruckId ? null : truck.id)
      }
      activeOpacity={0.7}
    >
      <Card
        style={[
          styles.itemCard,
          truck.id === selectedTruckId ? styles.selectedCard : undefined,
        ]}
        padding="md"
      >
        <View style={styles.truckRow}>
          <View style={styles.truckIcon}>
            <Ionicons
              name="bus"
              size={24}
              color={truck.isAvailable ? colors.success : colors.slate400}
            />
          </View>
          <View style={styles.truckInfo}>
            <Text style={styles.truckPlate}>{truck.licensePlate}</Text>
            <Text style={styles.truckType}>{truck.truckType}</Text>
          </View>
          <Badge
            label={truck.isAvailable ? "Active" : "Offline"}
            variant={truck.isAvailable ? "success" : "neutral"}
            size="sm"
          />
        </View>
      </Card>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({
    section,
  }: {
    section: { title: string; data: SectionItem[]; emptyText?: string };
  }) => (
    <View>
      <Text style={styles.sectionTitle}>{section.title}</Text>
      {section.data.length === 0 && (
        <View style={styles.sectionEmpty}>
          <Text style={styles.sectionEmptyText}>
            {section.emptyText ?? "No items"}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      {/* Map placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={48} color={colors.slate300} />
          <Text style={styles.mapPlaceholderText}>Fleet Map</Text>
          <Text style={styles.mapSubtext}>
            Google Maps API key required for live tracking
          </Text>
        </View>
      </View>

      {/* Fleet status bar */}
      <View style={styles.statusBar}>
        <View style={styles.statusChip}>
          <View
            style={[styles.statusDot, { backgroundColor: colors.primary500 }]}
          />
          <Text style={styles.statusText}>{trips.length} In Transit</Text>
        </View>
        <View style={styles.statusChip}>
          <View
            style={[styles.statusDot, { backgroundColor: colors.success }]}
          />
          <Text style={styles.statusText}>{activeTrucks.length} Active</Text>
        </View>
        <View style={styles.statusChip}>
          <View
            style={[styles.statusDot, { backgroundColor: colors.slate400 }]}
          />
          <Text style={styles.statusText}>{offlineTrucks.length} Offline</Text>
        </View>
      </View>

      {/* Trips and truck list */}
      <SectionList
        sections={sections}
        renderItem={renderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => `${item.type}-${item.data.id}`}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapContainer: { height: SCREEN_HEIGHT * 0.25 },
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
  statusBar: {
    flexDirection: "row",
    padding: spacing.md,
    gap: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  list: { padding: spacing.lg, paddingTop: 0 },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  sectionEmpty: {
    paddingVertical: spacing.xl,
    alignItems: "center",
  },
  sectionEmptyText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  itemCard: { marginBottom: spacing.sm },
  selectedCard: { borderWidth: 2, borderColor: colors.primary500 },
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
  tripDetails: {
    flexDirection: "row",
    gap: spacing.md,
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
  truckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  truckIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.slate50,
    justifyContent: "center",
    alignItems: "center",
  },
  truckInfo: { flex: 1 },
  truckPlate: { ...typography.titleSmall, color: colors.textPrimary },
  truckType: { ...typography.bodySmall, color: colors.textSecondary },
});

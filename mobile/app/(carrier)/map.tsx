/**
 * Carrier Fleet Map Screen
 * Shows fleet trucks on map with status list
 */
import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTrucks } from "../../src/hooks/useTrucks";
import { Card } from "../../src/components/Card";
import { Badge } from "../../src/components/Badge";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { EmptyState } from "../../src/components/EmptyState";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import type { Truck } from "../../src/types";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

export default function CarrierMapScreen() {
  const { data: trucksData, isLoading } = useTrucks();
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);

  const trucks = trucksData?.trucks ?? [];
  const activeTrucks = trucks.filter((truck: Truck) => truck.isAvailable);
  const offlineTrucks = trucks.filter((truck: Truck) => !truck.isAvailable);

  if (isLoading) return <LoadingSpinner fullScreen />;

  const renderTruckItem = ({ item }: { item: Truck }) => (
    <TouchableOpacity
      onPress={() =>
        setSelectedTruckId(item.id === selectedTruckId ? null : item.id)
      }
      activeOpacity={0.7}
    >
      <Card
        style={[
          styles.truckCard,
          item.id === selectedTruckId ? styles.selectedCard : undefined,
        ]}
        padding="md"
      >
        <View style={styles.truckRow}>
          <View style={styles.truckIcon}>
            <Ionicons
              name="bus"
              size={24}
              color={item.isAvailable ? colors.success : colors.slate400}
            />
          </View>
          <View style={styles.truckInfo}>
            <Text style={styles.truckPlate}>{item.licensePlate}</Text>
            <Text style={styles.truckType}>{item.truckType}</Text>
          </View>
          <Badge
            label={item.isAvailable ? "Active" : "Offline"}
            variant={item.isAvailable ? "success" : "neutral"}
            size="sm"
          />
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Map placeholder */}
      <View style={styles.mapContainer}>
        <View style={styles.mapPlaceholder}>
          <Ionicons name="map-outline" size={48} color={colors.slate300} />
          <Text style={styles.mapPlaceholderText}>Fleet Map</Text>
          <Text style={styles.mapSubtext}>
            Google Maps integration required
          </Text>
        </View>
      </View>

      {/* Fleet status bar */}
      <View style={styles.statusBar}>
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

      {/* Truck list */}
      <View style={styles.listContainer}>
        <Text style={styles.listTitle}>Fleet Trucks</Text>
        <FlatList
          data={trucks}
          renderItem={renderTruckItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="bus-outline"
              title="No trucks"
              message="Add trucks to see them on the fleet map"
            />
          }
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  mapContainer: { height: SCREEN_HEIGHT * 0.35 },
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
  listContainer: { flex: 1, padding: spacing.lg },
  listTitle: {
    ...typography.titleSmall,
    color: colors.textTertiary,
    textTransform: "uppercase",
    marginBottom: spacing.md,
  },
  list: { gap: spacing.sm },
  truckCard: { marginBottom: spacing.xs },
  selectedCard: { borderWidth: 2, borderColor: colors.primary500 },
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

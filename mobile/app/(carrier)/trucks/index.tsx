/**
 * My Trucks list screen (Carrier)
 */
import React from "react";
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
import { useTrucks } from "../../../src/hooks/useTrucks";
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

export default function TrucksListScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useTrucks();

  const trucks = data?.trucks ?? [];

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
              title="No trucks yet"
              message="Add your first truck to get started"
              actionLabel="Add Truck"
              onAction={() => router.push("/(carrier)/trucks/add")}
            />
          }
          ListHeaderComponent={
            trucks.length > 0 ? (
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

/**
 * Carrier Loadboard Screen
 * Ported from Flutter's CarrierLoadboardScreen (1120 LOC)
 * Search/filter loads, view details, request loads
 */
import React, { useState } from "react";
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
import { useLoads } from "../../../src/hooks/useLoads";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Input } from "../../../src/components/Input";
import {
  formatTruckType,
  formatWeight,
  formatDistance,
  formatAge,
} from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { Load } from "../../../src/types";

export default function CarrierLoadboard() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch, isRefetching } = useLoads({
    status: "POSTED",
  });

  const loads = data?.loads ?? [];
  const filtered = search
    ? loads.filter(
        (l: Load) =>
          l.pickupCity?.toLowerCase().includes(search.toLowerCase()) ||
          l.deliveryCity?.toLowerCase().includes(search.toLowerCase()) ||
          l.cargoDescription?.toLowerCase().includes(search.toLowerCase())
      )
    : loads;

  const renderLoad = ({ item }: { item: Load }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(carrier)/loadboard/${item.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.loadCard}>
        <View style={styles.loadHeader}>
          <View style={styles.route}>
            <Text style={styles.city}>{item.pickupCity ?? "N/A"}</Text>
            <Ionicons name="arrow-forward" size={16} color={colors.slate400} />
            <Text style={styles.city}>{item.deliveryCity ?? "N/A"}</Text>
          </View>
          <StatusBadge status={item.status} type="load" />
        </View>

        <View style={styles.loadDetails}>
          <View style={styles.detailItem}>
            <Ionicons name="bus-outline" size={14} color={colors.slate400} />
            <Text style={styles.detailText}>
              {formatTruckType(item.truckType)}
            </Text>
          </View>
          <View style={styles.detailItem}>
            <Ionicons name="scale-outline" size={14} color={colors.slate400} />
            <Text style={styles.detailText}>{formatWeight(item.weight)}</Text>
          </View>
          {item.estimatedTripKm && (
            <View style={styles.detailItem}>
              <Ionicons
                name="speedometer-outline"
                size={14}
                color={colors.slate400}
              />
              <Text style={styles.detailText}>
                {formatDistance(item.estimatedTripKm)}
              </Text>
            </View>
          )}
          {item.postedAt && (
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={14} color={colors.slate400} />
              <Text style={styles.detailText}>{formatAge(item.postedAt)}</Text>
            </View>
          )}
        </View>

        <Text style={styles.cargo} numberOfLines={1}>
          {item.cargoDescription}
        </Text>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by city, cargo..."
          leftIcon={
            <Ionicons name="search-outline" size={20} color={colors.slate400} />
          }
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {/* Results */}
      {isLoading && !data ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderLoad}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No loads found"
              message="Check back later for new loads"
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
  searchContainer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  loadCard: {
    marginBottom: spacing.md,
  },
  loadHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  route: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  city: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  loadDetails: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.sm,
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
  cargo: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
});

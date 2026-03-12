/**
 * Carrier Loadboard Screen
 * Search/filter loads, view details, request loads
 * With collapsible filter panel for truck type, weight, origin/destination
 */
import React, { useState, useCallback } from "react";
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
import { Ionicons } from "@expo/vector-icons";
import { useLoads } from "../../../src/hooks/useLoads";
import { useMyTruckPostings } from "../../../src/hooks/useTrucks";
import { useAuthStore } from "../../../src/stores/auth";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Input } from "../../../src/components/Input";
import { Button } from "../../../src/components/Button";
import {
  formatTruckType,
  formatWeight,
  formatDistance,
  formatAge,
} from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { Load, TruckPosting } from "../../../src/types";

const TRUCK_TYPES = [
  "FLATBED",
  "REFRIGERATED",
  "TANKER",
  "CONTAINER",
  "DRY_VAN",
  "LOWBOY",
  "DUMP_TRUCK",
  "BOX_TRUCK",
];

interface Filters {
  truckType?: string;
  pickupCity?: string;
  deliveryCity?: string;
  minWeight?: string;
  maxWeight?: string;
}

export default function CarrierLoadboard() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [appliedFilters, setAppliedFilters] = useState<Filters>({});
  const [selectedPostingId, setSelectedPostingId] = useState<string | null>(
    null
  );

  // G-M16-2: Fetch carrier's active truck postings for DH filter
  const organizationId = useAuthStore((s) => s.user?.organizationId);
  const { data: postingsData } = useMyTruckPostings({
    status: "ACTIVE",
    organizationId: organizationId ?? undefined,
  });
  const activePostings: TruckPosting[] = postingsData?.postings ?? [];

  // Build query params from applied filters
  const queryParams: Record<string, string | number | undefined> = {
    status: "POSTED,SEARCHING,OFFERED",
  };
  if (appliedFilters.truckType)
    queryParams.truckType = appliedFilters.truckType;
  // G-M16-1: Use correct API param names (pickupCity/deliveryCity, not origin/destination)
  if (appliedFilters.pickupCity)
    queryParams.pickupCity = appliedFilters.pickupCity;
  if (appliedFilters.deliveryCity)
    queryParams.deliveryCity = appliedFilters.deliveryCity;
  // G-M16-4: Pass truckPostingId for server-side DH filtering
  if (selectedPostingId) queryParams.truckPostingId = selectedPostingId;

  const { data, isLoading, refetch, isRefetching } = useLoads(queryParams);

  const loads = data?.loads ?? [];

  // Client-side filtering for search text and weight range
  const filtered = loads.filter((l: Load) => {
    // Search text
    if (search) {
      const s = search.toLowerCase();
      const matchesSearch =
        l.pickupCity?.toLowerCase().includes(s) ||
        l.deliveryCity?.toLowerCase().includes(s) ||
        l.cargoDescription?.toLowerCase().includes(s);
      if (!matchesSearch) return false;
    }

    // Weight range (client-side since API may not support min/max)
    if (appliedFilters.minWeight) {
      const minW = parseFloat(appliedFilters.minWeight);
      if (!isNaN(minW) && l.weight != null && Number(l.weight) < minW)
        return false;
    }
    if (appliedFilters.maxWeight) {
      const maxW = parseFloat(appliedFilters.maxWeight);
      if (!isNaN(maxW) && l.weight != null && Number(l.weight) > maxW)
        return false;
    }

    return true;
  });

  const activeFilterCount =
    Object.values(appliedFilters).filter(Boolean).length;

  const handleApplyFilters = useCallback(() => {
    setAppliedFilters({ ...filters });
    setShowFilters(false);
    refetch();
  }, [filters, refetch]);

  const handleClearFilters = useCallback(() => {
    setFilters({});
    setAppliedFilters({});
    setShowFilters(false);
    refetch();
  }, [refetch]);

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
      {/* Search + Filter Toggle */}
      <View style={styles.searchContainer}>
        <View style={styles.searchRow}>
          <View style={{ flex: 1 }}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search by city, cargo..."
              leftIcon={
                <Ionicons
                  name="search-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
              containerStyle={{ marginBottom: 0 }}
            />
          </View>
          <TouchableOpacity
            style={[
              styles.filterToggle,
              activeFilterCount > 0 && styles.filterToggleActive,
            ]}
            onPress={() => setShowFilters(!showFilters)}
          >
            <Ionicons
              name="options-outline"
              size={22}
              color={activeFilterCount > 0 ? colors.white : colors.primary600}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{activeFilterCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* G-M16-2: TruckPosting selector for server-side DH filtering */}
      {activePostings.length > 0 && (
        <View style={styles.postingSelector}>
          <Text style={styles.postingSelectorLabel}>Filter by Posting</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            <View style={styles.chipRow}>
              <TouchableOpacity
                style={[
                  styles.chip,
                  selectedPostingId === null && styles.chipActive,
                ]}
                onPress={() => {
                  setSelectedPostingId(null);
                  refetch();
                }}
              >
                <Text
                  style={[
                    styles.chipText,
                    selectedPostingId === null && styles.chipTextActive,
                  ]}
                >
                  All Loads
                </Text>
              </TouchableOpacity>
              {activePostings.map((p) => (
                <TouchableOpacity
                  key={p.id}
                  style={[
                    styles.chip,
                    selectedPostingId === p.id && styles.chipActive,
                  ]}
                  onPress={() => {
                    setSelectedPostingId(
                      selectedPostingId === p.id ? null : p.id
                    );
                    refetch();
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      selectedPostingId === p.id && styles.chipTextActive,
                    ]}
                  >
                    {p.truck?.licensePlate ?? "Truck"} (
                    {p.originCityName ?? "?"} → {p.destinationCityName ?? "?"})
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Collapsible Filter Panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          {/* Truck Type */}
          <Text style={styles.filterLabel}>Truck Type</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipScroll}
          >
            <View style={styles.chipRow}>
              {TRUCK_TYPES.map((type) => (
                <TouchableOpacity
                  key={type}
                  style={[
                    styles.chip,
                    filters.truckType === type && styles.chipActive,
                  ]}
                  onPress={() =>
                    setFilters((f) => ({
                      ...f,
                      truckType: f.truckType === type ? undefined : type,
                    }))
                  }
                >
                  <Text
                    style={[
                      styles.chipText,
                      filters.truckType === type && styles.chipTextActive,
                    ]}
                  >
                    {formatTruckType(type)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>

          {/* Weight Range */}
          <Text style={styles.filterLabel}>Weight Range (kg)</Text>
          <View style={styles.rangeRow}>
            <Input
              value={filters.minWeight ?? ""}
              onChangeText={(v) => setFilters((f) => ({ ...f, minWeight: v }))}
              placeholder="Min"
              keyboardType="numeric"
              containerStyle={styles.rangeInput}
            />
            <Text style={styles.rangeSeparator}>-</Text>
            <Input
              value={filters.maxWeight ?? ""}
              onChangeText={(v) => setFilters((f) => ({ ...f, maxWeight: v }))}
              placeholder="Max"
              keyboardType="numeric"
              containerStyle={styles.rangeInput}
            />
          </View>

          {/* Pickup / Delivery City */}
          <Text style={styles.filterLabel}>Pickup City</Text>
          <Input
            value={filters.pickupCity ?? ""}
            onChangeText={(v) => setFilters((f) => ({ ...f, pickupCity: v }))}
            placeholder="Pickup city"
            containerStyle={{ marginBottom: spacing.sm }}
          />

          <Text style={styles.filterLabel}>Delivery City</Text>
          <Input
            value={filters.deliveryCity ?? ""}
            onChangeText={(v) => setFilters((f) => ({ ...f, deliveryCity: v }))}
            placeholder="Delivery city"
            containerStyle={{ marginBottom: spacing.md }}
          />

          {/* Filter Actions */}
          <View style={styles.filterActions}>
            <Button
              title="Clear"
              onPress={handleClearFilters}
              variant="outline"
              size="md"
              style={{ flex: 1 }}
            />
            <Button
              title="Apply Filters"
              onPress={handleApplyFilters}
              variant="primary"
              size="md"
              style={{ flex: 1 }}
            />
          </View>
        </View>
      )}

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
              message={
                activeFilterCount > 0
                  ? "Try adjusting your filters"
                  : "Check back later for new loads"
              }
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
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  filterToggle: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: colors.primary50,
    justifyContent: "center",
    alignItems: "center",
  },
  filterToggleActive: {
    backgroundColor: colors.primary600,
  },
  filterBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.error,
    justifyContent: "center",
    alignItems: "center",
  },
  filterBadgeText: {
    ...typography.labelSmall,
    color: colors.white,
    fontSize: 9,
  },
  postingSelector: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  postingSelectorLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  filterPanel: {
    backgroundColor: colors.white,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  filterLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  chipScroll: {
    marginBottom: spacing.sm,
  },
  chipRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.slate100,
  },
  chipActive: {
    backgroundColor: colors.primary600,
  },
  chipText: {
    ...typography.labelSmall,
    color: colors.slate600,
  },
  chipTextActive: {
    color: colors.white,
  },
  rangeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  rangeInput: {
    flex: 1,
    marginBottom: 0,
  },
  rangeSeparator: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: -spacing.sm,
  },
  filterActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
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

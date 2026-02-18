/**
 * Shipper Truckboard - Find available trucks
 * Shippers browse truck-postings (not trucks directly per foundation rules)
 */
import React, { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTruckPostings } from "../../../src/hooks/useTrucks";
import { Card } from "../../../src/components/Card";
import { Input } from "../../../src/components/Input";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { formatTruckType } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { TruckPosting } from "../../../src/types";

export default function ShipperTruckboard() {
  const [search, setSearch] = useState("");
  const { data, isLoading, refetch, isRefetching } = useTruckPostings();

  const postings = data?.postings ?? [];
  const filtered = search
    ? postings.filter(
        (p) =>
          p.originCityName?.toLowerCase().includes(search.toLowerCase()) ||
          p.destinationCityName?.toLowerCase().includes(search.toLowerCase())
      )
    : postings;

  const renderPosting = ({ item }: { item: TruckPosting }) => (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.route}>
          {item.originCityName ?? "N/A"} → {item.destinationCityName ?? "Any"}
        </Text>
      </View>
      <View style={styles.details}>
        {item.truck && (
          <View style={styles.detailItem}>
            <Ionicons name="bus-outline" size={14} color={colors.slate400} />
            <Text style={styles.detailText}>
              {formatTruckType(item.truck.truckType)}
            </Text>
          </View>
        )}
        <View style={styles.detailItem}>
          <Ionicons name="calendar-outline" size={14} color={colors.slate400} />
          <Text style={styles.detailText}>
            From: {new Date(item.availableFrom).toLocaleDateString()}
          </Text>
        </View>
        {item.contactPhone && (
          <View style={styles.detailItem}>
            <Ionicons name="call-outline" size={14} color={colors.slate400} />
            <Text style={styles.detailText}>{item.contactPhone}</Text>
          </View>
        )}
      </View>
    </Card>
  );

  return (
    <View style={styles.container}>
      <View style={styles.searchContainer}>
        <Input
          value={search}
          onChangeText={setSearch}
          placeholder="Search by city..."
          leftIcon={
            <Ionicons name="search-outline" size={20} color={colors.slate400} />
          }
          containerStyle={{ marginBottom: 0 }}
        />
      </View>

      {isLoading && !data ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={filtered}
          renderItem={renderPosting}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bus-outline"
              title="No trucks available"
              message="Check back later"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchContainer: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: spacing.md },
  header: { marginBottom: spacing.sm },
  route: { ...typography.titleSmall, color: colors.textPrimary },
  details: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  detailItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  detailText: { ...typography.bodySmall, color: colors.textSecondary },
});

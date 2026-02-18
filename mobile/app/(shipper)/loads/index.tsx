/**
 * Shipper Loads List Screen
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
import { useLoads } from "../../../src/hooks/useLoads";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { Button } from "../../../src/components/Button";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import {
  formatTruckType,
  formatWeight,
  formatDate,
} from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { Load } from "../../../src/types";

export default function ShipperLoadsScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useLoads();

  const loads = data?.loads ?? [];

  const renderLoad = ({ item }: { item: Load }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(shipper)/loads/${item.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.route}>
            {item.pickupCity} → {item.deliveryCity}
          </Text>
          <StatusBadge status={item.status} type="load" />
        </View>
        <View style={styles.details}>
          <Text style={styles.detail}>{formatTruckType(item.truckType)}</Text>
          <Text style={styles.detail}>{formatWeight(item.weight)}</Text>
          <Text style={styles.detail}>{formatDate(item.pickupDate)}</Text>
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
          data={loads}
          renderItem={renderLoad}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No loads yet"
              message="Create your first load to get started"
              actionLabel="Create Load"
              onAction={() => router.push("/(shipper)/loads/create")}
            />
          }
          ListHeaderComponent={
            loads.length > 0 ? (
              <Button
                title="Create Load"
                onPress={() => router.push("/(shipper)/loads/create")}
                variant="primary"
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
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
  addButton: { marginBottom: spacing.md, alignSelf: "flex-end" },
  card: { marginBottom: spacing.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  route: { ...typography.titleSmall, color: colors.textPrimary, flex: 1 },
  details: { flexDirection: "row", gap: spacing.lg },
  detail: { ...typography.bodySmall, color: colors.textSecondary },
});

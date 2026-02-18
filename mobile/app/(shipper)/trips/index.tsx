/**
 * Shipper Trips / Shipments List
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
import { useTrips } from "../../../src/hooks/useTrips";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { Trip } from "../../../src/types";

export default function ShipperTripsScreen() {
  const router = useRouter();
  const { data, isLoading, refetch, isRefetching } = useTrips();
  const trips = data?.trips ?? [];

  const renderTrip = ({ item }: { item: Trip }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(shipper)/trips/${item.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.route}>
            {item.pickupCity} → {item.deliveryCity}
          </Text>
          <StatusBadge status={item.status} type="trip" />
        </View>
        <Text style={styles.meta}>{formatDate(item.createdAt)}</Text>
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={trips}
          renderItem={renderTrip}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="navigate-outline"
              title="No shipments"
              message="Your shipments will appear here"
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { padding: spacing.lg, gap: spacing.md },
  card: { marginBottom: spacing.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  route: { ...typography.titleSmall, color: colors.textPrimary, flex: 1 },
  meta: { ...typography.bodySmall, color: colors.textTertiary },
});

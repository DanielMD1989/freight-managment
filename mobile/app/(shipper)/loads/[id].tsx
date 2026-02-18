/**
 * Shipper Load Details Screen
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useLoad, useLoadRequests } from "../../../src/hooks/useLoads";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import {
  formatTruckType,
  formatWeight,
  formatDistance,
  formatDate,
} from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

export default function ShipperLoadDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: load, isLoading } = useLoad(id);
  const { data: requestsData } = useLoadRequests(id);

  if (isLoading || !load) return <LoadingSpinner fullScreen />;

  const requests = requestsData?.requests ?? [];

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.route}>
            {load.pickupCity} → {load.deliveryCity}
          </Text>
          <StatusBadge status={load.status} type="load" size="md" />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Load Details</Text>
        <DetailRow label="Truck Type" value={formatTruckType(load.truckType)} />
        <DetailRow label="Weight" value={formatWeight(load.weight)} />
        <DetailRow
          label="Distance"
          value={formatDistance(load.estimatedTripKm)}
        />
        <DetailRow label="Cargo" value={load.cargoDescription} />
        <DetailRow label="Pickup" value={formatDate(load.pickupDate)} />
        <DetailRow label="Delivery" value={formatDate(load.deliveryDate)} />
      </Card>

      {requests.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Requests ({requests.length})</Text>
          {requests.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <StatusBadge status={req.status} />
              <Text style={styles.requestDate}>
                {formatDate(req.createdAt)}
              </Text>
            </View>
          ))}
        </Card>
      )}
    </ScrollView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string | number | null | undefined;
}) {
  if (!value) return null;
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{String(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { margin: spacing.lg, marginBottom: 0 },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  route: { ...typography.headlineSmall, color: colors.textPrimary, flex: 1 },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  detailLabel: { ...typography.bodyMedium, color: colors.textSecondary },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  requestDate: { ...typography.bodySmall, color: colors.textSecondary },
});

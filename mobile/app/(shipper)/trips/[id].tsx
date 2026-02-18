/**
 * Shipper Trip Details Screen - Delivery tracking
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { useTrip, useConfirmDelivery } from "../../../src/hooks/useTrips";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { formatDate, formatDistance } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

export default function ShipperTripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, isLoading } = useTrip(id);
  const confirmDelivery = useConfirmDelivery();

  if (isLoading || !trip) return <LoadingSpinner fullScreen />;

  const handleConfirm = () => {
    Alert.alert(
      "Confirm Delivery",
      "Confirm that the delivery has been received?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () =>
            confirmDelivery.mutate(id!, {
              onError: (err) => Alert.alert("Error", err.message),
            }),
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.route}>
            {trip.pickupCity} → {trip.deliveryCity}
          </Text>
          <StatusBadge status={trip.status} type="trip" size="md" />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Shipment Details</Text>
        <DetailRow
          label="Distance"
          value={formatDistance(trip.estimatedDistanceKm)}
        />
        {trip.startedAt && (
          <DetailRow label="Started" value={formatDate(trip.startedAt)} />
        )}
        {trip.deliveredAt && (
          <DetailRow label="Delivered" value={formatDate(trip.deliveredAt)} />
        )}
        {trip.truck && (
          <DetailRow label="Truck" value={trip.truck.licensePlate ?? "N/A"} />
        )}
      </Card>

      {trip.status === "DELIVERED" && !trip.shipperConfirmed && (
        <View style={styles.actions}>
          <Button
            title="Confirm Delivery"
            onPress={handleConfirm}
            loading={confirmDelivery.isPending}
            fullWidth
            size="lg"
          />
        </View>
      )}
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  },
  actions: { padding: spacing.lg },
});

/**
 * Carrier Trip Details Screen
 * Shows trip info + state machine action buttons
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useTrip,
  useUpdateTripStatus,
  useCancelTrip,
} from "../../../src/hooks/useTrips";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import {
  getValidNextTripStatuses,
  canCancelTrip,
} from "../../../src/utils/foundation-rules";
import {
  formatDate,
  formatDistance,
  formatTripStatus,
} from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { TripStatus } from "../../../src/types";

export default function CarrierTripDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: trip, isLoading } = useTrip(id);
  const updateStatus = useUpdateTripStatus();
  const cancelTrip = useCancelTrip();

  if (isLoading || !trip) return <LoadingSpinner fullScreen />;

  const validNextStatuses = getValidNextTripStatuses(trip.status as TripStatus);
  const canCancel = canCancelTrip(trip.status as TripStatus);

  const handleStatusChange = (newStatus: string) => {
    Alert.alert(
      "Update Status",
      `Change trip status to ${formatTripStatus(newStatus)}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: () => {
            updateStatus.mutate(
              { id: id!, status: newStatus },
              { onError: (err) => Alert.alert("Error", err.message) }
            );
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    Alert.alert("Cancel Trip", "Are you sure you want to cancel this trip?", [
      { text: "Back", style: "cancel" },
      {
        text: "Cancel Trip",
        style: "destructive",
        onPress: () => {
          cancelTrip.mutate(
            { id: id!, reason: "Cancelled by carrier" },
            { onError: (err: Error) => Alert.alert("Error", err.message) }
          );
        },
      },
    ]);
  };

  const statusActionMap: Record<
    string,
    { label: string; icon: keyof typeof Ionicons.glyphMap }
  > = {
    PICKUP_PENDING: { label: "Start Trip", icon: "play-circle" },
    IN_TRANSIT: { label: "Mark Picked Up", icon: "checkmark-circle" },
    DELIVERED: { label: "Mark Delivered", icon: "flag" },
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.route}>
            {trip.pickupCity ?? "N/A"} → {trip.deliveryCity ?? "N/A"}
          </Text>
          <StatusBadge status={trip.status} type="trip" size="md" />
        </View>
      </Card>

      {/* Details */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Trip Details</Text>
        {trip.startedAt && (
          <DetailRow label="Started" value={formatDate(trip.startedAt)} />
        )}
        {trip.pickedUpAt && (
          <DetailRow label="Picked Up" value={formatDate(trip.pickedUpAt)} />
        )}
        {trip.deliveredAt && (
          <DetailRow label="Delivered" value={formatDate(trip.deliveredAt)} />
        )}
        <DetailRow
          label="Distance"
          value={formatDistance(trip.estimatedDistanceKm)}
        />
        {trip.truck && (
          <DetailRow label="Truck" value={trip.truck.licensePlate ?? "N/A"} />
        )}
      </Card>

      {/* Action Buttons */}
      {validNextStatuses.length > 0 && (
        <View style={styles.actions}>
          {validNextStatuses
            .filter((s) => s !== "CANCELLED")
            .map((status) => {
              const action = statusActionMap[status];
              return (
                <Button
                  key={status}
                  title={action?.label ?? formatTripStatus(status)}
                  onPress={() => handleStatusChange(status)}
                  loading={updateStatus.isPending}
                  fullWidth
                  size="lg"
                  icon={
                    action ? (
                      <Ionicons
                        name={action.icon}
                        size={20}
                        color={colors.white}
                      />
                    ) : undefined
                  }
                />
              );
            })}

          {canCancel && (
            <Button
              title="Cancel Trip"
              onPress={handleCancel}
              variant="destructive"
              loading={cancelTrip.isPending}
              fullWidth
              size="md"
              style={{ marginTop: spacing.sm }}
            />
          )}
        </View>
      )}

      <View style={{ height: spacing["3xl"] }} />
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
  actions: { padding: spacing.lg, gap: spacing.md },
});

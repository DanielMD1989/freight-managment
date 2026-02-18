/**
 * Truck Details Screen (Carrier)
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useTruck, useDeleteTruck } from "../../../src/hooks/useTrucks";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { formatTruckType, formatWeight } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

export default function TruckDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: truck, isLoading } = useTruck(id);
  const deleteTruck = useDeleteTruck();

  if (isLoading || !truck) return <LoadingSpinner fullScreen />;

  const handleDelete = () => {
    Alert.alert("Delete Truck", "Are you sure you want to delete this truck?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () => {
          deleteTruck.mutate(id!, {
            onSuccess: () => router.back(),
            onError: (err) => Alert.alert("Error", err.message),
          });
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.licensePlate}>{truck.licensePlate}</Text>
          <StatusBadge
            status={
              truck.approvalStatus === "APPROVED"
                ? truck.isAvailable
                  ? "ACTIVE"
                  : "IN_TRANSIT"
                : truck.approvalStatus
            }
            size="md"
          />
        </View>

        <DetailRow
          label="Truck Type"
          value={formatTruckType(truck.truckType)}
        />
        <DetailRow label="Capacity" value={formatWeight(truck.capacity)} />
        {truck.volume && (
          <DetailRow label="Volume" value={`${truck.volume} m³`} />
        )}
        {truck.lengthM && (
          <DetailRow label="Length" value={`${truck.lengthM} m`} />
        )}
        {truck.currentCity && (
          <DetailRow label="Current City" value={truck.currentCity} />
        )}
        {truck.ownerName && <DetailRow label="Owner" value={truck.ownerName} />}
        {truck.contactPhone && (
          <DetailRow label="Contact" value={truck.contactPhone} />
        )}
        {truck.imei && <DetailRow label="GPS IMEI" value={truck.imei} />}
      </Card>

      <View style={styles.actions}>
        <Button
          title="Delete Truck"
          onPress={handleDelete}
          variant="destructive"
          loading={deleteTruck.isPending}
          fullWidth
        />
      </View>
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
  card: { margin: spacing.lg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  licensePlate: { ...typography.headlineMedium, color: colors.textPrimary },
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

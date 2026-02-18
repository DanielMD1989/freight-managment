/**
 * Load Details Screen (Carrier view)
 * Shows load info + request action buttons
 */
import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLoad, useCreateLoadRequest } from "../../../src/hooks/useLoads";
import { useTrucks } from "../../../src/hooks/useTrucks";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import {
  formatTruckType,
  formatWeight,
  formatDistance,
  formatDate,
} from "../../../src/utils/format";
import type { Truck } from "../../../src/types";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

export default function LoadDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: load, isLoading } = useLoad(id);
  const { data: trucksData } = useTrucks();
  const createRequest = useCreateLoadRequest();
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);

  if (isLoading || !load) {
    return <LoadingSpinner fullScreen />;
  }

  const availableTrucks =
    trucksData?.trucks?.filter(
      (truck: Truck) => truck.isAvailable && truck.approvalStatus === "APPROVED"
    ) ?? [];

  const handleRequestLoad = () => {
    if (!selectedTruckId && availableTrucks.length > 0) {
      setSelectedTruckId(availableTrucks[0].id);
    }

    const truckId = selectedTruckId ?? availableTrucks[0]?.id;
    if (!truckId) {
      Alert.alert(
        "No Trucks",
        "You need an available truck to request this load"
      );
      return;
    }

    Alert.alert("Request Load", "Send a request for this load?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Request",
        onPress: () => {
          createRequest.mutate(
            { loadId: id!, truckId },
            {
              onSuccess: () => {
                Alert.alert("Success", "Load request sent!");
                router.back();
              },
              onError: (err) => {
                Alert.alert("Error", err.message);
              },
            }
          );
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Card style={styles.headerCard}>
        <View style={styles.routeRow}>
          <View style={styles.routePoint}>
            <Ionicons name="radio-button-on" size={16} color={colors.success} />
            <Text style={styles.routeCity}>{load.pickupCity ?? "N/A"}</Text>
          </View>
          <View style={styles.routePoint}>
            <Ionicons name="location" size={16} color={colors.error} />
            <Text style={styles.routeCity}>{load.deliveryCity ?? "N/A"}</Text>
          </View>
        </View>
        <StatusBadge
          status={load.status}
          type="load"
          size="md"
          style={{ marginTop: spacing.sm }}
        />
      </Card>

      {/* Details */}
      <Card style={styles.detailsCard}>
        <Text style={styles.sectionTitle}>Load Details</Text>
        <DetailRow label="Truck Type" value={formatTruckType(load.truckType)} />
        <DetailRow label="Weight" value={formatWeight(load.weight)} />
        <DetailRow
          label="Distance"
          value={formatDistance(load.estimatedTripKm)}
        />
        <DetailRow label="Cargo" value={load.cargoDescription} />
        <DetailRow label="Load Type" value={load.fullPartial} />
        <DetailRow label="Book Mode" value={load.bookMode} />
        <DetailRow label="Pickup Date" value={formatDate(load.pickupDate)} />
        <DetailRow
          label="Delivery Date"
          value={formatDate(load.deliveryDate)}
        />
        {load.pickupAddress && (
          <DetailRow label="Pickup Address" value={load.pickupAddress} />
        )}
        {load.deliveryAddress && (
          <DetailRow label="Delivery Address" value={load.deliveryAddress} />
        )}
        {load.specialInstructions && (
          <DetailRow label="Instructions" value={load.specialInstructions} />
        )}
      </Card>

      {/* Request Button */}
      {load.status === "POSTED" && (
        <View style={styles.actionSection}>
          {availableTrucks.length > 0 ? (
            <>
              <Text style={styles.truckSelect}>
                Select truck:{" "}
                {availableTrucks.find(
                  (truck: Truck) =>
                    truck.id === (selectedTruckId ?? availableTrucks[0]?.id)
                )?.licensePlate ?? "None"}
              </Text>
              <Button
                title="Request This Load"
                onPress={handleRequestLoad}
                loading={createRequest.isPending}
                fullWidth
                size="lg"
              />
            </>
          ) : (
            <Text style={styles.noTrucks}>
              No available trucks. Add a truck first.
            </Text>
          )}
        </View>
      )}

      <View style={{ height: spacing["3xl"] }} />
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
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  headerCard: {
    margin: spacing.lg,
  },
  routeRow: {
    gap: spacing.md,
  },
  routePoint: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  routeCity: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  detailsCard: {
    marginHorizontal: spacing.lg,
  },
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
  detailLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
  },
  actionSection: {
    margin: spacing.lg,
  },
  truckSelect: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  noTrucks: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: "center",
  },
});

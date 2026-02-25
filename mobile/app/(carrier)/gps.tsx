/**
 * Carrier GPS Tracking Screen
 * Shows trucks with GPS device info, last seen timestamps, summary cards
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  RefreshControl,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useCarrierGPS } from "../../src/hooks/useTracking";
import type { TruckWithGPS } from "../../src/services/tracking";
import { Card } from "../../src/components/Card";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { EmptyState } from "../../src/components/EmptyState";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

function getLastSeenInfo(lastSeenAt: string): {
  color: string;
  label: string;
} {
  const now = new Date();
  const lastSeen = new Date(lastSeenAt);
  const minutesAgo = (now.getTime() - lastSeen.getTime()) / (1000 * 60);

  if (minutesAgo < 10) {
    return { color: colors.success, label: "Active" };
  } else if (minutesAgo < 60) {
    return { color: colors.warning, label: `${Math.round(minutesAgo)}m ago` };
  } else if (minutesAgo < 1440) {
    return {
      color: colors.warning,
      label: `${Math.round(minutesAgo / 60)}h ago`,
    };
  } else {
    return {
      color: colors.error,
      label: `${Math.round(minutesAgo / 1440)}d ago`,
    };
  }
}

export default function CarrierGPSScreen() {
  const { data, isLoading, refetch, isRefetching } = useCarrierGPS();

  const trucks = data?.trucks ?? [];
  const trucksWithGPS = trucks.filter((t) => t.gpsDevice !== null);
  const trucksWithoutGPS = trucks.filter((t) => t.gpsDevice === null);

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Summary Cards */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard} padding="lg">
          <Ionicons name="bus" size={24} color={colors.primary500} />
          <Text style={styles.summaryValue}>{trucks.length}</Text>
          <Text style={styles.summaryLabel}>Total Trucks</Text>
        </Card>
        <Card style={styles.summaryCard} padding="lg">
          <Ionicons name="navigate" size={24} color={colors.success} />
          <Text style={styles.summaryValue}>{trucksWithGPS.length}</Text>
          <Text style={styles.summaryLabel}>GPS Enabled</Text>
        </Card>
        <Card style={styles.summaryCard} padding="lg">
          <Ionicons name="alert-circle" size={24} color={colors.slate400} />
          <Text style={styles.summaryValue}>{trucksWithoutGPS.length}</Text>
          <Text style={styles.summaryLabel}>No GPS</Text>
        </Card>
      </View>

      {/* Auto-refresh indicator */}
      <View style={styles.refreshNote}>
        <View style={styles.liveDot} />
        <Text style={styles.refreshText}>Auto-refreshing every 30 seconds</Text>
      </View>

      {/* Trucks with GPS */}
      {trucksWithGPS.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Tracked Trucks ({trucksWithGPS.length})
          </Text>
          {trucksWithGPS.map((truck) => (
            <TruckGPSCard key={truck.id} truck={truck} />
          ))}
        </>
      )}

      {/* Trucks without GPS */}
      {trucksWithoutGPS.length > 0 && (
        <>
          <Text style={styles.sectionTitle}>
            Without GPS ({trucksWithoutGPS.length})
          </Text>
          {trucksWithoutGPS.map((truck) => (
            <Card key={truck.id} style={styles.truckCard}>
              <View style={styles.truckRow}>
                <View>
                  <Text style={styles.licensePlate}>{truck.licensePlate}</Text>
                  <Text style={styles.truckType}>
                    {truck.truckType.replace(/_/g, " ")}
                  </Text>
                </View>
                <Text style={styles.noGpsLabel}>No GPS device</Text>
              </View>
            </Card>
          ))}
        </>
      )}

      {/* Empty state */}
      {trucks.length === 0 && (
        <EmptyState
          icon="navigate-outline"
          title="No trucks yet"
          message="Add trucks to your fleet to start GPS tracking"
        />
      )}

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

function TruckGPSCard({ truck }: { truck: TruckWithGPS }) {
  const device = truck.gpsDevice!;
  const lastSeen = getLastSeenInfo(device.lastSeenAt);

  return (
    <Card style={styles.truckCard}>
      <View style={styles.truckHeader}>
        <View>
          <Text style={styles.licensePlate}>{truck.licensePlate}</Text>
          <Text style={styles.truckType}>
            {truck.truckType.replace(/_/g, " ")}
          </Text>
        </View>
        <View
          style={[
            styles.statusChip,
            { backgroundColor: lastSeen.color + "20" },
          ]}
        >
          <View
            style={[styles.statusDot, { backgroundColor: lastSeen.color }]}
          />
          <Text style={[styles.statusChipText, { color: lastSeen.color }]}>
            {lastSeen.label}
          </Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <DetailItem label="IMEI" value={device.imei} />
        <DetailItem label="Status" value={device.status} />
        <DetailItem label="Location" value={truck.currentCity || "Unknown"} />
        <DetailItem
          label="Availability"
          value={truck.isAvailable ? "Available" : "In Use"}
        />
      </View>

      <Text style={styles.lastUpdate}>
        Last update: {new Date(device.lastSeenAt).toLocaleString()}
      </Text>
    </Card>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
  },
  summaryCard: {
    flex: 1,
    alignItems: "center",
  },
  summaryValue: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  summaryLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  refreshNote: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.success,
  },
  refreshText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  truckCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  truckRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  truckHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  licensePlate: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  truckType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusChipText: {
    ...typography.labelSmall,
    fontWeight: "600",
  },
  noGpsLabel: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  detailsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  detailItem: {
    width: "50%",
    marginBottom: spacing.sm,
  },
  detailLabel: {
    ...typography.labelSmall,
    color: colors.textTertiary,
    marginBottom: 2,
  },
  detailValue: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  lastUpdate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    paddingTop: spacing.sm,
  },
});

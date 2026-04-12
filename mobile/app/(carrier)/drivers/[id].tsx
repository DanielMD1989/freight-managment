/**
 * Driver Detail Screen — Task 22
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Alert,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  Card,
  StatusBadge,
  Button,
  LoadingSpinner,
} from "../../../src/components";
import { colors, spacing, typography } from "../../../src/theme";
import {
  useDriver,
  useApproveDriver,
  useRejectDriver,
  useSuspendDriver,
} from "../../../src/hooks";
import { formatDate } from "../../../src/utils/format";

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export default function DriverDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: driver, isLoading, refetch } = useDriver(id);
  const approveDriver = useApproveDriver();
  const rejectDriver = useRejectDriver();
  const suspendDriver = useSuspendDriver();

  if (isLoading || !driver) {
    return <LoadingSpinner fullScreen message="Loading driver..." />;
  }

  const name =
    [driver.firstName, driver.lastName].filter(Boolean).join(" ") ||
    "(no name)";

  const handleApprove = () => {
    Alert.alert("Approve Driver", `Approve ${name}?`, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: () =>
          approveDriver.mutateAsync(driver.id).then(() => refetch()),
      },
    ]);
  };

  const handleReject = () => {
    Alert.prompt(
      "Reject Driver",
      "Enter rejection reason:",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: (reason: string | undefined) => {
            if (reason?.trim()) {
              rejectDriver
                .mutateAsync({ driverId: driver.id, reason: reason.trim() })
                .then(() => refetch());
            }
          },
        },
      ],
      "plain-text"
    );
  };

  const handleSuspend = () => {
    Alert.alert(
      "Suspend Driver",
      `Suspend ${name}? Their access will be revoked.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Suspend",
          style: "destructive",
          onPress: () =>
            suspendDriver.mutateAsync(driver.id).then(() => router.back()),
        },
      ]
    );
  };

  const profile = driver.driverProfile;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} />
      }
    >
      {/* Header */}
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.name}>{name}</Text>
          <StatusBadge status={driver.status} />
        </View>
        <DetailRow label="Phone" value={driver.phone ?? "-"} />
        <DetailRow label="Email" value={driver.email ?? "-"} />
        <DetailRow label="Joined" value={formatDate(driver.createdAt)} />
      </Card>

      {/* CDL Profile */}
      {profile && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Driver Profile</Text>
          <DetailRow
            label="Availability"
            value={profile.isAvailable ? "Available" : "Unavailable"}
          />
          <DetailRow label="CDL Number" value={profile.cdlNumber ?? "-"} />
          <DetailRow label="CDL State" value={profile.cdlState ?? "-"} />
          <DetailRow
            label="CDL Expiry"
            value={profile.cdlExpiry ? formatDate(profile.cdlExpiry) : "-"}
          />
          <DetailRow
            label="Medical Cert Expiry"
            value={
              profile.medicalCertExp ? formatDate(profile.medicalCertExp) : "-"
            }
          />
        </Card>
      )}

      {/* Active Trips */}
      {driver.activeTrips && driver.activeTrips.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            Active Trips ({driver.activeTrips.length})
          </Text>
          {driver.activeTrips.map(
            (trip: {
              id: string;
              status: string;
              load?: { pickupCity?: string; deliveryCity?: string } | null;
              truck?: { licensePlate?: string } | null;
            }) => (
              <View key={trip.id} style={styles.tripRow}>
                <Text style={styles.tripRoute}>
                  {trip.load?.pickupCity ?? "?"} &rarr;{" "}
                  {trip.load?.deliveryCity ?? "?"}
                </Text>
                <StatusBadge status={trip.status} type="trip" size="sm" />
              </View>
            )
          )}
        </Card>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        {driver.status === "PENDING_VERIFICATION" && (
          <>
            <Button
              title="Approve"
              onPress={handleApprove}
              variant="primary"
              fullWidth
            />
            <Button
              title="Reject"
              onPress={handleReject}
              variant="destructive"
              fullWidth
            />
          </>
        )}
        {driver.status === "ACTIVE" && (
          <Button
            title="Suspend Driver"
            onPress={handleSuspend}
            variant="destructive"
            fullWidth
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  name: { ...typography.headlineSmall, color: colors.textPrimary },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  detailLabel: { ...typography.bodyMedium, color: colors.textSecondary },
  detailValue: { ...typography.bodyMedium, color: colors.textPrimary },
  tripRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  tripRoute: { ...typography.bodyMedium, color: colors.textPrimary },
  actions: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
    gap: spacing.md,
  },
});

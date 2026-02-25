/**
 * Shipper Request Detail Screen
 * Shows full details of a load request (from carrier) or truck request (to carrier)
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  Alert,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useTruckRequest } from "../../../src/hooks/useTrucks";
import { useRespondToLoadRequest } from "../../../src/hooks/useLoads";
import { useCancelTruckRequest } from "../../../src/hooks/useTrucks";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Button } from "../../../src/components/Button";
import { formatCurrency, formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

export default function RequestDetailScreen() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: string }>();
  const { t } = useTranslation();
  const router = useRouter();

  // For truck requests (shipper's outgoing), fetch from API
  const {
    data: truckReqData,
    isLoading,
    refetch,
    isRefetching,
  } = useTruckRequest(type === "truck" ? id : undefined);

  const respondMutation = useRespondToLoadRequest();
  const cancelMutation = useCancelTruckRequest();

  // For load requests, data is passed via query params (from list cache)
  const {
    loadPickupCity,
    loadDeliveryCity,
    loadTruckType,
    loadStatus,
    truckPlate,
    truckType: truckTypeParam,
    carrierName,
    status: statusParam,
    proposedRate,
    notes: notesParam,
    createdAt: createdAtParam,
  } = useLocalSearchParams<{
    loadPickupCity?: string;
    loadDeliveryCity?: string;
    loadTruckType?: string;
    loadStatus?: string;
    truckPlate?: string;
    truckType?: string;
    carrierName?: string;
    status?: string;
    proposedRate?: string;
    notes?: string;
    createdAt?: string;
  }>();

  const handleApprove = (requestId: string) => {
    Alert.alert("Approve Request", "Accept this carrier's application?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Approve",
        onPress: () =>
          respondMutation.mutate(
            { requestId, action: "APPROVED" },
            {
              onSuccess: () => {
                Alert.alert("Success", "Request approved successfully");
                router.back();
              },
              onError: (err) => Alert.alert("Error", err.message),
            }
          ),
      },
    ]);
  };

  const handleReject = (requestId: string) => {
    Alert.alert("Reject Request", "Reject this carrier's application?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () =>
          respondMutation.mutate(
            { requestId, action: "REJECTED" },
            {
              onSuccess: () => {
                Alert.alert("Rejected", "Request has been rejected");
                router.back();
              },
              onError: (err) => Alert.alert("Error", err.message),
            }
          ),
      },
    ]);
  };

  const handleCancel = (requestId: string) => {
    Alert.alert("Cancel Request", "Cancel this truck request?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Cancel Request",
        style: "destructive",
        onPress: () =>
          cancelMutation.mutate(requestId, {
            onSuccess: () => {
              Alert.alert("Cancelled", "Request has been cancelled");
              router.back();
            },
            onError: (err) => Alert.alert("Error", err.message),
          }),
      },
    ]);
  };

  // Truck request detail (fetched from API)
  if (type === "truck") {
    if (isLoading) return <LoadingSpinner fullScreen />;

    const req = truckReqData?.request;
    if (!req) {
      return (
        <EmptyState
          icon="alert-circle-outline"
          title="Request Not Found"
          message="This request may have been removed"
        />
      );
    }

    return (
      <ScrollView
        style={styles.container}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        {/* Status Header */}
        <View style={styles.statusHeader}>
          <StatusBadge status={req.status} type="generic" />
          <Text style={styles.requestType}>Truck Request</Text>
        </View>

        {/* Route */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Route</Text>
          <Text style={styles.routeText}>
            {req.load?.pickupCity ?? "\u2014"} {"\u2192"}{" "}
            {req.load?.deliveryCity ?? "\u2014"}
          </Text>
        </Card>

        {/* Load Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Load Details</Text>
          <DetailRow
            icon="cube-outline"
            label="Truck Type"
            value={req.load?.truckType ?? "\u2014"}
          />
          <DetailRow
            icon="calendar-outline"
            label="Pickup Date"
            value={formatDate(req.load?.pickupDate)}
          />
          <DetailRow
            icon="flag-outline"
            label="Load Status"
            value={req.load?.status ?? "\u2014"}
          />
        </Card>

        {/* Truck Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Truck</Text>
          <DetailRow
            icon="bus-outline"
            label="License Plate"
            value={req.truck?.licensePlate ?? "\u2014"}
          />
          <DetailRow
            icon="construct-outline"
            label="Type"
            value={req.truck?.truckType ?? "\u2014"}
          />
        </Card>

        {/* Carrier Info */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Carrier</Text>
          <DetailRow
            icon="business-outline"
            label="Name"
            value={req.carrier?.name ?? "\u2014"}
          />
        </Card>

        {/* Request Details */}
        <Card style={styles.section}>
          <Text style={styles.sectionTitle}>Request Info</Text>
          {req.notes && (
            <DetailRow
              icon="document-text-outline"
              label="Notes"
              value={req.notes}
            />
          )}
          {req.offeredRate != null && (
            <DetailRow
              icon="cash-outline"
              label="Offered Rate"
              value={formatCurrency(req.offeredRate)}
            />
          )}
          <DetailRow
            icon="time-outline"
            label="Created"
            value={formatDate(req.createdAt)}
          />
          <DetailRow
            icon="hourglass-outline"
            label="Expires"
            value={formatDate(req.expiresAt)}
          />
          {req.respondedAt && (
            <DetailRow
              icon="checkmark-done-outline"
              label="Responded"
              value={formatDate(req.respondedAt)}
            />
          )}
          {req.responseNotes && (
            <DetailRow
              icon="chatbubble-outline"
              label="Response Notes"
              value={req.responseNotes}
            />
          )}
        </Card>

        {/* Actions */}
        {req.status === "PENDING" && (
          <View style={styles.actionRow}>
            <Button
              title="Cancel Request"
              variant="destructive"
              onPress={() => handleCancel(req.id)}
              loading={cancelMutation.isPending}
              fullWidth
            />
          </View>
        )}

        <View style={{ height: spacing["3xl"] }} />
      </ScrollView>
    );
  }

  // Load request detail (data passed via query params from list)
  return (
    <ScrollView style={styles.container}>
      {/* Status Header */}
      <View style={styles.statusHeader}>
        <StatusBadge status={statusParam ?? "PENDING"} type="generic" />
        <Text style={styles.requestType}>Carrier Application</Text>
      </View>

      {/* Route */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Route</Text>
        <Text style={styles.routeText}>
          {loadPickupCity ?? "\u2014"} {"\u2192"} {loadDeliveryCity ?? "\u2014"}
        </Text>
      </Card>

      {/* Load Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Load Details</Text>
        {loadTruckType && (
          <DetailRow
            icon="cube-outline"
            label="Truck Type"
            value={loadTruckType}
          />
        )}
        {loadStatus && (
          <DetailRow icon="flag-outline" label="Status" value={loadStatus} />
        )}
      </Card>

      {/* Carrier Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Carrier</Text>
        <DetailRow
          icon="business-outline"
          label="Name"
          value={carrierName ?? "\u2014"}
        />
        {truckPlate && (
          <DetailRow icon="bus-outline" label="Truck" value={truckPlate} />
        )}
        {truckTypeParam && (
          <DetailRow
            icon="construct-outline"
            label="Truck Type"
            value={truckTypeParam}
          />
        )}
      </Card>

      {/* Request Info */}
      <Card style={styles.section}>
        <Text style={styles.sectionTitle}>Request Info</Text>
        {proposedRate && (
          <DetailRow
            icon="cash-outline"
            label="Proposed Rate"
            value={formatCurrency(Number(proposedRate))}
          />
        )}
        {notesParam && (
          <DetailRow
            icon="document-text-outline"
            label="Notes"
            value={notesParam}
          />
        )}
        {createdAtParam && (
          <DetailRow
            icon="time-outline"
            label="Created"
            value={formatDate(createdAtParam)}
          />
        )}
      </Card>

      {/* Actions for PENDING load requests */}
      {statusParam === "PENDING" && id && (
        <View style={styles.actionRow}>
          <Button
            title="Approve"
            variant="primary"
            onPress={() => handleApprove(id)}
            loading={respondMutation.isPending}
            style={{ flex: 1, marginRight: spacing.sm }}
          />
          <Button
            title="Reject"
            variant="destructive"
            onPress={() => handleReject(id)}
            loading={respondMutation.isPending}
            style={{ flex: 1 }}
          />
        </View>
      )}

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: string;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons
        name={icon as keyof typeof Ionicons.glyphMap}
        size={16}
        color={colors.slate400}
      />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing["2xl"],
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
  },
  requestType: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
  section: {
    marginHorizontal: spacing["2xl"],
    marginTop: spacing.md,
  },
  sectionTitle: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  routeText: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  detailLabel: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    width: 100,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  actionRow: {
    flexDirection: "row",
    marginHorizontal: spacing["2xl"],
    marginTop: spacing.lg,
  },
});

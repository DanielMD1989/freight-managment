/**
 * Shipper Load Details Screen
 * Includes request management (accept/reject carrier requests)
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  useLoad,
  useLoadRequests,
  useRespondToLoadRequest,
  useUpdateLoad,
  useDeleteLoad,
} from "../../../src/hooks/useLoads";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { Button } from "../../../src/components/Button";
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
import type { LoadRequest } from "../../../src/types";

export default function ShipperLoadDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { data: load, isLoading, refetch } = useLoad(id);
  const { data: requestsData, refetch: refetchRequests } = useLoadRequests(id);
  const respondMutation = useRespondToLoadRequest();
  const updateLoad = useUpdateLoad();
  const deleteLoad = useDeleteLoad();
  const [respondingId, setRespondingId] = useState<string | null>(null);

  if (isLoading || !load) return <LoadingSpinner fullScreen />;

  const requests = requestsData?.requests ?? [];
  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const otherRequests = requests.filter((r) => r.status !== "PENDING");

  const handleRespond = (
    requestId: string,
    action: "APPROVED" | "REJECTED"
  ) => {
    const label = action === "APPROVED" ? "approve" : "reject";
    Alert.alert(
      `${action === "APPROVED" ? "Approve" : "Reject"} Request`,
      `Are you sure you want to ${label} this request?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: action === "APPROVED" ? "Approve" : "Reject",
          style: action === "REJECTED" ? "destructive" : "default",
          onPress: () => {
            setRespondingId(requestId);
            respondMutation.mutate(
              { requestId, action },
              {
                onSuccess: () => {
                  setRespondingId(null);
                  refetchRequests();
                  refetch();
                },
                onError: (err) => {
                  setRespondingId(null);
                  Alert.alert("Error", err.message);
                },
              }
            );
          },
        },
      ]
    );
  };

  const handlePostLoad = () => {
    if (load.status !== "DRAFT") return;
    Alert.alert("Post Load", "Post this load to the marketplace?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Post",
        onPress: () => {
          updateLoad.mutate(
            { id: load.id, data: { status: "POSTED" } as never },
            {
              onSuccess: () => refetch(),
              onError: (err) => Alert.alert("Error", err.message),
            }
          );
        },
      },
    ]);
  };

  const handleDelete = () => {
    Alert.alert(
      "Delete Load",
      "Are you sure you want to delete this load? This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteLoad.mutate(load.id, {
              onSuccess: () => router.back(),
              onError: (err) => Alert.alert("Error", err.message),
            });
          },
        },
      ]
    );
  };

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
        <DetailRow
          label="Load Type"
          value={load.fullPartial === "PARTIAL" ? "Partial" : "Full"}
        />
        <DetailRow
          label="Book Mode"
          value={load.bookMode === "INSTANT" ? "Instant" : "Request"}
        />
        {load.isFragile && <DetailRow label="Fragile" value="Yes" />}
        {load.requiresRefrigeration && (
          <DetailRow label="Refrigeration" value="Required" />
        )}
        {load.appointmentRequired && (
          <DetailRow label="Appointment" value="Required" />
        )}
        {load.volume && (
          <DetailRow label="Volume" value={`${load.volume} m³`} />
        )}
        {load.shipperContactName && (
          <DetailRow label="Contact" value={load.shipperContactName} />
        )}
        {load.shipperContactPhone && (
          <DetailRow label="Phone" value={load.shipperContactPhone} />
        )}
        {load.specialInstructions && (
          <DetailRow label="Instructions" value={load.specialInstructions} />
        )}
      </Card>

      {/* Action buttons */}
      <View style={styles.actionsRow}>
        {load.status === "DRAFT" && (
          <Button
            title="Post Load"
            onPress={handlePostLoad}
            variant="primary"
            loading={updateLoad.isPending}
            icon={
              <Ionicons
                name="megaphone-outline"
                size={18}
                color={colors.white}
              />
            }
            style={styles.actionBtn}
          />
        )}
        <Button
          title="Edit"
          onPress={() => router.push(`/(shipper)/loads/edit?id=${load.id}`)}
          variant="outline"
          icon={
            <Ionicons
              name="create-outline"
              size={18}
              color={colors.primary600}
            />
          }
          style={styles.actionBtn}
        />
        <Button
          title="Delete"
          onPress={handleDelete}
          variant="destructive"
          loading={deleteLoad.isPending}
          icon={
            <Ionicons name="trash-outline" size={18} color={colors.white} />
          }
          style={styles.actionBtn}
        />
      </View>

      {/* Pending requests - prominent */}
      {pendingRequests.length > 0 && (
        <Card style={styles.card}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              Pending Requests ({pendingRequests.length})
            </Text>
            <View style={styles.pendingBadge}>
              <Text style={styles.pendingBadgeText}>Action Required</Text>
            </View>
          </View>
          {pendingRequests.map((req) => (
            <RequestCard
              key={req.id}
              request={req}
              onApprove={() => handleRespond(req.id, "APPROVED")}
              onReject={() => handleRespond(req.id, "REJECTED")}
              isLoading={respondingId === req.id}
            />
          ))}
        </Card>
      )}

      {/* Other requests */}
      {otherRequests.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            Past Requests ({otherRequests.length})
          </Text>
          {otherRequests.map((req) => (
            <View key={req.id} style={styles.requestRow}>
              <StatusBadge status={req.status} />
              <Text style={styles.requestDate}>
                {formatDate(req.createdAt)}
              </Text>
              {req.proposedRate && (
                <Text style={styles.requestRate}>{req.proposedRate} ETB</Text>
              )}
            </View>
          ))}
        </Card>
      )}

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

function RequestCard({
  request,
  onApprove,
  onReject,
  isLoading,
}: {
  request: LoadRequest;
  onApprove: () => void;
  onReject: () => void;
  isLoading: boolean;
}) {
  return (
    <View style={styles.requestCard}>
      <View style={styles.requestInfo}>
        <View style={styles.requestMainRow}>
          <Ionicons name="person-circle" size={32} color={colors.slate400} />
          <View style={{ flex: 1 }}>
            <Text style={styles.requestCarrier}>
              {(
                request as LoadRequest & {
                  carrier?: { organizationName?: string };
                }
              ).carrier?.organizationName ?? "Carrier"}
            </Text>
            <Text style={styles.requestDate}>
              {formatDate(request.createdAt)}
            </Text>
          </View>
        </View>
        {request.proposedRate && (
          <View style={styles.rateRow}>
            <Ionicons name="cash-outline" size={16} color={colors.accent600} />
            <Text style={styles.rateText}>
              Proposed: {request.proposedRate} ETB
            </Text>
          </View>
        )}
        {request.notes && (
          <Text style={styles.requestNotes} numberOfLines={2}>
            {request.notes}
          </Text>
        )}
      </View>
      <View style={styles.requestActions}>
        <TouchableOpacity
          style={[styles.approveBtn, isLoading && styles.btnDisabled]}
          onPress={onApprove}
          disabled={isLoading}
        >
          <Ionicons name="checkmark" size={20} color={colors.white} />
          <Text style={styles.approveBtnText}>Approve</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.rejectBtn, isLoading && styles.btnDisabled]}
          onPress={onReject}
          disabled={isLoading}
        >
          <Ionicons name="close" size={20} color={colors.error} />
          <Text style={styles.rejectBtnText}>Reject</Text>
        </TouchableOpacity>
      </View>
    </View>
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
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  pendingBadge: {
    backgroundColor: colors.warning + "20",
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 12,
    marginBottom: spacing.md,
  },
  pendingBadgeText: {
    ...typography.labelSmall,
    color: colors.warning,
    fontWeight: "600",
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
  actionsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    margin: spacing.lg,
  },
  actionBtn: { flex: 1, minWidth: 100 },
  requestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  requestDate: { ...typography.bodySmall, color: colors.textSecondary },
  requestRate: {
    ...typography.labelSmall,
    color: colors.accent600,
    marginLeft: "auto",
  },
  requestCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  requestInfo: { marginBottom: spacing.md },
  requestMainRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  requestCarrier: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  rateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  rateText: { ...typography.bodySmall, color: colors.accent600 },
  requestNotes: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  requestActions: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  approveBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.success,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  approveBtnText: {
    ...typography.labelMedium,
    color: colors.white,
  },
  rejectBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.error,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  rejectBtnText: {
    ...typography.labelMedium,
    color: colors.error,
  },
  btnDisabled: { opacity: 0.5 },
});

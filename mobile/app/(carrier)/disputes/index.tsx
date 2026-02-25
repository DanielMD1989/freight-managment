/**
 * Carrier Disputes List Screen
 * Status filter chips, create form, and dispute cards
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDisputes, useCreateDispute } from "../../../src/hooks/useDisputes";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing, borderRadius } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { Dispute, DisputeType } from "../../../src/types";

const STATUS_FILTERS = [
  "ALL",
  "OPEN",
  "UNDER_REVIEW",
  "RESOLVED",
  "CLOSED",
] as const;

const DISPUTE_TYPES: { label: string; value: DisputeType }[] = [
  { label: "Payment Issue", value: "PAYMENT_ISSUE" },
  { label: "Damage", value: "DAMAGE" },
  { label: "Late Delivery", value: "LATE_DELIVERY" },
  { label: "Other", value: "OTHER" },
];

export default function CarrierDisputesListScreen() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [loadId, setLoadId] = useState("");
  const [disputeType, setDisputeType] = useState<DisputeType>("PAYMENT_ISSUE");
  const [description, setDescription] = useState("");

  const queryParams =
    statusFilter === "ALL" ? undefined : { status: statusFilter };
  const { data, isLoading, refetch, isRefetching } = useDisputes(queryParams);
  const createDispute = useCreateDispute();

  const disputes = data?.disputes ?? [];

  const handleCreate = () => {
    if (!loadId.trim()) {
      Alert.alert("Error", "Please enter a Load ID");
      return;
    }
    if (!description.trim()) {
      Alert.alert("Error", "Please enter a description");
      return;
    }

    createDispute.mutate(
      {
        loadId: loadId.trim(),
        type: disputeType,
        description: description.trim(),
      },
      {
        onSuccess: () => {
          setShowCreateForm(false);
          setLoadId("");
          setDescription("");
          Alert.alert("Success", "Dispute filed successfully");
        },
        onError: (err) => Alert.alert("Error", err.message),
      }
    );
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Status filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map((status) => (
          <TouchableOpacity
            key={status}
            style={[
              styles.filterChip,
              statusFilter === status && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(status)}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === status && styles.filterChipTextActive,
              ]}
            >
              {status === "ALL"
                ? "All"
                : status
                    .replace(/_/g, " ")
                    .replace(/\b\w/g, (c) => c.toUpperCase())}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* File Dispute button */}
      <View style={styles.actionRow}>
        <Button
          title={showCreateForm ? "Cancel" : "File Dispute"}
          onPress={() => setShowCreateForm(!showCreateForm)}
          variant={showCreateForm ? "outline" : "primary"}
          size="sm"
          icon={
            <Ionicons
              name={showCreateForm ? "close" : "add-circle-outline"}
              size={18}
              color={showCreateForm ? colors.primary600 : colors.white}
            />
          }
        />
      </View>

      {/* Create form */}
      {showCreateForm && (
        <Card style={styles.formCard}>
          <Text style={styles.formTitle}>File a Dispute</Text>

          <Text style={styles.inputLabel}>Load ID</Text>
          <TextInput
            style={styles.input}
            value={loadId}
            onChangeText={setLoadId}
            placeholder="Enter the load ID"
            placeholderTextColor={colors.textTertiary}
          />

          <Text style={styles.inputLabel}>Type</Text>
          <View style={styles.typeRow}>
            {DISPUTE_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt.value}
                style={[
                  styles.typeChip,
                  disputeType === dt.value && styles.typeChipActive,
                ]}
                onPress={() => setDisputeType(dt.value)}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    disputeType === dt.value && styles.typeChipTextActive,
                  ]}
                >
                  {dt.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.inputLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={description}
            onChangeText={setDescription}
            placeholder="Describe the issue..."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />

          <Button
            title="Submit Dispute"
            onPress={handleCreate}
            loading={createDispute.isPending}
            fullWidth
            style={{ marginTop: spacing.md }}
          />
        </Card>
      )}

      {/* Dispute list */}
      {disputes.length === 0 ? (
        <EmptyState
          icon="alert-circle-outline"
          title="No disputes"
          message="No disputes found for your loads"
        />
      ) : (
        disputes.map((dispute: Dispute) => (
          <TouchableOpacity
            key={dispute.id}
            onPress={() =>
              router.push(`/(carrier)/disputes/${dispute.id}` as `/${string}`)
            }
          >
            <Card style={styles.disputeCard}>
              <View style={styles.disputeHeader}>
                <StatusBadge status={dispute.status} />
                <Text style={styles.disputeDate}>
                  {formatDate(dispute.createdAt)}
                </Text>
              </View>
              <Text style={styles.disputeType}>
                {dispute.type.replace(/_/g, " ")}
              </Text>
              <Text style={styles.disputeDescription} numberOfLines={2}>
                {dispute.description}
              </Text>
              {dispute.loadId && (
                <View style={styles.loadRefRow}>
                  <Ionicons
                    name="cube-outline"
                    size={14}
                    color={colors.slate400}
                  />
                  <Text style={styles.loadRefText}>
                    Load: {dispute.loadId.slice(0, 8)}...
                  </Text>
                </View>
              )}
            </Card>
          </TouchableOpacity>
        ))
      )}

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  filterRow: { maxHeight: 52 },
  filterContent: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: colors.slate100,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary500,
  },
  filterChipText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  actionRow: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  formCard: {
    margin: spacing.lg,
    marginTop: 0,
  },
  formTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  inputLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: borderRadius.md,
    padding: spacing.md,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 100,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  typeChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeChipActive: {
    backgroundColor: colors.primary50,
    borderColor: colors.primary500,
  },
  typeChipText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.primary600,
  },
  disputeCard: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
  },
  disputeHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  disputeDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  disputeType: {
    ...typography.labelMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  disputeDescription: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  loadRefRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
  },
  loadRefText: {
    ...typography.labelSmall,
    color: colors.slate400,
  },
});

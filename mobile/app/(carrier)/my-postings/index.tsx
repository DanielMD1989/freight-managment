/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * My Postings Screen - Carrier's truck posting management
 * List postings with status filters, edit/cancel/duplicate actions.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  useMyTruckPostings,
  useCancelTruckPosting,
  useDuplicateTruckPosting,
} from "../../../src/hooks/useTrucks";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Button } from "../../../src/components/Button";
import { formatTruckType, formatDate } from "../../../src/utils/format";
import { useAuthStore } from "../../../src/stores/auth";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

type StatusFilter = "ALL" | "ACTIVE" | "EXPIRED" | "CANCELLED";

const STATUS_FILTERS: StatusFilter[] = [
  "ALL",
  "ACTIVE",
  "EXPIRED",
  "CANCELLED",
];

export default function MyPostingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const queryParams = {
    ...(statusFilter !== "ALL" ? { status: statusFilter } : {}),
    organizationId: user?.organizationId ?? undefined,
  };
  const { data, isLoading, refetch, isRefetching } =
    useMyTruckPostings(queryParams);

  const cancelMutation = useCancelTruckPosting();
  const duplicateMutation = useDuplicateTruckPosting();

  const postings = data?.postings ?? [];

  const handleCancel = (id: string) => {
    Alert.alert(
      "Cancel Posting",
      "Are you sure you want to cancel this posting?",
      [
        { text: t("common.cancel"), style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () =>
            cancelMutation.mutate(id, {
              onSuccess: () => Alert.alert("Success", "Posting cancelled"),
              onError: (err) =>
                Alert.alert("Error", err.message ?? "Failed to cancel"),
            }),
        },
      ]
    );
  };

  const handleDuplicate = (id: string) => {
    duplicateMutation.mutate(id, {
      onSuccess: () =>
        Alert.alert("Success", "Posting duplicated successfully"),
      onError: (err) =>
        Alert.alert("Error", err.message ?? "Failed to duplicate"),
    });
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={() => refetch()} />
      }
    >
      {/* Status Filter Chips */}
      <View style={styles.filterRow}>
        {STATUS_FILTERS.map((filter) => (
          <TouchableOpacity
            key={filter}
            style={[
              styles.filterChip,
              statusFilter === filter && styles.filterChipActive,
            ]}
            onPress={() => setStatusFilter(filter)}
          >
            <Text
              style={[
                styles.filterChipText,
                statusFilter === filter && styles.filterChipTextActive,
              ]}
            >
              {filter}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Posting List */}
      {postings.length === 0 ? (
        <EmptyState
          icon="document-text-outline"
          title="No Postings"
          message={
            statusFilter === "ALL"
              ? "You haven't created any truck postings yet"
              : `No ${statusFilter.toLowerCase()} postings found`
          }
        />
      ) : (
        postings.map((posting) => (
          <TouchableOpacity
            key={posting.id}
            activeOpacity={0.7}
            onPress={() => router.push(`/(carrier)/my-postings/${posting.id}`)}
          >
            <Card style={styles.postingCard}>
              {/* Header: Route + Status */}
              <View style={styles.postingHeader}>
                <View style={styles.routeInfo}>
                  <Text style={styles.routeText} numberOfLines={1}>
                    {posting.originCityName ??
                      (posting as any).originCity?.name ??
                      "Origin"}{" "}
                    →{" "}
                    {posting.destinationCityName ??
                      (posting as any).destinationCity?.name ??
                      "Any"}
                  </Text>
                </View>
                <StatusBadge
                  status={posting.status ?? "ACTIVE"}
                  type="generic"
                  size="sm"
                />
              </View>

              {/* Truck Info */}
              <View style={styles.detailRow}>
                <Ionicons
                  name="bus-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.detailText}>
                  {formatTruckType(posting.truck?.truckType)}{" "}
                  {posting.truck?.licensePlate
                    ? `- ${posting.truck.licensePlate}`
                    : ""}
                </Text>
              </View>

              {/* Dates */}
              <View style={styles.detailRow}>
                <Ionicons
                  name="calendar-outline"
                  size={14}
                  color={colors.textSecondary}
                />
                <Text style={styles.detailText}>
                  {formatDate(posting.availableFrom)}
                  {posting.availableTo
                    ? ` - ${formatDate(posting.availableTo)}`
                    : ""}
                </Text>
              </View>

              {/* Full/Partial */}
              {posting.fullPartial && (
                <View style={styles.detailRow}>
                  <Ionicons
                    name="cube-outline"
                    size={14}
                    color={colors.textSecondary}
                  />
                  <Text style={styles.detailText}>{posting.fullPartial}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.actionRow}>
                {posting.status === "ACTIVE" && (
                  <Button
                    title="Cancel"
                    variant="outline"
                    size="sm"
                    onPress={() => handleCancel(posting.id)}
                    loading={cancelMutation.isPending}
                    style={styles.actionBtn}
                  />
                )}
                <Button
                  title="Duplicate"
                  variant="outline"
                  size="sm"
                  onPress={() => handleDuplicate(posting.id)}
                  loading={duplicateMutation.isPending}
                  style={styles.actionBtn}
                />
                <Button
                  title="Details"
                  variant="primary"
                  size="sm"
                  onPress={() =>
                    router.push(`/(carrier)/my-postings/${posting.id}`)
                  }
                  style={styles.actionBtn}
                />
              </View>
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
  filterRow: {
    flexDirection: "row",
    paddingHorizontal: spacing["2xl"],
    paddingVertical: spacing.lg,
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.slate100,
  },
  filterChipActive: {
    backgroundColor: colors.primary600,
  },
  filterChipText: {
    ...typography.labelSmall,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
  },
  postingCard: {
    marginHorizontal: spacing["2xl"],
    marginBottom: spacing.md,
  },
  postingHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  routeInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  routeText: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  detailText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  actionRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.lg,
    flexWrap: "wrap",
  },
  actionBtn: {
    flex: 1,
    minWidth: 80,
  },
});

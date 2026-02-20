/**
 * Requests Screen - Manage carrier load requests + shipper truck requests
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
import { useTranslation } from "react-i18next";
import {
  useReceivedLoadRequests,
  useRespondToLoadRequest,
} from "../../../src/hooks/useLoads";
import {
  useMyTruckRequests,
  useCancelTruckRequest,
} from "../../../src/hooks/useTrucks";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Button } from "../../../src/components/Button";
import { formatCurrency, formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

type Tab = "carrier" | "truck";
const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

export default function RequestsScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("carrier");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filterParam = statusFilter === "ALL" ? undefined : statusFilter;

  const {
    data: loadReqData,
    isLoading: loadReqLoading,
    refetch: refetchLoadReqs,
    isRefetching: loadReqRefetching,
  } = useReceivedLoadRequests({ status: filterParam, limit: 50 });

  const {
    data: truckReqData,
    isLoading: truckReqLoading,
    refetch: refetchTruckReqs,
    isRefetching: truckReqRefetching,
  } = useMyTruckRequests({ status: filterParam });

  const respondMutation = useRespondToLoadRequest();
  const cancelMutation = useCancelTruckRequest();

  const isLoading = tab === "carrier" ? loadReqLoading : truckReqLoading;
  const isRefetching =
    tab === "carrier" ? loadReqRefetching : truckReqRefetching;
  const refetch = tab === "carrier" ? refetchLoadReqs : refetchTruckReqs;

  const loadRequests = loadReqData?.loadRequests ?? [];
  const truckRequests = (truckReqData?.requests ?? []) as Array<{
    id: string;
    status: string;
    load?: { pickupCity?: string; deliveryCity?: string };
    truck?: { licensePlate?: string; truckType?: string };
    offeredRate?: number;
    notes?: string;
    createdAt?: string;
    expiresAt?: string;
  }>;

  const handleApprove = (requestId: string) => {
    Alert.alert("Approve Request", "Accept this carrier's application?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Approve",
        onPress: () =>
          respondMutation.mutate({ requestId, action: "APPROVED" }),
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
          respondMutation.mutate({ requestId, action: "REJECTED" }),
      },
    ]);
  };

  const handleCancelTruckRequest = (requestId: string) => {
    Alert.alert("Cancel Request", "Cancel this truck request?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Cancel Request",
        style: "destructive",
        onPress: () => cancelMutation.mutate(requestId),
      },
    ]);
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Tab Switcher */}
      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tab, tab === "carrier" && styles.tabActive]}
          onPress={() => setTab("carrier")}
        >
          <Text
            style={[styles.tabText, tab === "carrier" && styles.tabTextActive]}
          >
            Carrier Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "truck" && styles.tabActive]}
          onPress={() => setTab("truck")}
        >
          <Text
            style={[styles.tabText, tab === "truck" && styles.tabTextActive]}
          >
            My Truck Requests
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterRow}
        contentContainerStyle={styles.filterContent}
      >
        {STATUS_FILTERS.map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.chip, statusFilter === s && styles.chipActive]}
            onPress={() => setStatusFilter(s)}
          >
            <Text
              style={[
                styles.chipText,
                statusFilter === s && styles.chipTextActive,
              ]}
            >
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {isLoading ? (
        <LoadingSpinner />
      ) : tab === "carrier" ? (
        loadRequests.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No Carrier Requests"
            message="Carrier applications for your loads will appear here"
          />
        ) : (
          loadRequests.map((req) => (
            <View key={req.id} style={styles.cardWrapper}>
              <Card>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardRoute} numberOfLines={1}>
                    {req.load?.pickupCity ?? "—"} →{" "}
                    {req.load?.deliveryCity ?? "—"}
                  </Text>
                  <StatusBadge status={req.status} type="generic" />
                </View>
                <Text style={styles.cardSub}>
                  {req.carrier?.name ?? "Carrier"} •{" "}
                  {req.truck?.licensePlate ?? "—"}
                </Text>
                {req.proposedRate != null && (
                  <Text style={styles.cardRate}>
                    Proposed: {formatCurrency(req.proposedRate)}
                  </Text>
                )}
                <Text style={styles.cardDate}>{formatDate(req.createdAt)}</Text>
                {req.status === "PENDING" && (
                  <View style={styles.actionRow}>
                    <Button
                      title="Approve"
                      variant="primary"
                      size="sm"
                      onPress={() => handleApprove(req.id)}
                      loading={respondMutation.isPending}
                      style={{ flex: 1, marginRight: spacing.sm }}
                    />
                    <Button
                      title="Reject"
                      variant="destructive"
                      size="sm"
                      onPress={() => handleReject(req.id)}
                      loading={respondMutation.isPending}
                      style={{ flex: 1 }}
                    />
                  </View>
                )}
              </Card>
            </View>
          ))
        )
      ) : truckRequests.length === 0 ? (
        <EmptyState
          icon="car-outline"
          title="No Truck Requests"
          message="Your truck requests will appear here"
        />
      ) : (
        truckRequests.map((req) => (
          <View key={req.id} style={styles.cardWrapper}>
            <Card>
              <View style={styles.cardHeader}>
                <Text style={styles.cardRoute} numberOfLines={1}>
                  {req.load?.pickupCity ?? "—"} →{" "}
                  {req.load?.deliveryCity ?? "—"}
                </Text>
                <StatusBadge status={req.status} type="generic" />
              </View>
              <Text style={styles.cardSub}>
                Truck: {req.truck?.licensePlate ?? "—"} •{" "}
                {req.truck?.truckType ?? ""}
              </Text>
              {req.offeredRate != null && (
                <Text style={styles.cardRate}>
                  Offered: {formatCurrency(req.offeredRate)}
                </Text>
              )}
              <Text style={styles.cardDate}>{formatDate(req.createdAt)}</Text>
              {req.status === "PENDING" && (
                <View style={styles.actionRow}>
                  <Button
                    title="Cancel Request"
                    variant="destructive"
                    size="sm"
                    onPress={() => handleCancelTruckRequest(req.id)}
                    loading={cancelMutation.isPending}
                    fullWidth
                  />
                </View>
              )}
            </Card>
          </View>
        ))
      )}

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabRow: {
    flexDirection: "row",
    marginHorizontal: spacing["2xl"],
    marginTop: spacing.lg,
    backgroundColor: colors.slate100,
    borderRadius: 10,
    padding: 3,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: "center",
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: colors.white,
    shadowColor: colors.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabText: { ...typography.labelMedium, color: colors.textSecondary },
  tabTextActive: { color: colors.primary600 },
  filterRow: { marginTop: spacing.md },
  filterContent: {
    paddingHorizontal: spacing["2xl"],
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.slate100,
    marginRight: spacing.sm,
  },
  chipActive: { backgroundColor: colors.primary600 },
  chipText: { ...typography.labelSmall, color: colors.textSecondary },
  chipTextActive: { color: colors.white },
  cardWrapper: {
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing.md,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  cardRoute: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  cardSub: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  cardRate: {
    ...typography.labelMedium,
    color: colors.primary600,
    marginTop: 4,
  },
  cardDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    marginTop: spacing.md,
  },
});

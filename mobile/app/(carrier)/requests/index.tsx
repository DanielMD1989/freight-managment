/**
 * Carrier Requests Screen - Manage incoming truck requests + outgoing load requests
 * 3 tabs: Shipper Requests, My Load Requests, Match Proposals
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
  useReceivedTruckRequests,
  useRespondToTruckRequest,
} from "../../../src/hooks/useTrucks";
import {
  useMyLoadRequests,
  useCancelLoadRequest,
} from "../../../src/hooks/useLoads";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Button } from "../../../src/components/Button";
import { formatCurrency, formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

type Tab = "shipper" | "myload" | "matches";
const STATUS_FILTERS = ["ALL", "PENDING", "APPROVED", "REJECTED"] as const;

export default function CarrierRequestsScreen() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>("shipper");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const filterParam = statusFilter === "ALL" ? undefined : statusFilter;

  // Tab 1: Shipper Requests (shippers requesting carrier's trucks)
  const {
    data: truckReqData,
    isLoading: truckReqLoading,
    refetch: refetchTruckReqs,
    isRefetching: truckReqRefetching,
  } = useReceivedTruckRequests({ status: filterParam, limit: 50 });

  // Tab 2: My Load Requests (carrier's load applications)
  const {
    data: loadReqData,
    isLoading: loadReqLoading,
    refetch: refetchLoadReqs,
    isRefetching: loadReqRefetching,
  } = useMyLoadRequests({ status: filterParam, limit: 50 });

  const respondMutation = useRespondToTruckRequest();
  const cancelLoadReqMutation = useCancelLoadRequest();

  const isLoading =
    tab === "shipper"
      ? truckReqLoading
      : tab === "myload"
        ? loadReqLoading
        : false;
  const isRefetching =
    tab === "shipper"
      ? truckReqRefetching
      : tab === "myload"
        ? loadReqRefetching
        : false;
  const refetch =
    tab === "shipper"
      ? refetchTruckReqs
      : tab === "myload"
        ? refetchLoadReqs
        : () => {};

  const truckRequests = (truckReqData?.requests ?? []) as Array<{
    id: string;
    status: string;
    load?: { pickupCity?: string; deliveryCity?: string };
    truck?: { licensePlate?: string; truckType?: string };
    shipper?: { name?: string };
    offeredRate?: number;
    notes?: string;
    createdAt?: string;
    expiresAt?: string;
  }>;

  const loadRequests = (loadReqData?.requests ?? []) as unknown as Array<{
    id: string;
    status: string;
    load?: { pickupCity?: string; deliveryCity?: string };
    truck?: { licensePlate?: string; truckType?: string };
    proposedRate?: number;
    notes?: string;
    createdAt?: string;
  }>;

  const handleApprove = (requestId: string) => {
    Alert.alert("Approve Request", "Accept this shipper's truck request?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Approve",
        onPress: () =>
          respondMutation.mutate({ id: requestId, action: "APPROVED" }),
      },
    ]);
  };

  const handleReject = (requestId: string) => {
    Alert.alert("Reject Request", "Reject this shipper's truck request?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Reject",
        style: "destructive",
        onPress: () =>
          respondMutation.mutate({ id: requestId, action: "REJECTED" }),
      },
    ]);
  };

  const handleCancelLoadRequest = (requestId: string) => {
    Alert.alert("Cancel Request", "Cancel this load application?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Cancel Request",
        style: "destructive",
        onPress: () => cancelLoadReqMutation.mutate(requestId),
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
          style={[styles.tab, tab === "shipper" && styles.tabActive]}
          onPress={() => {
            setTab("shipper");
            setStatusFilter("ALL");
          }}
        >
          <Text
            style={[styles.tabText, tab === "shipper" && styles.tabTextActive]}
          >
            Shipper Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "myload" && styles.tabActive]}
          onPress={() => {
            setTab("myload");
            setStatusFilter("ALL");
          }}
        >
          <Text
            style={[styles.tabText, tab === "myload" && styles.tabTextActive]}
          >
            My Load Requests
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === "matches" && styles.tabActive]}
          onPress={() => {
            setTab("matches");
            setStatusFilter("ALL");
          }}
        >
          <Text
            style={[styles.tabText, tab === "matches" && styles.tabTextActive]}
          >
            Match Proposals
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status Filter Chips */}
      {tab !== "matches" && (
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
      )}

      {/* Tab Content */}
      {tab === "shipper" ? (
        isLoading ? (
          <LoadingSpinner />
        ) : truckRequests.length === 0 ? (
          <EmptyState
            icon="car-outline"
            title="No Shipper Requests"
            message="Requests from shippers for your trucks will appear here"
          />
        ) : (
          truckRequests.map((req) => (
            <View key={req.id} style={styles.cardWrapper}>
              <Card>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardRoute} numberOfLines={1}>
                    {req.load?.pickupCity ?? "—"} {"\u2192"}{" "}
                    {req.load?.deliveryCity ?? "—"}
                  </Text>
                  <StatusBadge status={req.status} type="generic" />
                </View>
                <Text style={styles.cardSub}>
                  {req.shipper?.name ?? "Shipper"} {" | "} Truck:{" "}
                  {req.truck?.licensePlate ?? "—"}
                </Text>
                {req.offeredRate != null && (
                  <Text style={styles.cardRate}>
                    Offered: {formatCurrency(req.offeredRate)}
                  </Text>
                )}
                {req.notes ? (
                  <Text style={styles.cardNotes} numberOfLines={2}>
                    {req.notes}
                  </Text>
                ) : null}
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
      ) : tab === "myload" ? (
        isLoading ? (
          <LoadingSpinner />
        ) : loadRequests.length === 0 ? (
          <EmptyState
            icon="chatbubbles-outline"
            title="No Load Requests"
            message="Your load applications will appear here"
          />
        ) : (
          loadRequests.map((req) => (
            <View key={req.id} style={styles.cardWrapper}>
              <Card>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardRoute} numberOfLines={1}>
                    {req.load?.pickupCity ?? "—"} {"\u2192"}{" "}
                    {req.load?.deliveryCity ?? "—"}
                  </Text>
                  <StatusBadge status={req.status} type="generic" />
                </View>
                <Text style={styles.cardSub}>
                  Truck: {req.truck?.licensePlate ?? "—"} {" | "}{" "}
                  {req.truck?.truckType ?? ""}
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
                      title="Cancel Request"
                      variant="destructive"
                      size="sm"
                      onPress={() => handleCancelLoadRequest(req.id)}
                      loading={cancelLoadReqMutation.isPending}
                      fullWidth
                    />
                  </View>
                )}
              </Card>
            </View>
          ))
        )
      ) : (
        /* Match Proposals - placeholder */
        <EmptyState
          icon="flash-outline"
          title="Match Proposals"
          message="Smart load-truck match proposals will appear here soon"
        />
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
  cardNotes: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 2,
    fontStyle: "italic",
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

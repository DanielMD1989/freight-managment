/**
 * Shipper Loads List Screen - with status filter tabs
 */
import React, { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  useLoads,
  useUpdateLoad,
  useDeleteLoad,
} from "../../../src/hooks/useLoads";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { Button } from "../../../src/components/Button";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import {
  formatTruckType,
  formatWeight,
  formatDate,
} from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";
import type { Load } from "../../../src/types";

const STATUS_TABS = [
  { key: "", label: "All" },
  { key: "DRAFT", label: "Draft" },
  { key: "POSTED", label: "Posted" },
  { key: "SEARCHING", label: "Searching" },
  { key: "UNPOSTED", label: "Unposted" },
  { key: "ASSIGNED", label: "Assigned" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
  { key: "EXCEPTION", label: "Exception" },
];

export default function ShipperLoadsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ status?: string }>();
  const [activeStatus, setActiveStatus] = useState("");
  // Sync URL ?status=X param into state so the audit harness can navigate
  // directly to a specific status filter without clicking tabs.
  useEffect(() => {
    if (params.status && params.status !== activeStatus) {
      setActiveStatus(params.status);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.status]);
  const { data, isLoading, refetch, isRefetching } = useLoads(
    activeStatus ? { status: activeStatus, myLoads: true } : { myLoads: true }
  );

  const loads = data?.loads ?? [];

  const updateLoadMutation = useUpdateLoad();
  const deleteLoadMutation = useDeleteLoad();

  const handlePostLoad = (loadId: string) => {
    updateLoadMutation.mutate(
      { id: loadId, data: { status: "POSTED" } },
      {
        onSuccess: () => Alert.alert("Success", "Load posted successfully"),
        onError: (err) => Alert.alert("Error", err.message),
      }
    );
  };

  const handleUnpostLoad = (loadId: string) => {
    updateLoadMutation.mutate(
      { id: loadId, data: { status: "UNPOSTED" } },
      {
        onSuccess: () => Alert.alert("Success", "Load unposted"),
        onError: (err) => Alert.alert("Error", err.message),
      }
    );
  };

  const handleDeleteLoad = (loadId: string) => {
    Alert.alert("Delete Load", "Are you sure you want to delete this load?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          deleteLoadMutation.mutate(loadId, {
            onSuccess: () => Alert.alert("Deleted", "Load has been deleted"),
            onError: (err) => Alert.alert("Error", err.message),
          }),
      },
    ]);
  };

  const hasActions = (status: string) =>
    status === "DRAFT" || status === "UNPOSTED" || status === "POSTED";

  const renderLoad = ({ item }: { item: Load }) => (
    <Card style={styles.card}>
      <TouchableOpacity
        onPress={() => router.push(`/(shipper)/loads/${item.id}`)}
        activeOpacity={0.7}
      >
        <View style={styles.header}>
          <Text style={styles.route}>
            {item.pickupCity} → {item.deliveryCity}
          </Text>
          <StatusBadge status={item.status} type="load" />
        </View>
        <View style={styles.details}>
          <Text style={styles.detail}>{formatTruckType(item.truckType)}</Text>
          <Text style={styles.detail}>{formatWeight(item.weight)}</Text>
          <Text style={styles.detail}>{formatDate(item.pickupDate)}</Text>
        </View>
        {item.isFragile && (
          <View style={styles.tagRow}>
            <View style={styles.tag}>
              <Ionicons
                name="warning-outline"
                size={12}
                color={colors.warning}
              />
              <Text style={styles.tagText}>Fragile</Text>
            </View>
          </View>
        )}
      </TouchableOpacity>
      {hasActions(item.status) && (
        <View style={styles.loadActions}>
          {(item.status === "DRAFT" || item.status === "UNPOSTED") && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handlePostLoad(item.id)}
            >
              <Ionicons
                name="cloud-upload-outline"
                size={16}
                color={colors.primary600}
              />
              <Text style={styles.actionBtnText}>Post</Text>
            </TouchableOpacity>
          )}
          {item.status === "POSTED" && (
            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => handleUnpostLoad(item.id)}
            >
              <Ionicons
                name="cloud-download-outline"
                size={16}
                color={colors.warning}
              />
              <Text style={[styles.actionBtnText, { color: colors.warning }]}>
                Unpost
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleDeleteLoad(item.id)}
          >
            <Ionicons name="trash-outline" size={16} color={colors.error} />
            <Text style={[styles.actionBtnText, { color: colors.error }]}>
              Delete
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </Card>
  );

  return (
    <View style={styles.container}>
      {/* Hidden total count for stable test reads */}
      <Text
        testID="loads-total-count"
        style={{ position: "absolute", left: -9999, opacity: 0 }}
      >
        {data?.pagination?.total ?? loads.length}
      </Text>
      {/* Status filter tabs */}
      <View style={styles.tabContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabScroll}
        >
          {STATUS_TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeStatus === tab.key && styles.tabActive]}
              onPress={() => setActiveStatus(tab.key)}
            >
              <Text
                style={[
                  styles.tabText,
                  activeStatus === tab.key && styles.tabTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {isLoading && !data ? (
        <LoadingSpinner fullScreen />
      ) : (
        <FlatList
          data={loads}
          renderItem={renderLoad}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              icon="cube-outline"
              title="No loads yet"
              message={
                activeStatus
                  ? `No ${activeStatus.replace(/_/g, " ").toLowerCase()} loads`
                  : "Create your first load to get started"
              }
              actionLabel="Create Load"
              onAction={() => router.push("/(shipper)/loads/create")}
            />
          }
          ListHeaderComponent={
            loads.length > 0 ? (
              <Button
                title="Create Load"
                onPress={() => router.push("/(shipper)/loads/create")}
                variant="primary"
                icon={<Ionicons name="add" size={20} color={colors.white} />}
                style={styles.addButton}
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  tabContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tabScroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.slate100,
  },
  tabActive: {
    backgroundColor: colors.primary500,
  },
  tabText: { ...typography.labelSmall, color: colors.textSecondary },
  tabTextActive: { color: colors.white, fontWeight: "600" },
  list: { padding: spacing.lg, gap: spacing.md },
  addButton: { marginBottom: spacing.md, alignSelf: "flex-end" },
  card: { marginBottom: spacing.md },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  route: { ...typography.titleSmall, color: colors.textPrimary, flex: 1 },
  details: { flexDirection: "row", gap: spacing.lg },
  detail: { ...typography.bodySmall, color: colors.textSecondary },
  tagRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.sm },
  tag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    backgroundColor: colors.warning + "15",
    borderRadius: 12,
  },
  tagText: { ...typography.labelSmall, color: colors.warning },
  loadActions: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionBtnText: {
    ...typography.labelSmall,
    color: colors.primary600,
  },
});

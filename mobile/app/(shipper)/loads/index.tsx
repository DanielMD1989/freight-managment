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
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useLoads } from "../../../src/hooks/useLoads";
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
  { key: "ASSIGNED", label: "Assigned" },
  { key: "IN_TRANSIT", label: "In Transit" },
  { key: "DELIVERED", label: "Delivered" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED", label: "Cancelled" },
];

export default function ShipperLoadsScreen() {
  const router = useRouter();
  const [activeStatus, setActiveStatus] = useState("");
  const { data, isLoading, refetch, isRefetching } = useLoads(
    activeStatus ? { status: activeStatus, myLoads: true } : { myLoads: true }
  );

  const loads = data?.loads ?? [];

  const renderLoad = ({ item }: { item: Load }) => (
    <TouchableOpacity
      onPress={() => router.push(`/(shipper)/loads/${item.id}`)}
      activeOpacity={0.7}
    >
      <Card style={styles.card}>
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
      </Card>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
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
});

/**
 * Matching Trucks Screen - Find and assign trucks to loads
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
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useLoads } from "../../../src/hooks/useLoads";
import {
  useMatchingTrucks,
  useAssignTruck,
} from "../../../src/hooks/useMatches";
import { Card } from "../../../src/components/Card";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Button } from "../../../src/components/Button";
import { formatTruckType, formatWeight } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

function getScoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.error;
}

export default function MatchesScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  const [selectedLoadId, setSelectedLoadId] = useState<string | undefined>();
  const [minScore, setMinScore] = useState(50);
  const [showLoadPicker, setShowLoadPicker] = useState(false);

  const { data: loadsData } = useLoads({
    status: "POSTED",
    myLoads: true,
    limit: 50,
  });
  const postedLoads = loadsData?.loads ?? [];

  const {
    data: matchData,
    isLoading: matchLoading,
    refetch,
    isRefetching,
  } = useMatchingTrucks(selectedLoadId, { minScore, limit: 50 });

  const assignMutation = useAssignTruck();

  const matches = matchData?.trucks ?? [];
  const selectedLoad = postedLoads.find((l) => l.id === selectedLoadId);

  const handleAssign = (truckId: string, carrierName: string) => {
    if (!selectedLoadId) return;
    Alert.alert("Assign Truck", `Assign ${carrierName}'s truck to this load?`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Assign",
        onPress: () =>
          assignMutation.mutate(
            { loadId: selectedLoadId, truckId },
            {
              onSuccess: (data) => {
                Alert.alert("Success", data.message ?? "Truck assigned", [
                  {
                    text: "OK",
                    onPress: () => router.back(),
                  },
                ]);
              },
              onError: (err) =>
                Alert.alert("Error", err.message ?? "Assignment failed"),
            }
          ),
      },
    ]);
  };

  const scoreSteps = [40, 50, 60, 70, 80, 90];

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={() => selectedLoadId && refetch()}
        />
      }
    >
      {/* Load Selector */}
      <Card style={styles.selectorCard} padding="lg">
        <Text style={styles.sectionTitle}>Select Load</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowLoadPicker(!showLoadPicker)}
        >
          <Text
            style={[
              styles.pickerText,
              !selectedLoad && { color: colors.textTertiary },
            ]}
            numberOfLines={1}
          >
            {selectedLoad
              ? `${selectedLoad.pickupCity} → ${selectedLoad.deliveryCity}`
              : "Choose a posted load..."}
          </Text>
          <Ionicons
            name={showLoadPicker ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        {showLoadPicker && (
          <View style={styles.dropdown}>
            {postedLoads.length === 0 ? (
              <Text style={styles.dropdownEmpty}>No posted loads</Text>
            ) : (
              postedLoads.map((load) => (
                <TouchableOpacity
                  key={load.id}
                  style={[
                    styles.dropdownItem,
                    load.id === selectedLoadId && styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setSelectedLoadId(load.id);
                    setShowLoadPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      load.id === selectedLoadId &&
                        styles.dropdownItemTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {load.pickupCity} → {load.deliveryCity}
                  </Text>
                  <Text style={styles.dropdownItemSub}>
                    {formatTruckType(load.truckType)} •{" "}
                    {formatWeight(load.weight)}
                  </Text>
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Min Score Filter */}
        <Text style={[styles.fieldLabel, { marginTop: spacing.lg }]}>
          Minimum Match Score: {minScore}%
        </Text>
        <View style={styles.scoreRow}>
          {scoreSteps.map((s) => (
            <TouchableOpacity
              key={s}
              style={[
                styles.scoreChip,
                minScore === s && styles.scoreChipActive,
              ]}
              onPress={() => setMinScore(s)}
            >
              <Text
                style={[
                  styles.scoreChipText,
                  minScore === s && styles.scoreChipTextActive,
                ]}
              >
                {s}%
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </Card>

      {/* Results */}
      {!selectedLoadId ? (
        <EmptyState
          icon="analytics-outline"
          title="Select a Load"
          message="Choose a posted load to find matching trucks"
        />
      ) : matchLoading ? (
        <LoadingSpinner />
      ) : matches.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No Matches Found"
          message="Try lowering the minimum score or check back later"
        />
      ) : (
        <>
          <Text style={styles.resultsTitle}>
            {matchData?.total ?? 0} matches ({matchData?.exactMatches ?? 0}{" "}
            exact)
          </Text>
          {matches.map((m) => (
            <View key={m.id} style={styles.matchWrapper}>
              <Card>
                <View style={styles.matchHeader}>
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchCarrier}>
                      {m.carrier?.name ?? "Carrier"}
                      {m.carrier?.isVerified && (
                        <Text style={{ color: colors.success }}> ✓</Text>
                      )}
                    </Text>
                    <Text style={styles.matchTruck}>
                      {formatTruckType(m.truck?.truckType ?? m.truckType)} •{" "}
                      {m.truck?.licensePlate ?? "—"}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.scoreBadge,
                      { backgroundColor: getScoreColor(m.score) + "20" },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scoreText,
                        { color: getScoreColor(m.score) },
                      ]}
                    >
                      {m.score}%
                    </Text>
                  </View>
                </View>

                <View style={styles.matchDetails}>
                  <Text style={styles.matchDetail}>
                    <Ionicons
                      name="location-outline"
                      size={13}
                      color={colors.textSecondary}
                    />{" "}
                    {m.originCity?.name ?? m.currentCity ?? "—"}
                  </Text>
                  {m.truck?.capacity != null && (
                    <Text style={styles.matchDetail}>
                      <Ionicons
                        name="scale-outline"
                        size={13}
                        color={colors.textSecondary}
                      />{" "}
                      {formatWeight(m.truck.capacity)}
                    </Text>
                  )}
                  <Text style={styles.matchDetail}>
                    {m.fullPartial ?? "FULL"}
                  </Text>
                </View>

                {m.isExactMatch && (
                  <View style={styles.exactBadge}>
                    <Ionicons
                      name="checkmark-circle"
                      size={14}
                      color={colors.success}
                    />
                    <Text style={styles.exactBadgeText}>Exact Match</Text>
                  </View>
                )}

                <Button
                  title="Assign Truck"
                  variant="primary"
                  size="sm"
                  fullWidth
                  onPress={() =>
                    handleAssign(
                      m.truck?.id ?? m.id,
                      m.carrier?.name ?? "Carrier"
                    )
                  }
                  loading={assignMutation.isPending}
                  style={{ marginTop: spacing.md }}
                />
              </Card>
            </View>
          ))}
        </>
      )}

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  selectorCard: {
    marginHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  picker: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pickerText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  dropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    maxHeight: 200,
  },
  dropdownEmpty: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    padding: spacing.md,
    textAlign: "center",
  },
  dropdownItem: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dropdownItemActive: { backgroundColor: colors.primary50 },
  dropdownItemText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  dropdownItemTextActive: { color: colors.primary600, fontWeight: "600" },
  dropdownItemSub: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 1,
  },
  fieldLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  scoreRow: {
    flexDirection: "row",
    gap: spacing.sm,
    flexWrap: "wrap",
  },
  scoreChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 16,
    backgroundColor: colors.slate100,
  },
  scoreChipActive: { backgroundColor: colors.primary600 },
  scoreChipText: { ...typography.labelSmall, color: colors.textSecondary },
  scoreChipTextActive: { color: colors.white },
  resultsTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
    marginBottom: spacing.md,
  },
  matchWrapper: {
    paddingHorizontal: spacing["2xl"],
    marginBottom: spacing.md,
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  matchInfo: { flex: 1, marginRight: spacing.sm },
  matchCarrier: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  matchTruck: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  scoreBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 12,
  },
  scoreText: {
    ...typography.labelLarge,
    fontWeight: "700",
  },
  matchDetails: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: "wrap",
  },
  matchDetail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  exactBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
  },
  exactBadgeText: {
    ...typography.labelSmall,
    color: colors.success,
  },
});

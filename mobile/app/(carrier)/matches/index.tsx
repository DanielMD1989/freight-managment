/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Carrier Load Matches Screen - Find matching loads for truck postings
 * Mirror of shipper matches screen but reversed:
 * select a truck posting -> find matching loads.
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
import {
  useMyTruckPostings,
  useMatchingLoadsForPosting,
} from "../../../src/hooks/useTrucks";
import { Card } from "../../../src/components/Card";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Button } from "../../../src/components/Button";
import { formatTruckType, formatWeight } from "../../../src/utils/format";
import { useAuthStore } from "../../../src/stores/auth";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

function getScoreColor(score: number): string {
  if (score >= 80) return colors.success;
  if (score >= 60) return colors.warning;
  return colors.error;
}

export default function CarrierMatchesScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);

  const [selectedPostingId, setSelectedPostingId] = useState<
    string | undefined
  >();
  const [minScore, setMinScore] = useState(50);
  const [showPostingPicker, setShowPostingPicker] = useState(false);

  const { data: postingsData } = useMyTruckPostings({
    status: "ACTIVE",
    limit: 50,
    organizationId: user?.organizationId ?? undefined,
  });
  const activePostings = postingsData?.postings ?? [];

  const {
    data: matchData,
    isLoading: matchLoading,
    refetch,
    isRefetching,
  } = useMatchingLoadsForPosting(selectedPostingId, { minScore, limit: 50 });

  const matches = matchData?.matches ?? [];
  const selectedPosting = activePostings.find(
    (p) => p.id === selectedPostingId
  );

  const handleRequestLoad = (loadId: string, route: string) => {
    Alert.alert("Request Load", `Send a request for the load "${route}"?`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: "Request",
        onPress: () => {
          // Navigate to load detail or handle request in future
          Alert.alert("Info", "Load request feature coming soon.");
        },
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
          onRefresh={() => selectedPostingId && refetch()}
        />
      }
    >
      {/* Posting Selector */}
      <Card style={styles.selectorCard} padding="lg">
        <Text style={styles.sectionTitle}>Select Truck Posting</Text>
        <TouchableOpacity
          style={styles.picker}
          onPress={() => setShowPostingPicker(!showPostingPicker)}
        >
          <Text
            style={[
              styles.pickerText,
              !selectedPosting && { color: colors.textTertiary },
            ]}
            numberOfLines={1}
          >
            {selectedPosting
              ? `${selectedPosting.originCityName ?? (selectedPosting as any).originCity?.name ?? "Origin"} → ${selectedPosting.destinationCityName ?? (selectedPosting as any).destinationCity?.name ?? "Any"}`
              : "Choose an active posting..."}
          </Text>
          <Ionicons
            name={showPostingPicker ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        {showPostingPicker && (
          <View style={styles.dropdown}>
            {activePostings.length === 0 ? (
              <Text style={styles.dropdownEmpty}>No active postings</Text>
            ) : (
              activePostings.map((posting) => (
                <TouchableOpacity
                  key={posting.id}
                  style={[
                    styles.dropdownItem,
                    posting.id === selectedPostingId &&
                      styles.dropdownItemActive,
                  ]}
                  onPress={() => {
                    setSelectedPostingId(posting.id);
                    setShowPostingPicker(false);
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownItemText,
                      posting.id === selectedPostingId &&
                        styles.dropdownItemTextActive,
                    ]}
                    numberOfLines={1}
                  >
                    {posting.originCityName ??
                      (posting as any).originCity?.name ??
                      "Origin"}{" "}
                    →{" "}
                    {posting.destinationCityName ??
                      (posting as any).destinationCity?.name ??
                      "Any"}
                  </Text>
                  <Text style={styles.dropdownItemSub}>
                    {formatTruckType(posting.truck?.truckType)}{" "}
                    {posting.truck?.licensePlate
                      ? `- ${posting.truck.licensePlate}`
                      : ""}
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
      {!selectedPostingId ? (
        <EmptyState
          icon="analytics-outline"
          title="Select a Posting"
          message="Choose one of your active truck postings to find matching loads"
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
            {matchData?.total ?? 0} matching loads
          </Text>
          {matches.map((m: any) => (
            <View key={m.load?.id ?? m.id} style={styles.matchWrapper}>
              <Card>
                <View style={styles.matchHeader}>
                  <View style={styles.matchInfo}>
                    <Text style={styles.matchRoute}>
                      {m.load?.pickupCity ?? "Origin"} →{" "}
                      {m.load?.deliveryCity ?? "Dest"}
                    </Text>
                    <Text style={styles.matchTruck}>
                      {formatTruckType(m.load?.truckType)} •{" "}
                      {formatWeight(m.load?.weight)}
                    </Text>
                  </View>
                  {m.matchScore != null && (
                    <View
                      style={[
                        styles.scoreBadge,
                        {
                          backgroundColor: getScoreColor(m.matchScore) + "20",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.scoreText,
                          { color: getScoreColor(m.matchScore) },
                        ]}
                      >
                        {m.matchScore}%
                      </Text>
                    </View>
                  )}
                </View>

                <View style={styles.matchDetails}>
                  {m.load?.pickupCity && (
                    <Text style={styles.matchDetail}>
                      <Ionicons
                        name="location-outline"
                        size={13}
                        color={colors.textSecondary}
                      />{" "}
                      {m.load.pickupCity}
                    </Text>
                  )}
                  {m.load?.weight != null && (
                    <Text style={styles.matchDetail}>
                      <Ionicons
                        name="scale-outline"
                        size={13}
                        color={colors.textSecondary}
                      />{" "}
                      {formatWeight(m.load.weight)}
                    </Text>
                  )}
                  <Text style={styles.matchDetail}>
                    {m.load?.fullPartial ?? "FULL"}
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
                  title="Request Load"
                  variant="primary"
                  size="sm"
                  fullWidth
                  onPress={() =>
                    handleRequestLoad(
                      m.load?.id ?? m.id,
                      `${m.load?.pickupCity ?? "Origin"} → ${m.load?.deliveryCity ?? "Dest"}`
                    )
                  }
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
  matchRoute: {
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

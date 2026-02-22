/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Posting Detail Screen - Shows full posting info + matching loads
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  useTruckPosting,
  useCancelTruckPosting,
  useDuplicateTruckPosting,
  useMatchingLoadsForPosting,
} from "../../../src/hooks/useTrucks";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Button } from "../../../src/components/Button";
import {
  formatTruckType,
  formatDate,
  formatWeight,
} from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

export default function PostingDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const { data: posting, isLoading } = useTruckPosting(id);
  const { data: matchData, isLoading: matchLoading } =
    useMatchingLoadsForPosting(id, { minScore: 50, limit: 20 });
  const cancelMutation = useCancelTruckPosting();
  const duplicateMutation = useDuplicateTruckPosting();

  if (isLoading || !posting) return <LoadingSpinner fullScreen />;

  const matches = matchData?.matches ?? [];

  const handleCancel = () => {
    Alert.alert(
      "Cancel Posting",
      "Are you sure you want to cancel this posting?",
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: () =>
            cancelMutation.mutate(id!, {
              onSuccess: () => {
                Alert.alert("Success", "Posting cancelled");
                router.back();
              },
              onError: (err) =>
                Alert.alert("Error", err.message ?? "Failed to cancel"),
            }),
        },
      ]
    );
  };

  const handleDuplicate = () => {
    duplicateMutation.mutate(id!, {
      onSuccess: () => {
        Alert.alert("Success", "Posting duplicated successfully");
      },
      onError: (err) =>
        Alert.alert("Error", err.message ?? "Failed to duplicate"),
    });
  };

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.route}>
            {posting.originCityName ??
              (posting as any).originCity?.name ??
              "Origin"}{" "}
            →{" "}
            {posting.destinationCityName ??
              (posting as any).destinationCity?.name ??
              "Any"}
          </Text>
          <StatusBadge
            status={posting.status ?? "ACTIVE"}
            type="generic"
            size="md"
          />
        </View>
      </Card>

      {/* Truck Details */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Truck Details</Text>
        <DetailRow
          label="Type"
          value={formatTruckType(posting.truck?.truckType)}
        />
        {posting.truck?.licensePlate && (
          <DetailRow label="License Plate" value={posting.truck.licensePlate} />
        )}
        {posting.truck?.capacity != null && (
          <DetailRow
            label="Capacity"
            value={formatWeight(posting.truck.capacity)}
          />
        )}
        {posting.fullPartial && (
          <DetailRow label="Load Type" value={posting.fullPartial} />
        )}
      </Card>

      {/* Availability */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Availability</Text>
        <DetailRow
          label="Available From"
          value={formatDate(posting.availableFrom)}
        />
        {posting.availableTo && (
          <DetailRow
            label="Available To"
            value={formatDate(posting.availableTo)}
          />
        )}
        {posting.availableWeight != null && (
          <DetailRow
            label="Available Weight"
            value={formatWeight(posting.availableWeight)}
          />
        )}
        {posting.availableLength != null && (
          <DetailRow
            label="Available Length"
            value={`${posting.availableLength} m`}
          />
        )}
      </Card>

      {/* Contact Info */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Contact</Text>
        {posting.contactName && (
          <DetailRow label="Name" value={posting.contactName} />
        )}
        {posting.contactPhone && (
          <DetailRow label="Phone" value={posting.contactPhone} />
        )}
        {posting.ownerName && (
          <DetailRow label="Owner" value={posting.ownerName} />
        )}
        {posting.notes && <DetailRow label="Notes" value={posting.notes} />}
      </Card>

      {/* Actions */}
      {posting.status === "ACTIVE" && (
        <View style={styles.actionRow}>
          <Button
            title="Cancel Posting"
            variant="outline"
            size="lg"
            onPress={handleCancel}
            loading={cancelMutation.isPending}
            style={styles.actionBtn}
          />
          <Button
            title="Duplicate"
            variant="primary"
            size="lg"
            onPress={handleDuplicate}
            loading={duplicateMutation.isPending}
            style={styles.actionBtn}
          />
        </View>
      )}

      {posting.status !== "ACTIVE" && (
        <View style={styles.actionRow}>
          <Button
            title="Duplicate as New"
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleDuplicate}
            loading={duplicateMutation.isPending}
          />
        </View>
      )}

      {/* Matching Loads Section */}
      <View style={styles.matchSection}>
        <Text style={styles.sectionTitleLg}>
          Matching Loads ({matchData?.total ?? 0})
        </Text>

        {matchLoading ? (
          <LoadingSpinner />
        ) : matches.length === 0 ? (
          <EmptyState
            icon="search-outline"
            title="No Matching Loads"
            message="No loads currently match this posting's criteria"
          />
        ) : (
          matches.map((match: any) => (
            <Card key={match.load?.id ?? match.id} style={styles.matchCard}>
              <View style={styles.matchHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.matchRoute}>
                    {match.load?.pickupCity ?? "Origin"} →{" "}
                    {match.load?.deliveryCity ?? "Dest"}
                  </Text>
                  <Text style={styles.matchDetail}>
                    {formatTruckType(match.load?.truckType)} •{" "}
                    {formatWeight(match.load?.weight)}
                  </Text>
                </View>
                {match.matchScore != null && (
                  <View
                    style={[
                      styles.scoreBadge,
                      {
                        backgroundColor:
                          (match.matchScore >= 80
                            ? colors.success
                            : match.matchScore >= 60
                              ? colors.warning
                              : colors.error) + "20",
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.scoreText,
                        {
                          color:
                            match.matchScore >= 80
                              ? colors.success
                              : match.matchScore >= 60
                                ? colors.warning
                                : colors.error,
                        },
                      ]}
                    >
                      {match.matchScore}%
                    </Text>
                  </View>
                )}
              </View>
              {match.load?.fullPartial && (
                <Text style={styles.matchMeta}>{match.load.fullPartial}</Text>
              )}
            </Card>
          ))
        )}
      </View>

      <View style={{ height: spacing["3xl"] }} />
    </ScrollView>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
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
  route: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    flex: 1,
    marginRight: spacing.sm,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  sectionTitleLg: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  detailLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
    flexShrink: 1,
    textAlign: "right",
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    marginTop: spacing["2xl"],
    gap: spacing.md,
  },
  actionBtn: {
    flex: 1,
  },
  matchSection: {
    paddingHorizontal: spacing.lg,
    marginTop: spacing["2xl"],
  },
  matchCard: {
    marginBottom: spacing.md,
  },
  matchHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  matchRoute: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  matchDetail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  matchMeta: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
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
});

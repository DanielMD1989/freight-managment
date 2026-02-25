/**
 * Carrier Dispute Detail Screen
 * Shows full dispute info, evidence, resolution, and related load
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Linking,
} from "react-native";
import { useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useDispute } from "../../../src/hooks/useDisputes";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

export default function CarrierDisputeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: dispute, isLoading } = useDispute(id);

  if (isLoading || !dispute) return <LoadingSpinner fullScreen />;

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <Card style={styles.card}>
        <View style={styles.headerRow}>
          <Text style={styles.typeTitle}>
            {dispute.type.replace(/_/g, " ")}
          </Text>
          <StatusBadge status={dispute.status} size="md" />
        </View>
      </Card>

      {/* Description */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Description</Text>
        <Text style={styles.descriptionText}>{dispute.description}</Text>
      </Card>

      {/* Details */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Details</Text>
        <DetailRow label="Filed" value={formatDate(dispute.createdAt)} />
        <DetailRow label="Last Updated" value={formatDate(dispute.updatedAt)} />
        <DetailRow label="Dispute ID" value={dispute.id.slice(0, 12) + "..."} />
      </Card>

      {/* Evidence */}
      {dispute.evidenceUrls && dispute.evidenceUrls.length > 0 && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>
            Evidence ({dispute.evidenceUrls.length})
          </Text>
          {dispute.evidenceUrls.map((url, index) => (
            <TouchableOpacity
              key={index}
              style={styles.evidenceItem}
              onPress={() => Linking.openURL(url)}
            >
              <Ionicons
                name="document-outline"
                size={18}
                color={colors.primary500}
              />
              <Text style={styles.evidenceText} numberOfLines={1}>
                Evidence {index + 1}
              </Text>
              <Ionicons
                name="open-outline"
                size={16}
                color={colors.primary500}
              />
            </TouchableOpacity>
          ))}
        </Card>
      )}

      {/* Resolution */}
      {dispute.resolution && (
        <Card style={styles.card}>
          <View style={styles.resolutionHeader}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.success}
            />
            <Text style={styles.sectionTitle}>Resolution</Text>
          </View>
          <Text style={styles.descriptionText}>{dispute.resolution}</Text>
          {dispute.resolvedAt && (
            <Text style={styles.resolvedDate}>
              Resolved on {formatDate(dispute.resolvedAt)}
            </Text>
          )}
        </Card>
      )}

      {/* Related Load */}
      {dispute.loadId && (
        <Card style={styles.card}>
          <Text style={styles.sectionTitle}>Related Load</Text>
          <View style={styles.loadRow}>
            <Ionicons name="cube-outline" size={18} color={colors.slate500} />
            <Text style={styles.loadIdText}>
              {dispute.loadId.slice(0, 12)}...
            </Text>
          </View>
        </Card>
      )}

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
  typeTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    flex: 1,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  descriptionText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 22,
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
  },
  evidenceItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  evidenceText: {
    ...typography.bodyMedium,
    color: colors.primary600,
    flex: 1,
  },
  resolutionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  resolvedDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  loadRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  loadIdText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontFamily: "monospace",
  },
});

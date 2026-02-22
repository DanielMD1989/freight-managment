/**
 * Truck Details Screen (Carrier)
 * Shows truck info, documents section, edit/delete actions
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Alert,
  TouchableOpacity,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTruck, useDeleteTruck } from "../../../src/hooks/useTrucks";
import {
  useDocuments,
  useDeleteDocument,
} from "../../../src/hooks/useDocuments";
import { Card } from "../../../src/components/Card";
import { Button } from "../../../src/components/Button";
import { Badge } from "../../../src/components/Badge";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { formatTruckType, formatWeight } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

const DOC_TYPE_VARIANT: Record<
  string,
  "primary" | "info" | "warning" | "success" | "neutral"
> = {
  TITLE_DEED: "primary",
  REGISTRATION: "info",
  INSURANCE: "warning",
  INSPECTION: "success",
  OTHER: "neutral",
};

export default function TruckDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: truck, isLoading } = useTruck(id);
  const deleteTruck = useDeleteTruck();
  const { data: docsData, isLoading: docsLoading } = useDocuments({
    entityType: "truck",
    entityId: id,
  });
  const deleteDocument = useDeleteDocument();

  const documents = docsData?.documents ?? [];

  const handleDelete = () => {
    if (!id) return;
    Alert.alert(
      "Delete Truck",
      "Are you sure you want to delete this truck? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteTruck.mutate(id, {
              onSuccess: () => {
                Alert.alert("Deleted", "Truck has been deleted.");
                router.replace("/(carrier)/trucks");
              },
              onError: (err) => {
                Alert.alert("Error", err.message);
              },
            });
          },
        },
      ]
    );
  };

  const handleDeleteDocument = (docId: string, fileName: string) => {
    Alert.alert(
      "Delete Document",
      `Are you sure you want to delete "${fileName}"?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => {
            deleteDocument.mutate(
              { id: docId, entityType: "truck" },
              {
                onError: (err) => {
                  Alert.alert(
                    "Error",
                    err.message ?? "Failed to delete document."
                  );
                },
              }
            );
          },
        },
      ]
    );
  };

  const handleAddDocument = () => {
    Alert.alert(
      "Add Document",
      "Camera/gallery integration needed. This feature will allow you to upload truck documents such as registration, insurance, and inspection certificates.",
      [{ text: "OK" }]
    );
  };

  if (isLoading || !truck) return <LoadingSpinner fullScreen />;

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.licensePlate}>{truck.licensePlate}</Text>
          <StatusBadge
            status={
              truck.approvalStatus === "APPROVED"
                ? truck.isAvailable
                  ? "ACTIVE"
                  : "IN_TRANSIT"
                : truck.approvalStatus
            }
            size="md"
          />
        </View>

        <DetailRow
          label="Truck Type"
          value={formatTruckType(truck.truckType)}
        />
        <DetailRow label="Capacity" value={formatWeight(truck.capacity)} />
        {truck.volume && (
          <DetailRow label="Volume" value={`${truck.volume} m\u00B3`} />
        )}
        {truck.lengthM && (
          <DetailRow label="Length" value={`${truck.lengthM} m`} />
        )}
        {truck.currentCity && (
          <DetailRow label="Current City" value={truck.currentCity} />
        )}
        {truck.ownerName && <DetailRow label="Owner" value={truck.ownerName} />}
        {truck.contactPhone && (
          <DetailRow label="Contact" value={truck.contactPhone} />
        )}
        {truck.imei && <DetailRow label="GPS IMEI" value={truck.imei} />}
      </Card>

      {/* Documents Section */}
      <View style={styles.docSection}>
        <View style={styles.docHeader}>
          <Text style={styles.docTitle}>Documents</Text>
          <TouchableOpacity
            style={styles.addDocButton}
            onPress={handleAddDocument}
          >
            <Ionicons
              name="add-circle-outline"
              size={20}
              color={colors.primary600}
            />
            <Text style={styles.addDocText}>Add</Text>
          </TouchableOpacity>
        </View>

        {docsLoading ? (
          <LoadingSpinner size="small" />
        ) : documents.length === 0 ? (
          <Card style={styles.emptyDocCard} variant="outlined">
            <View style={styles.emptyDocContent}>
              <Ionicons
                name="document-outline"
                size={32}
                color={colors.slate300}
              />
              <Text style={styles.emptyDocText}>No documents uploaded yet</Text>
              <Button
                title="Upload Document"
                onPress={handleAddDocument}
                variant="outline"
                size="sm"
                style={{ marginTop: spacing.sm }}
              />
            </View>
          </Card>
        ) : (
          documents.map((doc) => (
            <Card key={doc.id} style={styles.docCard}>
              <View style={styles.docRow}>
                <Ionicons
                  name="document-text-outline"
                  size={20}
                  color={colors.primary500}
                />
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>
                    {doc.fileName}
                  </Text>
                  <Badge
                    label={doc.type.replace(/_/g, " ")}
                    variant={DOC_TYPE_VARIANT[doc.type] ?? "neutral"}
                    size="sm"
                  />
                </View>
                <TouchableOpacity
                  onPress={() => handleDeleteDocument(doc.id, doc.fileName)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons
                    name="trash-outline"
                    size={18}
                    color={colors.error}
                  />
                </TouchableOpacity>
              </View>
              {doc.verificationStatus && (
                <View style={styles.docStatus}>
                  <StatusBadge status={doc.verificationStatus} size="sm" />
                </View>
              )}
            </Card>
          ))
        )}
      </View>

      {/* Action Buttons */}
      <View style={styles.actionButtons}>
        <Button
          title="Edit Truck"
          variant="primary"
          size="lg"
          fullWidth
          onPress={() =>
            router.push({
              pathname: "/(carrier)/trucks/edit",
              params: { id },
            })
          }
          testID="truck-edit-btn"
        />
        <View style={{ height: spacing.md }} />
        <Button
          title="Delete Truck"
          variant="destructive"
          size="lg"
          fullWidth
          onPress={handleDelete}
          loading={deleteTruck.isPending}
          testID="truck-delete-btn"
        />
      </View>
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
  card: { margin: spacing.lg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  licensePlate: { ...typography.headlineMedium, color: colors.textPrimary },
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
  docSection: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  docHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  docTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
  },
  addDocButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  addDocText: {
    ...typography.labelMedium,
    color: colors.primary600,
  },
  emptyDocCard: {
    marginBottom: spacing.md,
  },
  emptyDocContent: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  emptyDocText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  docCard: {
    marginBottom: spacing.sm,
  },
  docRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  docInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  docName: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  docStatus: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  actionButtons: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing["2xl"],
    marginTop: spacing.lg,
  },
});

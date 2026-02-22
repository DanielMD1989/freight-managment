/**
 * Carrier Documents Screen - Upload and manage company documents
 * Adapted from shipper documents screen with carrier-specific doc types
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
import * as DocumentPicker from "expo-document-picker";
import { useAuthStore } from "../../../src/stores/auth";
import {
  useDocuments,
  useUploadDocument,
  useDeleteDocument,
} from "../../../src/hooks/useDocuments";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { EmptyState } from "../../../src/components/EmptyState";
import { Button } from "../../../src/components/Button";
import { formatDate } from "../../../src/utils/format";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

const DOC_TYPES = [
  "COMPANY_LICENSE",
  "TIN_CERTIFICATE",
  "INSURANCE_CERTIFICATE",
  "OTHER",
] as const;

export default function CarrierDocumentsScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.organizationId;

  const {
    data: docsData,
    isLoading,
    refetch,
    isRefetching,
  } = useDocuments({ entityType: "company", entityId: orgId });
  const uploadMutation = useUploadDocument();
  const deleteMutation = useDeleteDocument();

  const [selectedDocType, setSelectedDocType] = useState<string>(DOC_TYPES[0]);
  const [showTypeSelector, setShowTypeSelector] = useState(false);

  const documents = docsData?.documents ?? [];
  const pendingCount = documents.filter(
    (d) => d.verificationStatus === "PENDING"
  ).length;
  const approvedCount = documents.filter(
    (d) => d.verificationStatus === "VERIFIED"
  ).length;
  const rejectedCount = documents.filter(
    (d) => d.verificationStatus === "REJECTED"
  ).length;

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/jpeg", "image/png"],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets?.[0]) return;

      const file = result.assets[0];
      const formData = new FormData();
      formData.append("file", {
        uri: file.uri,
        name: file.name,
        type: file.mimeType ?? "application/octet-stream",
      } as unknown as Blob);
      formData.append("type", selectedDocType);
      formData.append("entityType", "company");
      formData.append("entityId", orgId ?? "");

      uploadMutation.mutate(formData, {
        onSuccess: () => Alert.alert("Success", "Document uploaded"),
        onError: (err) => Alert.alert("Error", err.message ?? "Upload failed"),
      });
    } catch {
      Alert.alert("Error", "Could not pick document");
    }
  };

  const handleDelete = (docId: string) => {
    Alert.alert("Delete Document", "Are you sure?", [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () =>
          deleteMutation.mutate(
            { id: docId, entityType: "company" },
            {
              onSuccess: () => Alert.alert("Deleted", "Document removed"),
              onError: (err) =>
                Alert.alert("Error", err.message ?? "Delete failed"),
            }
          ),
      },
    ]);
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {/* Summary */}
      <View style={styles.summaryRow}>
        <Card style={styles.summaryCard} padding="md">
          <Text style={[styles.summaryCount, { color: colors.warning }]}>
            {pendingCount}
          </Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </Card>
        <Card style={styles.summaryCard} padding="md">
          <Text style={[styles.summaryCount, { color: colors.success }]}>
            {approvedCount}
          </Text>
          <Text style={styles.summaryLabel}>Approved</Text>
        </Card>
        <Card style={styles.summaryCard} padding="md">
          <Text style={[styles.summaryCount, { color: colors.error }]}>
            {rejectedCount}
          </Text>
          <Text style={styles.summaryLabel}>Rejected</Text>
        </Card>
      </View>

      {/* Upload Section */}
      <Card style={styles.uploadCard} padding="lg">
        <Text style={styles.sectionTitle}>Upload Document</Text>

        {/* Document Type Selector */}
        <Text style={styles.fieldLabel}>Document Type</Text>
        <TouchableOpacity
          style={styles.typeSelector}
          onPress={() => setShowTypeSelector(!showTypeSelector)}
        >
          <Text style={styles.typeSelectorText}>
            {selectedDocType.replace(/_/g, " ")}
          </Text>
          <Ionicons
            name={showTypeSelector ? "chevron-up" : "chevron-down"}
            size={18}
            color={colors.textSecondary}
          />
        </TouchableOpacity>
        {showTypeSelector && (
          <View style={styles.typeDropdown}>
            {DOC_TYPES.map((dt) => (
              <TouchableOpacity
                key={dt}
                style={[
                  styles.typeOption,
                  dt === selectedDocType && styles.typeOptionActive,
                ]}
                onPress={() => {
                  setSelectedDocType(dt);
                  setShowTypeSelector(false);
                }}
              >
                <Text
                  style={[
                    styles.typeOptionText,
                    dt === selectedDocType && styles.typeOptionTextActive,
                  ]}
                >
                  {dt.replace(/_/g, " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Button
          title="Choose File & Upload"
          variant="primary"
          size="md"
          fullWidth
          onPress={handlePickDocument}
          loading={uploadMutation.isPending}
          icon={
            <Ionicons
              name="cloud-upload-outline"
              size={18}
              color={colors.white}
            />
          }
          style={{ marginTop: spacing.lg }}
        />
      </Card>

      {/* Document List */}
      <Text style={styles.listTitle}>Documents ({documents.length})</Text>

      {documents.length === 0 ? (
        <EmptyState
          icon="document-outline"
          title="No Documents"
          message="Upload your company documents for verification"
        />
      ) : (
        documents.map((doc) => (
          <View key={doc.id} style={styles.docWrapper}>
            <Card>
              <View style={styles.docHeader}>
                <Ionicons
                  name="document-text-outline"
                  size={24}
                  color={colors.primary500}
                />
                <View style={styles.docInfo}>
                  <Text style={styles.docName} numberOfLines={1}>
                    {doc.fileName}
                  </Text>
                  <Text style={styles.docType}>
                    {doc.type.replace(/_/g, " ")}
                  </Text>
                </View>
                <StatusBadge status={doc.verificationStatus} type="generic" />
              </View>
              <View style={styles.docMeta}>
                <Text style={styles.docMetaText}>
                  Uploaded: {formatDate(doc.uploadedAt)}
                </Text>
                {doc.expiresAt && (
                  <Text style={styles.docMetaText}>
                    Expires: {formatDate(doc.expiresAt)}
                  </Text>
                )}
                {doc.fileSize && (
                  <Text style={styles.docMetaText}>
                    {(doc.fileSize / 1024).toFixed(0)} KB
                  </Text>
                )}
              </View>
              {doc.rejectionReason && (
                <Text style={styles.rejectionReason}>
                  Reason: {doc.rejectionReason}
                </Text>
              )}
              {doc.verificationStatus === "PENDING" && (
                <Button
                  title={t("common.delete")}
                  variant="destructive"
                  size="sm"
                  onPress={() => handleDelete(doc.id)}
                  loading={deleteMutation.isPending}
                  style={{ marginTop: spacing.sm }}
                />
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
  summaryRow: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
  },
  summaryCard: { flex: 1, alignItems: "center" },
  summaryCount: {
    ...typography.displaySmall,
  },
  summaryLabel: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  uploadCard: {
    marginHorizontal: spacing["2xl"],
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  typeSelector: {
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
  typeSelectorText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  typeDropdown: {
    marginTop: spacing.xs,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
  },
  typeOption: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  typeOptionActive: { backgroundColor: colors.primary50 },
  typeOptionText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  typeOptionTextActive: { color: colors.primary600, fontWeight: "600" },
  listTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
    marginBottom: spacing.md,
  },
  docWrapper: {
    paddingHorizontal: spacing["2xl"],
    marginBottom: spacing.sm,
  },
  docHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  docInfo: { flex: 1 },
  docName: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  docType: {
    ...typography.labelSmall,
    color: colors.textSecondary,
    marginTop: 1,
  },
  docMeta: {
    flexDirection: "row",
    gap: spacing.md,
    marginTop: spacing.sm,
    flexWrap: "wrap",
  },
  docMetaText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  rejectionReason: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
});

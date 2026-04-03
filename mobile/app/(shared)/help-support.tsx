/**
 * Help & Support Screen — §14 Mobile Settings
 *
 * Contact info, report issue form. Mirrors web /settings/support.
 * Report types: BUG, MISCONDUCT, FEEDBACK, OTHER (per blueprint §14).
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Linking,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import apiClient, { getErrorMessage } from "../../src/api/client";

const REPORT_TYPES = [
  { value: "BUG", label: "Bug Report" },
  { value: "MISCONDUCT", label: "Misconduct" },
  { value: "FEEDBACK", label: "Feedback" },
  { value: "OTHER", label: "Other" },
] as const;

interface Report {
  id: string;
  referenceId: string;
  type: string;
  subject: string;
  status: string;
  submittedAt: string | null;
}

export default function HelpSupportScreen() {
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<string>("BUG");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [loadingReports, setLoadingReports] = useState(true);

  const fetchReports = React.useCallback(async () => {
    try {
      const response = await apiClient.get("/api/support/report");
      setReports(response.data.reports || []);
    } catch {
      // Silent
    } finally {
      setLoadingReports(false);
    }
  }, []);

  React.useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleSubmit = async () => {
    if (subject.trim().length < 3) {
      Alert.alert("Error", "Subject must be at least 3 characters.");
      return;
    }
    if (description.trim().length < 10) {
      Alert.alert("Error", "Description must be at least 10 characters.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await apiClient.post("/api/support/report", {
        type: selectedType,
        subject: subject.trim(),
        description: description.trim(),
      });
      const refId = response.data?.referenceId || "submitted";
      Alert.alert(
        "Report Submitted",
        `Your report (${refId}) has been submitted. We will review it shortly.`,
        [
          {
            text: "OK",
            onPress: () => {
              setShowForm(false);
              setSubject("");
              setDescription("");
              setSelectedType("BUG");
              fetchReports();
            },
          },
        ]
      );
    } catch (error) {
      Alert.alert("Error", getErrorMessage(error) || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Contact Card */}
      <Card style={styles.contactCard}>
        <View style={styles.contactHeader}>
          <View style={styles.contactIconWrap}>
            <Ionicons name="headset-outline" size={24} color={colors.white} />
          </View>
          <View style={styles.contactText}>
            <Text style={styles.contactTitle}>Need Help?</Text>
            <Text style={styles.contactDesc}>
              Our support team is here to help with any questions.
            </Text>
          </View>
        </View>

        <Pressable
          style={styles.contactRow}
          onPress={() => Linking.openURL("mailto:support@freightet.com")}
        >
          <Ionicons name="mail-outline" size={18} color={colors.primary600} />
          <Text style={styles.contactValue}>support@freightet.com</Text>
          <Ionicons name="open-outline" size={14} color={colors.textTertiary} />
        </Pressable>

        <Pressable
          style={styles.contactRow}
          onPress={() => Linking.openURL("tel:+251911123456")}
        >
          <Ionicons name="call-outline" size={18} color={colors.primary600} />
          <Text style={styles.contactValue}>+251 911 123 456</Text>
          <Ionicons name="open-outline" size={14} color={colors.textTertiary} />
        </Pressable>
      </Card>

      {/* Report Issue */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Report an Issue</Text>
        <Text style={styles.sectionDesc}>
          Report bugs, misconduct, or send us feedback.
        </Text>

        {!showForm ? (
          <Button
            title="Submit a Report"
            onPress={() => setShowForm(true)}
            variant="outline"
            fullWidth
            style={styles.reportButton}
          />
        ) : (
          <View style={styles.form}>
            {/* Report Type Selector */}
            <Text style={styles.label}>Report Type</Text>
            <View style={styles.typeRow}>
              {REPORT_TYPES.map((rt) => (
                <Pressable
                  key={rt.value}
                  onPress={() => setSelectedType(rt.value)}
                  style={[
                    styles.typeChip,
                    selectedType === rt.value && styles.typeChipActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      selectedType === rt.value && styles.typeChipTextActive,
                    ]}
                  >
                    {rt.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Subject */}
            <Text style={styles.label}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief summary of the issue"
              placeholderTextColor={colors.textTertiary}
              maxLength={200}
            />

            {/* Description */}
            <Text style={styles.label}>Description</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={description}
              onChangeText={setDescription}
              placeholder="Please describe the issue in detail..."
              placeholderTextColor={colors.textTertiary}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
              maxLength={5000}
            />
            <Text style={styles.charCount}>{description.length}/5000</Text>

            {/* Actions */}
            <View style={styles.formActions}>
              <Button
                title="Cancel"
                onPress={() => {
                  setShowForm(false);
                  setSubject("");
                  setDescription("");
                }}
                variant="ghost"
              />
              <Button
                title={submitting ? "Submitting..." : "Submit Report"}
                onPress={handleSubmit}
                disabled={
                  submitting ||
                  subject.trim().length < 3 ||
                  description.trim().length < 10
                }
                loading={submitting}
              />
            </View>
          </View>
        )}
      </Card>

      {/* My Reports */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>My Reports</Text>
        <Text style={styles.sectionDesc}>
          Track the status of your submitted reports
        </Text>

        {loadingReports ? (
          <Text style={styles.emptyText}>Loading...</Text>
        ) : reports.length === 0 ? (
          <Text style={styles.emptyText}>No reports submitted yet</Text>
        ) : (
          reports.map((report) => (
            <View key={report.id} style={styles.reportItem}>
              <View style={styles.reportHeader}>
                <View style={styles.reportTypeBadge}>
                  <Text style={styles.reportTypeText}>{report.type}</Text>
                </View>
                <Text style={styles.reportRef}>{report.referenceId}</Text>
              </View>
              <Text style={styles.reportSubject} numberOfLines={1}>
                {report.subject}
              </Text>
              <View style={styles.reportFooter}>
                {report.submittedAt && (
                  <Text style={styles.reportDate}>
                    {new Date(report.submittedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                )}
                <View style={styles.reportStatusBadge}>
                  <Text style={styles.reportStatusText}>
                    {report.status === "SUBMITTED" ? "Pending" : report.status}
                  </Text>
                </View>
              </View>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contactCard: {
    margin: spacing.lg,
    marginBottom: 0,
    backgroundColor: colors.primary600,
  },
  contactHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  contactIconWrap: {
    width: 44,
    height: 44,
    borderRadius: borderRadius.lg,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  contactText: { flex: 1 },
  contactTitle: {
    ...typography.titleMedium,
    color: colors.white,
  },
  contactDesc: {
    ...typography.bodySmall,
    color: "rgba(255,255,255,0.8)",
    marginTop: 2,
  },
  contactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: "rgba(255,255,255,0.15)",
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    marginTop: spacing.sm,
  },
  contactValue: {
    ...typography.bodyMedium,
    color: colors.white,
    flex: 1,
  },
  card: { margin: spacing.lg },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  reportButton: { marginTop: spacing.sm },
  form: { marginTop: spacing.sm },
  label: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  typeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  typeChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  typeChipActive: {
    borderColor: colors.primary600,
    backgroundColor: colors.primary50,
  },
  typeChipText: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
  typeChipTextActive: {
    color: colors.primary700,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    backgroundColor: colors.surface,
  },
  textArea: {
    minHeight: 120,
  },
  charCount: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: "right",
    marginTop: spacing.xs,
  },
  formActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    textAlign: "center",
    paddingVertical: spacing.lg,
  },
  reportItem: {
    paddingVertical: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
  },
  reportHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  reportTypeBadge: {
    backgroundColor: colors.slate100,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.sm,
  },
  reportTypeText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.slate600,
    textTransform: "uppercase",
  },
  reportRef: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  reportSubject: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginTop: spacing.xs,
  },
  reportFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: spacing.xs,
  },
  reportDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
  },
  reportStatusBadge: {
    backgroundColor: colors.warningLight,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.full,
  },
  reportStatusText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.warningDark,
  },
});

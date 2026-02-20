/**
 * Settings/Profile Screen - Company profile management
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../../src/stores/auth";
import {
  useOrganization,
  useUpdateOrganization,
} from "../../../src/hooks/useOrganization";
import { Card } from "../../../src/components/Card";
import { StatusBadge } from "../../../src/components/StatusBadge";
import { LoadingSpinner } from "../../../src/components/LoadingSpinner";
import { Button } from "../../../src/components/Button";
import { colors } from "../../../src/theme/colors";
import { spacing } from "../../../src/theme/spacing";
import { typography } from "../../../src/theme/typography";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.organizationId;

  const { data: org, isLoading } = useOrganization(orgId);
  const updateMutation = useUpdateOrganization();

  const [syncedOrgId, setSyncedOrgId] = useState<string | undefined>();
  const [form, setForm] = useState({
    name: "",
    description: "",
    contactEmail: "",
    contactPhone: "",
    address: "",
    city: "",
    licenseNumber: "",
    taxId: "",
    allowNameDisplay: true,
  });

  if (org && org.id !== syncedOrgId) {
    setSyncedOrgId(org.id);
    setForm({
      name: org.name ?? "",
      description: org.description ?? "",
      contactEmail: org.contactEmail ?? "",
      contactPhone: org.contactPhone ?? "",
      address: org.address ?? "",
      city: org.city ?? "",
      licenseNumber: org.licenseNumber ?? "",
      taxId: org.taxId ?? "",
      allowNameDisplay: org.allowNameDisplay ?? true,
    });
  }

  const handleSave = () => {
    if (!orgId) return;
    updateMutation.mutate(
      { id: orgId, data: form },
      {
        onSuccess: () => Alert.alert("Success", "Profile updated successfully"),
        onError: (err) =>
          Alert.alert("Error", err.message ?? "Failed to update"),
      }
    );
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView style={styles.container}>
        {/* Verification Status */}
        <Card style={styles.section} padding="lg">
          <View style={styles.verifyRow}>
            <Text style={styles.sectionTitle}>Account Status</Text>
            <StatusBadge status={user?.status ?? "REGISTERED"} type="generic" />
          </View>
          <Text style={styles.fieldLabel}>{user?.email ?? ""}</Text>
        </Card>

        {/* Company Info */}
        <Card style={styles.section} padding="lg">
          <Text style={styles.sectionTitle}>Company Information</Text>
          <Text style={styles.fieldLabel}>Company Name</Text>
          <TextInput
            style={styles.input}
            value={form.name}
            onChangeText={(v) => setForm((p) => ({ ...p, name: v }))}
            placeholder="Company name"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.fieldLabel}>Description</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={form.description}
            onChangeText={(v) => setForm((p) => ({ ...p, description: v }))}
            placeholder="Company description"
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* Contact Info */}
        <Card style={styles.section} padding="lg">
          <Text style={styles.sectionTitle}>Contact Information</Text>
          <Text style={styles.fieldLabel}>Email</Text>
          <TextInput
            style={styles.input}
            value={form.contactEmail}
            onChangeText={(v) => setForm((p) => ({ ...p, contactEmail: v }))}
            placeholder="contact@company.com"
            placeholderTextColor={colors.textTertiary}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            value={form.contactPhone}
            onChangeText={(v) => setForm((p) => ({ ...p, contactPhone: v }))}
            placeholder="+251..."
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
          />
          <Text style={styles.fieldLabel}>Address</Text>
          <TextInput
            style={styles.input}
            value={form.address}
            onChangeText={(v) => setForm((p) => ({ ...p, address: v }))}
            placeholder="Street address"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.fieldLabel}>City</Text>
          <TextInput
            style={styles.input}
            value={form.city}
            onChangeText={(v) => setForm((p) => ({ ...p, city: v }))}
            placeholder="City"
            placeholderTextColor={colors.textTertiary}
          />
        </Card>

        {/* Legal Info */}
        <Card style={styles.section} padding="lg">
          <Text style={styles.sectionTitle}>Legal Information</Text>
          <Text style={styles.fieldLabel}>License Number</Text>
          <TextInput
            style={styles.input}
            value={form.licenseNumber}
            onChangeText={(v) => setForm((p) => ({ ...p, licenseNumber: v }))}
            placeholder="Business license number"
            placeholderTextColor={colors.textTertiary}
          />
          <Text style={styles.fieldLabel}>Tax ID</Text>
          <TextInput
            style={styles.input}
            value={form.taxId}
            onChangeText={(v) => setForm((p) => ({ ...p, taxId: v }))}
            placeholder="Tax identification number"
            placeholderTextColor={colors.textTertiary}
          />
        </Card>

        {/* Privacy */}
        <Card style={styles.section} padding="lg">
          <Text style={styles.sectionTitle}>Privacy</Text>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Display Company Name</Text>
              <Text style={styles.switchDesc}>
                Allow your company name to be visible to other users
              </Text>
            </View>
            <Switch
              value={form.allowNameDisplay}
              onValueChange={(v) =>
                setForm((p) => ({ ...p, allowNameDisplay: v }))
              }
              trackColor={{
                false: colors.slate300,
                true: colors.primary400,
              }}
              thumbColor={
                form.allowNameDisplay ? colors.primary600 : colors.slate100
              }
            />
          </View>
        </Card>

        {/* Save */}
        <View style={styles.saveRow}>
          <Button
            title={t("common.save")}
            variant="primary"
            size="lg"
            fullWidth
            onPress={handleSave}
            loading={updateMutation.isPending}
          />
        </View>

        <View style={{ height: spacing["4xl"] }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  section: {
    marginHorizontal: spacing["2xl"],
    marginTop: spacing.lg,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  verifyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  fieldLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginTop: spacing.sm,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.slate50,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  textArea: {
    minHeight: 72,
    textAlignVertical: "top",
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  switchLabel: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  switchDesc: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  saveRow: {
    paddingHorizontal: spacing["2xl"],
    marginTop: spacing["2xl"],
  },
});

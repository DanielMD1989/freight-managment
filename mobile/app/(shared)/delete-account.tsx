/**
 * Delete Account Screen — §14 Mobile Settings
 *
 * Requires password confirmation. Soft-deletes account (suspend + revoke sessions).
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import { useAuthStore } from "../../src/stores/auth";
import apiClient, { getErrorMessage } from "../../src/api/client";

export default function DeleteAccountScreen() {
  const logout = useAuthStore((s) => s.logout);
  const [password, setPassword] = useState("");
  const [reason, setReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!password.trim()) {
      Alert.alert("Error", "Password is required.");
      return;
    }

    Alert.alert(
      "Final Confirmation",
      "Are you absolutely sure? This cannot be easily undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete Forever",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            try {
              await apiClient.delete("/api/user/account", {
                data: {
                  password,
                  reason: reason.trim() || undefined,
                },
              });
              Alert.alert(
                "Account Deleted",
                "Your account has been deactivated. Contact support within 30 days to restore it.",
                [{ text: "OK", onPress: logout }]
              );
            } catch (error) {
              Alert.alert(
                "Error",
                getErrorMessage(error) || "Failed to delete account."
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* Warning Banner */}
      <View style={styles.warningBanner}>
        <Ionicons name="warning" size={24} color={colors.errorDark} />
        <View style={styles.warningText}>
          <Text style={styles.warningTitle}>This action is permanent</Text>
          <Text style={styles.warningDesc}>
            Your account will be deactivated, all sessions revoked, and your
            marketplace access removed. You have 30 days to contact support to
            restore your account.
          </Text>
        </View>
      </View>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Confirm Deletion</Text>

        <View style={styles.field}>
          <Text style={styles.label}>Password *</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter your password to confirm"
            placeholderTextColor={colors.textTertiary}
            autoComplete="current-password"
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>
            Reason <Text style={styles.labelOptional}>(optional)</Text>
          </Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={reason}
            onChangeText={setReason}
            placeholder="Why are you leaving? Help us improve."
            placeholderTextColor={colors.textTertiary}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            maxLength={500}
          />
        </View>

        <Button
          title={isDeleting ? "Deleting..." : "Delete My Account"}
          onPress={handleDelete}
          disabled={!password.trim() || isDeleting}
          loading={isDeleting}
          variant="destructive"
          fullWidth
          size="lg"
          style={styles.deleteButton}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    margin: spacing.lg,
    padding: spacing.lg,
    backgroundColor: colors.errorLight,
    borderRadius: borderRadius.xl,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  warningText: { flex: 1 },
  warningTitle: {
    ...typography.titleSmall,
    color: colors.errorDark,
    marginBottom: spacing.xs,
  },
  warningDesc: {
    ...typography.bodySmall,
    color: colors.errorDark,
    lineHeight: 18,
    opacity: 0.85,
  },
  card: { margin: spacing.lg, marginTop: 0 },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  field: { marginBottom: spacing.lg },
  label: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  labelOptional: {
    fontWeight: "400",
    color: colors.textTertiary,
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
    minHeight: 80,
  },
  deleteButton: { marginTop: spacing.md },
});

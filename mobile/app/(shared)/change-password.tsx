/**
 * Change Password Screen — §14 Mobile Security Settings
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
import { useRouter } from "expo-router";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import { useChangePassword } from "../../src/hooks/useSecurity";

const PASSWORD_MIN_LENGTH = 8;

function getPasswordStrength(password: string) {
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  return score;
}

const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
const strengthColors = [
  "",
  colors.error,
  colors.warning,
  colors.info,
  colors.success,
];

export default function ChangePasswordScreen() {
  const router = useRouter();
  const changePassword = useChangePassword();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const strength = getPasswordStrength(newPassword);
  const passwordsMatch = newPassword === confirmPassword;
  const isValid =
    currentPassword.length > 0 &&
    newPassword.length >= PASSWORD_MIN_LENGTH &&
    passwordsMatch &&
    strength >= 3;

  const handleSubmit = () => {
    if (!isValid) return;

    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          Alert.alert(
            "Password Changed",
            "Your password has been updated. Other sessions have been logged out.",
            [{ text: "OK", onPress: () => router.back() }]
          );
        },
        onError: (error) => {
          Alert.alert("Error", error.message || "Failed to change password");
        },
      }
    );
  };

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Change Password</Text>
        <Text style={styles.description}>
          Changing your password will log you out of all other devices.
        </Text>

        {/* Current Password */}
        <View style={styles.field}>
          <Text style={styles.label}>Current Password</Text>
          <TextInput
            style={styles.input}
            value={currentPassword}
            onChangeText={setCurrentPassword}
            secureTextEntry
            placeholder="Enter current password"
            placeholderTextColor={colors.textTertiary}
            autoComplete="current-password"
          />
        </View>

        {/* New Password */}
        <View style={styles.field}>
          <Text style={styles.label}>New Password</Text>
          <TextInput
            style={styles.input}
            value={newPassword}
            onChangeText={setNewPassword}
            secureTextEntry
            placeholder="Minimum 8 characters"
            placeholderTextColor={colors.textTertiary}
            autoComplete="new-password"
          />
          {newPassword.length > 0 && (
            <View style={styles.strengthRow}>
              {[1, 2, 3, 4].map((level) => (
                <View
                  key={level}
                  style={[
                    styles.strengthBar,
                    {
                      backgroundColor:
                        strength >= level
                          ? strengthColors[strength]
                          : colors.slate200,
                    },
                  ]}
                />
              ))}
              <Text
                style={[
                  styles.strengthLabel,
                  { color: strengthColors[strength] || colors.textTertiary },
                ]}
              >
                {strengthLabels[strength]}
              </Text>
            </View>
          )}
        </View>

        {/* Confirm Password */}
        <View style={styles.field}>
          <Text style={styles.label}>Confirm New Password</Text>
          <TextInput
            style={[
              styles.input,
              confirmPassword.length > 0 &&
                !passwordsMatch && { borderColor: colors.error },
            ]}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            placeholder="Re-enter new password"
            placeholderTextColor={colors.textTertiary}
            autoComplete="new-password"
          />
          {confirmPassword.length > 0 && !passwordsMatch && (
            <Text style={styles.errorText}>Passwords do not match</Text>
          )}
        </View>

        <Button
          title={changePassword.isPending ? "Changing..." : "Change Password"}
          onPress={handleSubmit}
          disabled={!isValid || changePassword.isPending}
          loading={changePassword.isPending}
          fullWidth
          size="lg"
          style={styles.submitButton}
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { margin: spacing.lg },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  description: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  field: { marginBottom: spacing.lg },
  label: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
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
  strengthRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: spacing.sm,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    ...typography.bodySmall,
    marginLeft: spacing.sm,
    minWidth: 40,
  },
  errorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.xs,
  },
  submitButton: { marginTop: spacing.md },
});

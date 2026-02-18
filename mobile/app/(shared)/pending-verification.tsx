/**
 * Pending Verification Screen
 * Shows when user is registered but not yet approved by admin
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/stores/auth";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function PendingVerificationScreen() {
  const { t } = useTranslation();
  const { logout, checkAuth } = useAuthStore();

  return (
    <View style={styles.container}>
      <Ionicons name="hourglass-outline" size={80} color={colors.accent500} />
      <Text style={styles.title}>{t("shared.pendingVerification")}</Text>
      <Text style={styles.message}>{t("shared.pendingMessage")}</Text>
      <View style={styles.actions}>
        <Button
          title="Check Status"
          onPress={checkAuth}
          variant="primary"
          size="lg"
          fullWidth
        />
        <Button
          title={t("auth.logout")}
          onPress={logout}
          variant="ghost"
          size="md"
          fullWidth
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing["3xl"],
    backgroundColor: colors.background,
  },
  title: {
    ...typography.headlineMedium,
    color: colors.textPrimary,
    marginTop: spacing["2xl"],
    textAlign: "center",
  },
  message: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    marginTop: spacing.lg,
    textAlign: "center",
    lineHeight: 24,
  },
  actions: { marginTop: spacing["3xl"], width: "100%", gap: spacing.md },
});

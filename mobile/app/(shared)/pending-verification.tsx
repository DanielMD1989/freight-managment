/**
 * Pending Verification Screen
 * Shows when user is registered but not yet approved by admin.
 * Displays status-specific messaging based on user.status.
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

function getStatusContent(status: string | undefined) {
  switch (status) {
    case "SUSPENDED":
      return {
        icon: "ban-outline" as const,
        iconColor: colors.error,
        titleKey: "shared.accountSuspended",
        titleFallback: "Account Suspended",
        messageKey: "shared.suspendedMessage",
        messageFallback:
          "Your account has been suspended. Please contact support for assistance.",
      };
    case "REGISTERED":
    case "PENDING_VERIFICATION":
    default:
      return {
        icon: "hourglass-outline" as const,
        iconColor: colors.accent500,
        titleKey: "shared.pendingVerification",
        titleFallback: "Pending Verification",
        messageKey: "shared.pendingMessage",
        messageFallback:
          "Your account is awaiting admin approval. This usually takes 1-2 business days.",
      };
  }
}

export default function PendingVerificationScreen() {
  const { t } = useTranslation();
  const { user, logout, checkAuth } = useAuthStore();
  const content = getStatusContent(user?.status);

  const title = t(content.titleKey, { defaultValue: content.titleFallback });
  const message = t(content.messageKey, {
    defaultValue: content.messageFallback,
  });

  return (
    <View style={styles.container}>
      <Ionicons name={content.icon} size={80} color={content.iconColor} />
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.message}>{message}</Text>
      <View style={styles.actions}>
        {user?.status !== "SUSPENDED" && (
          <Button
            title="Check Status"
            onPress={checkAuth}
            variant="primary"
            size="lg"
            fullWidth
          />
        )}
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

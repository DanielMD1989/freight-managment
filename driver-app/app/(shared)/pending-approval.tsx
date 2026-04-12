/**
 * Pending Approval Screen — shown when driver status is PENDING_VERIFICATION.
 * Auto-polls checkAuth every 30s; _layout.tsx routing redirects on status change.
 */
import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/auth";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

const POLL_INTERVAL_MS = 30_000;

export default function PendingApprovalScreen() {
  const { logout, checkAuth } = useAuthStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      checkAuth();
    }, POLL_INTERVAL_MS);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [checkAuth]);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons
          name="hourglass-outline"
          size={80}
          color={colors.primary500}
        />
        <Text style={styles.title}>Waiting for Approval</Text>
        <Text style={styles.message}>
          Your carrier is reviewing your application. You will receive a
          notification when your account is approved.
        </Text>
        <Text style={styles.hint}>This screen refreshes automatically.</Text>
      </View>
      <View style={styles.footer}>
        <Button
          title="Log Out"
          onPress={logout}
          variant="ghost"
          fullWidth
          size="lg"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing["3xl"],
  },
  title: {
    ...typography.headlineMedium,
    color: colors.textPrimary,
    marginTop: spacing.xl,
    textAlign: "center",
  },
  message: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: spacing.md,
    lineHeight: 24,
  },
  hint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: "center",
    marginTop: spacing.lg,
  },
  footer: {
    padding: spacing["2xl"],
  },
});

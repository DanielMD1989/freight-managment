/**
 * Account Suspended Screen — shown when driver status is SUSPENDED.
 */
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/auth";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function AccountSuspendedScreen() {
  const { logout } = useAuthStore();

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Ionicons name="ban-outline" size={80} color={colors.warning} />
        <Text style={styles.title}>Account Suspended</Text>
        <Text style={styles.message}>
          Your driver account has been suspended by your carrier. Please contact
          your carrier for more information.
        </Text>
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
  footer: { padding: spacing["2xl"] },
});

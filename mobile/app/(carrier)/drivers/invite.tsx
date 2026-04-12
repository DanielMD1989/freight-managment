/**
 * Invite Driver Screen — Task 22
 */
import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Alert } from "react-native";
import { useRouter } from "expo-router";
import { Input, Button, Card } from "../../../src/components";
import { colors, spacing, typography } from "../../../src/theme";
import { useInviteDriver } from "../../../src/hooks";

export default function InviteDriverScreen() {
  const router = useRouter();
  const inviteDriver = useInviteDriver();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<{
    inviteCode: string;
    expiresAt: string;
  } | null>(null);

  const handleSubmit = async () => {
    if (!name.trim() || !phone.trim()) {
      Alert.alert("Error", "Name and phone are required.");
      return;
    }
    try {
      const data = await inviteDriver.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        ...(email.trim() ? { email: email.trim() } : {}),
      });
      setResult({ inviteCode: data.inviteCode, expiresAt: data.expiresAt });
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Failed");
    }
  };

  if (result) {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={styles.container}
      >
        <Card style={styles.successCard}>
          <Text style={styles.successTitle}>Driver Invited!</Text>
          <Text style={styles.successMessage}>
            Share this code with your driver
          </Text>
          <View style={styles.codeBox}>
            <Text style={styles.codeLabel}>Invite Code</Text>
            <Text style={styles.code}>{result.inviteCode}</Text>
            <Text style={styles.expires}>
              Expires:{" "}
              {new Date(result.expiresAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </Text>
          </View>
          <Button
            title="Back to Drivers"
            onPress={() => router.back()}
            variant="primary"
            fullWidth
          />
        </Card>
      </ScrollView>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      style={styles.container}
    >
      <Card>
        <Text style={styles.formTitle}>Invite a New Driver</Text>
        <Text style={styles.formSubtitle}>
          Generate a 6-character invite code for a new driver.
        </Text>
        <Input
          label="Full Name"
          value={name}
          onChangeText={setName}
          placeholder="e.g. Abebe Kebede"
          required
        />
        <Input
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="e.g. 0912345678"
          keyboardType="phone-pad"
          required
        />
        <Input
          label="Email (optional)"
          value={email}
          onChangeText={setEmail}
          placeholder="driver@example.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Button
          title={
            inviteDriver.isPending
              ? "Creating Invite..."
              : "Generate Invite Code"
          }
          onPress={handleSubmit}
          disabled={inviteDriver.isPending || !name.trim() || !phone.trim()}
          loading={inviteDriver.isPending}
          variant="primary"
          fullWidth
        />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: { padding: spacing.lg },
  formTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  formSubtitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  successCard: { alignItems: "center" as const },
  successTitle: {
    ...typography.headlineMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  successMessage: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  codeBox: {
    backgroundColor: colors.primary50,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: "center" as const,
    marginBottom: spacing.xl,
    width: "100%" as const,
  },
  codeLabel: {
    ...typography.labelSmall,
    color: colors.primary600,
    textTransform: "uppercase" as const,
    marginBottom: spacing.xs,
  },
  code: {
    fontFamily: "monospace",
    fontSize: 36,
    fontWeight: "700",
    color: colors.primary700,
    letterSpacing: 6,
  },
  expires: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.md,
  },
});

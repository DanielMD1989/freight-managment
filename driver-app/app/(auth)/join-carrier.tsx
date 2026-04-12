/**
 * Join Carrier Screen — accept invite code flow
 * Three-step form: 1) code+phone, 2) password, 3) CDL info (optional)
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/auth";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

type Step = 1 | 2 | 3;

export default function JoinCarrierScreen() {
  const router = useRouter();
  const { acceptInvite, isLoading, error, clearError } = useAuthStore();

  const [step, setStep] = useState<Step>(1);
  const [inviteCode, setInviteCode] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [cdlNumber, setCdlNumber] = useState("");
  const [cdlExpiry, setCdlExpiry] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    loginEmail: string;
    driverId: string;
  } | null>(null);

  const handleNext = () => {
    setLocalError(null);
    clearError();

    if (step === 1) {
      if (inviteCode.trim().length !== 6) {
        setLocalError("Invite code must be 6 characters");
        return;
      }
      if (!phone.trim()) {
        setLocalError("Phone number is required");
        return;
      }
      setStep(2);
    } else if (step === 2) {
      if (password.length < 8) {
        setLocalError("Password must be at least 8 characters");
        return;
      }
      if (password !== confirmPassword) {
        setLocalError("Passwords do not match");
        return;
      }
      setStep(3);
    }
  };

  const handleSubmit = async () => {
    setLocalError(null);
    clearError();
    try {
      const data = await acceptInvite({
        inviteCode: inviteCode.trim().toUpperCase(),
        phone: phone.trim(),
        password,
        ...(cdlNumber.trim() ? { cdlNumber: cdlNumber.trim() } : {}),
        ...(cdlExpiry.trim() ? { cdlExpiry: cdlExpiry.trim() } : {}),
      });
      setResult({ loginEmail: data.loginEmail, driverId: data.driverId });
    } catch {
      // Error displayed from store
    }
  };

  const displayError = localError || error;

  // Success screen
  if (result) {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        style={styles.container}
      >
        <View style={styles.header}>
          <Ionicons name="checkmark-circle" size={80} color={colors.success} />
          <Text style={styles.title}>Registration Complete!</Text>
          <Text style={styles.subtitle}>
            Your account is pending carrier approval.
          </Text>
        </View>

        <View style={styles.emailBox}>
          <Text style={styles.emailLabel}>Your login email:</Text>
          <Text style={styles.emailValue}>{result.loginEmail}</Text>
          <Text style={styles.emailHint}>
            Save this — you&apos;ll need it to sign in once approved.
          </Text>
        </View>

        <Button
          title="Go to Login"
          onPress={() => router.replace("/(auth)/login")}
          variant="primary"
          fullWidth
          size="lg"
        />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Ionicons name="people" size={48} color={colors.primary500} />
          </View>
          <Text style={styles.title}>Join Your Carrier</Text>
          <Text style={styles.subtitle}>Step {step} of 3</Text>
        </View>

        {/* Step indicator */}
        <View style={styles.steps}>
          {[1, 2, 3].map((s) => (
            <View
              key={s}
              style={[styles.stepDot, s <= step && styles.stepDotActive]}
            />
          ))}
        </View>

        {displayError && <Text style={styles.error}>{displayError}</Text>}

        {/* Step 1: Invite code + phone */}
        {step === 1 && (
          <View style={styles.form}>
            <Input
              label="Invite Code"
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              placeholder="ABC123"
              maxLength={6}
              autoCapitalize="characters"
              required
              leftIcon={
                <Ionicons
                  name="ticket-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />
            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="0912345678"
              keyboardType="phone-pad"
              required
              leftIcon={
                <Ionicons
                  name="call-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />
            <Button
              title="Next"
              onPress={handleNext}
              variant="primary"
              fullWidth
              size="lg"
            />
          </View>
        )}

        {/* Step 2: Password */}
        {step === 2 && (
          <View style={styles.form}>
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              isPassword
              autoCapitalize="none"
              placeholder="Min 8 characters"
              required
              leftIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />
            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
              autoCapitalize="none"
              placeholder="Re-enter password"
              required
              leftIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />
            <View style={styles.buttonRow}>
              <Button
                title="Back"
                onPress={() => setStep(1)}
                variant="ghost"
                size="lg"
              />
              <Button
                title="Next"
                onPress={handleNext}
                variant="primary"
                size="lg"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {/* Step 3: CDL info (optional) */}
        {step === 3 && (
          <View style={styles.form}>
            <Text style={styles.optionalHint}>
              CDL info is optional. You can add it later from your profile.
            </Text>
            <Input
              label="CDL Number"
              value={cdlNumber}
              onChangeText={setCdlNumber}
              placeholder="Optional"
              leftIcon={
                <Ionicons
                  name="card-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />
            <Input
              label="CDL Expiry (YYYY-MM-DD)"
              value={cdlExpiry}
              onChangeText={setCdlExpiry}
              placeholder="e.g. 2027-06-15"
              leftIcon={
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />
            <View style={styles.buttonRow}>
              <Button
                title="Back"
                onPress={() => setStep(2)}
                variant="ghost"
                size="lg"
              />
              <Button
                title="Complete Registration"
                onPress={handleSubmit}
                loading={isLoading}
                variant="primary"
                size="lg"
                style={{ flex: 1 }}
              />
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>Already have an account? </Text>
          <TouchableOpacity onPress={() => router.push("/(auth)/login")}>
            <Text style={styles.footerLink}>Sign In</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  header: { alignItems: "center", marginBottom: spacing.xl },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: colors.primary50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: spacing.lg,
  },
  title: {
    ...typography.displaySmall,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  subtitle: { ...typography.bodyLarge, color: colors.textSecondary },
  steps: {
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.slate200,
  },
  stepDotActive: { backgroundColor: colors.primary500 },
  form: { marginBottom: spacing["2xl"] },
  optionalHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: "center",
    marginBottom: spacing.lg,
  },
  error: {
    ...typography.bodySmall,
    color: colors.error,
    textAlign: "center",
    marginBottom: spacing.lg,
    padding: spacing.md,
    backgroundColor: colors.errorLight,
    borderRadius: 8,
    overflow: "hidden",
  },
  emailBox: {
    backgroundColor: colors.primary50,
    borderRadius: 12,
    padding: spacing.xl,
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  emailLabel: {
    ...typography.labelSmall,
    color: colors.primary600,
    textTransform: "uppercase",
    marginBottom: spacing.xs,
  },
  emailValue: {
    ...typography.titleLarge,
    color: colors.primary700,
    textAlign: "center",
  },
  emailHint: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.md,
    textAlign: "center",
  },
  buttonRow: { flexDirection: "row", gap: spacing.md },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: { ...typography.bodyMedium, color: colors.textSecondary },
  footerLink: { ...typography.labelLarge, color: colors.primary600 },
});

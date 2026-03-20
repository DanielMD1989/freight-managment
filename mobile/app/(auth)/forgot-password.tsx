/**
 * Forgot Password Screen
 *
 * 3-step flow: email → OTP + new password → success
 * Mirrors web forgot-password page with 5-rule password strength
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
import { useTranslation } from "react-i18next";
import { authService } from "../../src/services/auth";
import { Input } from "../../src/components/Input";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

type Step = "email" | "otp" | "success";

const PASSWORD_CHECKS = [
  { label: "At least 8 characters", test: (p: string) => p.length >= 8 },
  { label: "Uppercase letter", test: (p: string) => /[A-Z]/.test(p) },
  { label: "Lowercase letter", test: (p: string) => /[a-z]/.test(p) },
  { label: "Number", test: (p: string) => /[0-9]/.test(p) },
  {
    label: "Special character",
    test: (p: string) => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(p),
  },
];

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const passwordStrength = PASSWORD_CHECKS.filter((c) =>
    c.test(newPassword)
  ).length;

  const canSubmitReset =
    otp.length === 6 &&
    passwordStrength === 5 &&
    newPassword === confirmPassword &&
    !isLoading;

  const handleRequestOTP = async () => {
    if (!email.trim()) {
      setError("Please enter your email address");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await authService.requestPasswordReset(email.trim());
      setStep("otp");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset code"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      await authService.resetPassword(email, otp, newPassword);
      setStep("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password");
    } finally {
      setIsLoading(false);
    }
  };

  const getStrengthColor = () => {
    if (passwordStrength <= 1) return colors.error;
    if (passwordStrength <= 2) return "#f97316"; // orange
    if (passwordStrength <= 3) return "#eab308"; // yellow
    if (passwordStrength <= 4) return "#84cc16"; // lime
    return "#22c55e"; // green
  };

  const getStrengthLabel = () => {
    if (passwordStrength <= 1) return "Weak";
    if (passwordStrength === 2) return "Fair";
    if (passwordStrength === 3) return "Moderate";
    if (passwordStrength === 4) return "Good";
    return "Strong";
  };

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
            <Ionicons
              name={
                step === "success" ? "checkmark-circle" : "lock-open-outline"
              }
              size={48}
              color={step === "success" ? "#22c55e" : colors.primary500}
            />
          </View>
          <Text style={styles.title}>
            {step === "success" ? "Password Reset Complete" : "Reset Password"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "email" && "Enter your email to receive a reset code"}
            {step === "otp" && "Enter the code and your new password"}
            {step === "success" && "Your password has been successfully reset."}
          </Text>
        </View>

        {/* Step 1: Email */}
        {step === "email" && (
          <View style={styles.form}>
            <Input
              label={t("auth.email")}
              value={email}
              onChangeText={(text: string) => {
                setEmail(text);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              placeholder="you@example.com"
              leftIcon={
                <Ionicons
                  name="mail-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title={isLoading ? "Sending..." : "Send Reset Code"}
              onPress={handleRequestOTP}
              loading={isLoading}
              fullWidth
              size="lg"
            />
          </View>
        )}

        {/* Step 2: OTP + New Password */}
        {step === "otp" && (
          <View style={styles.form}>
            <Input
              label="Reset Code"
              value={otp}
              onChangeText={(text: string) =>
                setOtp(text.replace(/\D/g, "").slice(0, 6))
              }
              keyboardType="number-pad"
              maxLength={6}
              placeholder="000000"
              leftIcon={
                <Ionicons
                  name="key-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />

            <Input
              label="New Password"
              value={newPassword}
              onChangeText={(text: string) => {
                setNewPassword(text);
                setError(null);
              }}
              isPassword
              autoCapitalize="none"
              placeholder="Enter new password"
              leftIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />

            {/* Password strength bar */}
            {newPassword.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={styles.strengthBar}>
                  {[1, 2, 3, 4, 5].map((level) => (
                    <View
                      key={level}
                      style={[
                        styles.strengthSegment,
                        {
                          backgroundColor:
                            passwordStrength >= level
                              ? getStrengthColor()
                              : colors.slate200,
                        },
                      ]}
                    />
                  ))}
                </View>
                <Text
                  style={[styles.strengthLabel, { color: getStrengthColor() }]}
                >
                  {getStrengthLabel()}
                </Text>
              </View>
            )}

            {/* Password checklist */}
            <View style={styles.checklist}>
              {PASSWORD_CHECKS.map((check) => {
                const met = check.test(newPassword);
                return (
                  <View key={check.label} style={styles.checkItem}>
                    <Ionicons
                      name={met ? "checkmark-circle" : "ellipse-outline"}
                      size={16}
                      color={met ? "#22c55e" : colors.slate400}
                    />
                    <Text
                      style={[styles.checkText, met && styles.checkTextMet]}
                    >
                      {check.label}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Input
              label="Confirm Password"
              value={confirmPassword}
              onChangeText={(text: string) => {
                setConfirmPassword(text);
                setError(null);
              }}
              isPassword
              autoCapitalize="none"
              placeholder="Confirm new password"
              leftIcon={
                <Ionicons
                  name="lock-closed-outline"
                  size={20}
                  color={colors.slate400}
                />
              }
            />

            {confirmPassword.length > 0 && newPassword !== confirmPassword && (
              <Text style={styles.mismatch}>Passwords do not match</Text>
            )}

            {error && <Text style={styles.error}>{error}</Text>}

            <Button
              title={isLoading ? "Resetting..." : "Reset Password"}
              onPress={handleResetPassword}
              loading={isLoading}
              disabled={!canSubmitReset}
              fullWidth
              size="lg"
            />

            <TouchableOpacity
              style={styles.retryLink}
              onPress={() => {
                setStep("email");
                setOtp("");
                setNewPassword("");
                setConfirmPassword("");
                setError(null);
              }}
            >
              <Text style={styles.retryText}>
                Didn&apos;t receive a code? Try again
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Step 3: Success */}
        {step === "success" && (
          <View style={styles.form}>
            <Button
              title="Go to Login"
              onPress={() => router.replace("/(auth)/login")}
              fullWidth
              size="lg"
            />
          </View>
        )}

        {/* Back to login link */}
        {step !== "success" && (
          <View style={styles.footer}>
            <Text style={styles.footerText}>Remember your password? </Text>
            <TouchableOpacity onPress={() => router.replace("/(auth)/login")}>
              <Text style={styles.footerLink}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: spacing["2xl"],
  },
  header: {
    alignItems: "center",
    marginBottom: spacing["3xl"],
  },
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
    marginBottom: spacing.sm,
  },
  subtitle: {
    ...typography.bodyLarge,
    color: colors.textSecondary,
    textAlign: "center",
  },
  form: {
    marginBottom: spacing["2xl"],
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
  mismatch: {
    ...typography.bodySmall,
    color: colors.error,
    marginBottom: spacing.sm,
  },
  strengthContainer: {
    marginBottom: spacing.sm,
  },
  strengthBar: {
    flexDirection: "row",
    gap: 4,
    marginBottom: 4,
  },
  strengthSegment: {
    flex: 1,
    height: 4,
    borderRadius: 2,
  },
  strengthLabel: {
    ...typography.bodySmall,
  },
  checklist: {
    marginBottom: spacing.lg,
  },
  checkItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  checkText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  checkTextMet: {
    color: "#22c55e",
  },
  retryLink: {
    alignItems: "center",
    marginTop: spacing.lg,
  },
  retryText: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  footerText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  footerLink: {
    ...typography.labelLarge,
    color: colors.primary600,
  },
});

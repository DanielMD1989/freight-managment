/**
 * MFA Management Screen — §14 Mobile Security Settings
 *
 * Enable/disable two-factor authentication, view recovery codes.
 */
import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Alert,
  Pressable,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import {
  useEnableMfa,
  useVerifyMfaSetup,
  useDisableMfa,
  useRecoveryCodesStatus,
} from "../../src/hooks/useSecurity";
import { useAuthStore } from "../../src/stores/auth";

type Step = "status" | "enter-phone" | "verify-otp" | "show-codes" | "disable";

export default function MfaScreen() {
  const user = useAuthStore((s) => s.user);
  // Determine MFA status from user data; default false if unavailable
  const [mfaEnabled, setMfaEnabled] = useState(false);

  const [step, setStep] = useState<Step>("status");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [password, setPassword] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [phoneLastFour, setPhoneLastFour] = useState("");

  const enableMfa = useEnableMfa();
  const verifyMfa = useVerifyMfaSetup();
  const disableMfa = useDisableMfa();
  const recoveryStatus = useRecoveryCodesStatus();

  // ── Enable Flow ──

  const handleSendOtp = () => {
    if (!phone.trim()) return;
    enableMfa.mutate(phone, {
      onSuccess: (data) => {
        setPhoneLastFour(data.phoneLastFour);
        setStep("verify-otp");
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    });
  };

  const handleVerifyOtp = () => {
    if (otp.length !== 6) return;
    verifyMfa.mutate(otp, {
      onSuccess: (data) => {
        setRecoveryCodes(data.recoveryCodes);
        setMfaEnabled(true);
        setStep("show-codes");
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    });
  };

  // ── Disable Flow ──

  const handleDisable = () => {
    if (!password.trim()) return;
    disableMfa.mutate(password, {
      onSuccess: () => {
        setMfaEnabled(false);
        setStep("status");
        setPassword("");
        Alert.alert(
          "MFA Disabled",
          "Two-factor authentication has been disabled."
        );
      },
      onError: (error) => {
        Alert.alert("Error", error.message);
      },
    });
  };

  const copyAllCodes = () => {
    // Show all codes in an alert for easy copying on mobile
    Alert.alert("Recovery Codes", recoveryCodes.join("\n"), [{ text: "OK" }]);
  };

  // ── Status Screen ──

  if (step === "status") {
    return (
      <ScrollView style={styles.container}>
        <Card style={styles.card}>
          {/* MFA Status Badge */}
          <View
            style={[
              styles.statusBadge,
              {
                backgroundColor: mfaEnabled
                  ? colors.successLight
                  : colors.slate100,
              },
            ]}
          >
            <Ionicons
              name={mfaEnabled ? "shield-checkmark" : "shield-outline"}
              size={28}
              color={mfaEnabled ? colors.success : colors.slate400}
            />
            <View style={styles.statusText}>
              <Text style={styles.statusTitle}>Two-Factor Authentication</Text>
              <Text
                style={[
                  styles.statusValue,
                  { color: mfaEnabled ? colors.success : colors.textTertiary },
                ]}
              >
                {mfaEnabled ? "Enabled" : "Disabled"}
              </Text>
            </View>
          </View>

          {mfaEnabled ? (
            <>
              {/* Recovery Codes Status */}
              {recoveryStatus.data && (
                <View style={styles.codesStatus}>
                  <Text style={styles.codesLabel}>Recovery Codes</Text>
                  <Text style={styles.codesValue}>
                    {recoveryStatus.data.remainingCodes} of{" "}
                    {recoveryStatus.data.totalCodes} remaining
                  </Text>
                  {recoveryStatus.data.warning && (
                    <Text style={styles.codesWarning}>
                      {recoveryStatus.data.warning}
                    </Text>
                  )}
                </View>
              )}

              <Button
                title="Disable MFA"
                onPress={() => {
                  setPassword("");
                  setStep("disable");
                }}
                variant="destructive"
                fullWidth
                style={styles.actionButton}
              />
            </>
          ) : (
            <>
              <Text style={styles.description}>
                Add an extra layer of security to your account. When enabled,
                you will need to enter a verification code from your phone when
                logging in.
              </Text>
              <Button
                title="Enable MFA"
                onPress={() => {
                  setPhone("");
                  setOtp("");
                  setStep("enter-phone");
                }}
                fullWidth
                style={styles.actionButton}
              />
            </>
          )}
        </Card>
      </ScrollView>
    );
  }

  // ── Enter Phone ──

  if (step === "enter-phone") {
    return (
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.stepTitle}>Step 1: Enter Phone Number</Text>
          <Text style={styles.description}>
            We will send a verification code to this number.
          </Text>

          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="09XXXXXXXX"
            placeholderTextColor={colors.textTertiary}
            keyboardType="phone-pad"
            autoFocus
          />

          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              onPress={() => setStep("status")}
              variant="ghost"
            />
            <Button
              title={enableMfa.isPending ? "Sending..." : "Send Code"}
              onPress={handleSendOtp}
              disabled={!phone.trim() || enableMfa.isPending}
              loading={enableMfa.isPending}
            />
          </View>
        </Card>
      </ScrollView>
    );
  }

  // ── Verify OTP ──

  if (step === "verify-otp") {
    return (
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.stepTitle}>Step 2: Enter Verification Code</Text>
          <Text style={styles.description}>
            Enter the 6-digit code sent to ****{phoneLastFour}
          </Text>

          <TextInput
            style={[styles.input, styles.otpInput]}
            value={otp}
            onChangeText={(text) =>
              setOtp(text.replace(/[^0-9]/g, "").slice(0, 6))
            }
            placeholder="000000"
            placeholderTextColor={colors.textTertiary}
            keyboardType="number-pad"
            maxLength={6}
            autoFocus
          />

          <View style={styles.buttonRow}>
            <Button
              title="Back"
              onPress={() => setStep("enter-phone")}
              variant="ghost"
            />
            <Button
              title={verifyMfa.isPending ? "Verifying..." : "Verify"}
              onPress={handleVerifyOtp}
              disabled={otp.length !== 6 || verifyMfa.isPending}
              loading={verifyMfa.isPending}
            />
          </View>
        </Card>
      </ScrollView>
    );
  }

  // ── Show Recovery Codes ──

  if (step === "show-codes") {
    return (
      <ScrollView style={styles.container}>
        <Card style={styles.card}>
          <View style={styles.successBanner}>
            <Ionicons
              name="checkmark-circle"
              size={24}
              color={colors.success}
            />
            <Text style={styles.successText}>MFA Enabled Successfully</Text>
          </View>

          <Text style={styles.stepTitle}>Step 3: Save Recovery Codes</Text>

          <View style={styles.warningBanner}>
            <Ionicons name="warning" size={18} color={colors.warningDark} />
            <Text style={styles.warningText}>
              Save these codes in a safe place. They will not be shown again.
              Use them to log in if you lose access to your phone.
            </Text>
          </View>

          <View style={styles.codesGrid}>
            {recoveryCodes.map((code, i) => (
              <View key={i} style={styles.codeItem}>
                <Text style={styles.codeText}>{code}</Text>
              </View>
            ))}
          </View>

          <Pressable onPress={copyAllCodes} style={styles.copyButton}>
            <Ionicons name="copy-outline" size={16} color={colors.primary600} />
            <Text style={styles.copyText}>Copy All Codes</Text>
          </Pressable>

          <Button
            title="I Have Saved My Codes"
            onPress={() => setStep("status")}
            fullWidth
            size="lg"
            style={styles.actionButton}
          />
        </Card>
      </ScrollView>
    );
  }

  // ── Disable Confirmation ──

  if (step === "disable") {
    return (
      <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          <Text style={styles.stepTitle}>
            Disable Two-Factor Authentication
          </Text>
          <Text style={styles.description}>
            Enter your password to disable MFA. This will also log out all other
            sessions for security.
          </Text>

          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="Enter your password"
            placeholderTextColor={colors.textTertiary}
            autoFocus
          />

          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              onPress={() => setStep("status")}
              variant="ghost"
            />
            <Button
              title={disableMfa.isPending ? "Disabling..." : "Disable MFA"}
              onPress={handleDisable}
              disabled={!password.trim() || disableMfa.isPending}
              loading={disableMfa.isPending}
              variant="destructive"
            />
          </View>
        </Card>
      </ScrollView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { margin: spacing.lg },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  statusText: { flex: 1 },
  statusTitle: { ...typography.titleSmall, color: colors.textPrimary },
  statusValue: { ...typography.bodySmall, marginTop: 2 },
  description: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.lg,
    lineHeight: 22,
  },
  actionButton: { marginTop: spacing.md },
  stepTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
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
    marginBottom: spacing.lg,
  },
  otpInput: {
    fontSize: 24,
    letterSpacing: 8,
    textAlign: "center",
    fontFamily: undefined,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.md,
  },
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successLight,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  successText: {
    ...typography.labelLarge,
    color: colors.successDark,
  },
  warningBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.sm,
    backgroundColor: colors.warningLight,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  warningText: {
    ...typography.bodySmall,
    color: colors.warningDark,
    flex: 1,
    lineHeight: 18,
  },
  codesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  codeItem: {
    width: "47%",
    backgroundColor: colors.slate100,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.md,
    alignItems: "center",
  },
  codeText: {
    fontFamily: undefined,
    fontWeight: "600",
    fontSize: 14,
    color: colors.textPrimary,
    letterSpacing: 1,
  },
  copyButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    marginBottom: spacing.md,
  },
  copyText: {
    ...typography.labelMedium,
    color: colors.primary600,
  },
  codesStatus: {
    backgroundColor: colors.slate50,
    padding: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.lg,
  },
  codesLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  codesValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  codesWarning: {
    ...typography.bodySmall,
    color: colors.warning,
    marginTop: spacing.xs,
  },
});

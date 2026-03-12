/**
 * Pending Verification Screen
 *
 * G-M8-1: Auto-polls every 30s (parity with web)
 * G-M8-2: Shows 4-step progress checklist + document count
 * G-M8-3: Distinguishes REGISTERED vs PENDING_VERIFICATION
 * G-M8-4: Inline OTP email verification flow
 */
import React, { useEffect, useRef, useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/stores/auth";
import { useVerificationStatus } from "../../src/hooks/useVerificationStatus";
import { Button } from "../../src/components/Button";
import apiClient from "../../src/api/client";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function PendingVerificationScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { user, logout, checkAuth } = useAuthStore();

  // G-M8-1: Auto-polling via useVerificationStatus (30s refetchInterval)
  const { data, isLoading, refetch } = useVerificationStatus({
    enabled: user?.status !== "SUSPENDED",
  });

  // G-M8-1: Also poll checkAuth every 30s so AuthGuard detects ACTIVE
  useEffect(() => {
    if (user?.status === "SUSPENDED") return;
    const interval = setInterval(() => {
      checkAuth();
    }, 30_000);
    return () => clearInterval(interval);
  }, [checkAuth, user?.status]);

  // ── OTP state (G-M8-4) ──────────────────────────────────────────
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpCountdown, setOtpCountdown] = useState(0);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback((seconds: number) => {
    setOtpCountdown(seconds);
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setOtpCountdown((prev) => {
        if (prev <= 1) {
          if (countdownRef.current) clearInterval(countdownRef.current);
          countdownRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  const sendOtp = async () => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await apiClient.post("/api/auth/send-otp", {
        channel: "email",
      });
      setOtpSent(true);
      startCountdown(res.data.expiresIn ?? 600);
    } catch (error: any) {
      setOtpError(
        error?.response?.data?.error || error?.message || "Failed to send OTP"
      );
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      await apiClient.post("/api/auth/verify-otp", { code: otpCode });
      setOtpVerified(true);
      refetch();
    } catch (error: any) {
      setOtpError(
        error?.response?.data?.error || error?.message || "Verification failed"
      );
    } finally {
      setOtpLoading(false);
    }
  };

  // ── Suspended state ──────────────────────────────────────────────
  if (user?.status === "SUSPENDED") {
    return (
      <View style={styles.container}>
        <Ionicons name="ban-outline" size={80} color={colors.error} />
        <Text style={styles.title}>
          {t("shared.accountSuspended", {
            defaultValue: "Account Suspended",
          })}
        </Text>
        <Text style={styles.message}>
          {t("shared.suspendedMessage", {
            defaultValue:
              "Your account has been suspended. Please contact support for assistance.",
          })}
        </Text>
        <View style={styles.actions}>
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

  // ── Loading state ────────────────────────────────────────────────
  if (isLoading && !data) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </View>
    );
  }

  const steps = data?.verification?.steps ?? [];
  const progress = data?.verification?.progressPercent ?? 0;
  const documentCount = data?.verification?.documentCount ?? 0;
  const isEmailVerified = data?.verification?.isEmailVerified ?? true;
  const nextAction = data?.nextAction;

  // G-M8-3: Different badge text for REGISTERED vs PENDING_VERIFICATION
  const statusBadge =
    user?.status === "PENDING_VERIFICATION"
      ? "Under Review"
      : "Registration Complete";
  const statusColor =
    user?.status === "PENDING_VERIFICATION" ? colors.warning : colors.accent500;

  const docsRoute =
    user?.role === "CARRIER" ? "/(carrier)/documents" : "/(shipper)/documents";

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      {/* Header */}
      <View style={styles.header}>
        <Ionicons name="shield-checkmark-outline" size={40} color="#fff" />
        <Text style={styles.headerTitle}>Account Verification</Text>
        <Text style={styles.headerEmail}>{user?.email}</Text>
      </View>

      {/* Progress Bar */}
      <View style={styles.section}>
        <View style={styles.progressRow}>
          <Text style={styles.progressLabel}>Progress</Text>
          <Text style={styles.progressPercent}>{progress}%</Text>
        </View>
        <View style={styles.progressBar}>
          <View
            style={[styles.progressFill, { width: `${progress}%` as any }]}
          />
        </View>
      </View>

      {/* OTP Verification (G-M8-4) */}
      {!isEmailVerified && !otpVerified && (
        <View style={styles.section}>
          <View style={styles.otpCard}>
            <Text style={styles.otpTitle}>Email Verification Required</Text>
            {!otpSent ? (
              <>
                <Text style={styles.otpMessage}>
                  We need to verify your email address before proceeding.
                </Text>
                <Button
                  title={otpLoading ? "Sending..." : "Send Verification Code"}
                  onPress={sendOtp}
                  variant="primary"
                  size="md"
                  fullWidth
                  disabled={otpLoading}
                />
              </>
            ) : (
              <>
                <Text style={styles.otpMessage}>
                  Enter the 6-digit code sent to {user?.email}
                </Text>
                <View style={styles.otpInputRow}>
                  <TextInput
                    style={styles.otpInput}
                    value={otpCode}
                    onChangeText={(text) =>
                      setOtpCode(text.replace(/\D/g, "").slice(0, 6))
                    }
                    keyboardType="number-pad"
                    maxLength={6}
                    placeholder="000000"
                    placeholderTextColor={colors.textTertiary}
                  />
                  <Button
                    title={otpLoading ? "..." : "Verify"}
                    onPress={verifyOtp}
                    variant="primary"
                    size="md"
                    disabled={otpLoading || otpCode.length !== 6}
                  />
                </View>
                {otpCountdown > 0 ? (
                  <Text style={styles.otpCountdown}>
                    Code expires in {Math.floor(otpCountdown / 60)}:
                    {String(otpCountdown % 60).padStart(2, "0")}
                  </Text>
                ) : (
                  <Button
                    title="Resend Code"
                    onPress={sendOtp}
                    variant="ghost"
                    size="sm"
                    disabled={otpLoading}
                  />
                )}
              </>
            )}
            {otpError && <Text style={styles.otpErrorText}>{otpError}</Text>}
          </View>
        </View>
      )}

      {/* OTP Verified success */}
      {otpVerified && (
        <View style={styles.section}>
          <View style={styles.successBanner}>
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.success}
            />
            <Text style={styles.successText}>Email verified successfully</Text>
          </View>
        </View>
      )}

      {/* Status Badge (G-M8-3) */}
      <View style={styles.section}>
        <View style={[styles.badge, { borderColor: statusColor }]}>
          <View style={[styles.badgeDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {statusBadge}
          </Text>
        </View>
      </View>

      {/* Verification Steps (G-M8-2) */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Verification Steps</Text>
        {steps.map((step) => (
          <View key={step.id} style={styles.stepRow}>
            <View
              style={[
                styles.stepIcon,
                step.status === "completed" && styles.stepIconCompleted,
                step.status === "pending" && styles.stepIconPending,
              ]}
            >
              {step.status === "completed" ? (
                <Ionicons name="checkmark" size={18} color={colors.success} />
              ) : step.status === "pending" ? (
                <ActivityIndicator size="small" color={colors.warning} />
              ) : (
                <View style={styles.stepDot} />
              )}
            </View>
            <View style={styles.stepContent}>
              <Text
                style={[
                  styles.stepLabel,
                  step.status === "completed" && { color: colors.success },
                  step.status === "pending" && { color: colors.warning },
                  step.status === "not_started" && {
                    color: colors.textTertiary,
                  },
                ]}
              >
                {step.label}
                {step.status === "pending" && (
                  <Text style={styles.stepBadge}> In Progress</Text>
                )}
              </Text>
              {step.description && (
                <Text style={styles.stepDescription}>{step.description}</Text>
              )}
            </View>
          </View>
        ))}
      </View>

      {/* Next Action */}
      {nextAction && (
        <View style={styles.section}>
          <View style={styles.actionCard}>
            <Text style={styles.actionTitle}>{nextAction.label}</Text>
            <Text style={styles.actionDescription}>
              {nextAction.description}
            </Text>
            {nextAction.type === "upload_documents" && (
              <Button
                title="Upload Documents"
                onPress={() => router.push(docsRoute as any)}
                variant="primary"
                size="md"
                fullWidth
              />
            )}
          </View>
        </View>
      )}

      {/* Estimated Time */}
      {data?.estimatedReviewTime && (
        <View style={styles.section}>
          <View style={styles.timeRow}>
            <Ionicons
              name="time-outline"
              size={20}
              color={colors.textTertiary}
            />
            <Text style={styles.timeText}>
              Estimated review time:{" "}
              <Text style={styles.timeBold}>{data.estimatedReviewTime}</Text>
            </Text>
          </View>
        </View>
      )}

      {/* Organization Info */}
      {data?.organization && (
        <View style={styles.section}>
          <View style={styles.orgCard}>
            <Ionicons
              name="business-outline"
              size={24}
              color={colors.textSecondary}
            />
            <View style={styles.orgInfo}>
              <Text style={styles.orgName}>{data.organization.name}</Text>
              <Text style={styles.orgType}>
                {data.organization.type.replace(/_/g, " ")}
              </Text>
            </View>
          </View>
        </View>
      )}

      {/* Footer Actions */}
      <View style={styles.footerActions}>
        <Button
          title="Check Status"
          onPress={() => {
            checkAuth();
            refetch();
          }}
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
    </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    backgroundColor: colors.background,
  },
  // Header
  header: {
    backgroundColor: colors.primary500,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing["2xl"],
    alignItems: "center",
  },
  headerTitle: {
    ...typography.headlineSmall,
    color: "#fff",
    marginTop: spacing.md,
  },
  headerEmail: {
    ...typography.bodySmall,
    color: "rgba(255,255,255,0.7)",
    marginTop: spacing.xs,
  },
  // Sections
  section: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    ...typography.titleMedium,
    color: colors.textPrimary,
    marginBottom: spacing.md,
  },
  // Progress
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  progressLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
  },
  progressPercent: {
    ...typography.labelMedium,
    color: colors.primary500,
    fontWeight: "600",
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceVariant,
    overflow: "hidden",
  },
  progressFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary500,
  },
  // OTP
  otpCard: {
    backgroundColor: colors.warningLight ?? "#FFF8E1",
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning,
  },
  otpTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  otpMessage: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  otpInputRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  otpInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.warning,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 20,
    fontFamily: "monospace",
    textAlign: "center",
    letterSpacing: 6,
    backgroundColor: "#fff",
    color: colors.textPrimary,
  },
  otpCountdown: {
    ...typography.bodySmall,
    color: colors.warning,
  },
  otpErrorText: {
    ...typography.bodySmall,
    color: colors.error,
    marginTop: spacing.sm,
  },
  // Success
  successBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    backgroundColor: colors.successLight ?? "#E8F5E9",
    borderRadius: 8,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.success,
  },
  successText: {
    ...typography.labelMedium,
    color: colors.success,
  },
  // Badge
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: spacing.sm,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  badgeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  badgeText: {
    ...typography.labelMedium,
    fontWeight: "500",
  },
  // Steps
  stepRow: {
    flexDirection: "row",
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  stepIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceVariant,
    justifyContent: "center",
    alignItems: "center",
  },
  stepIconCompleted: {
    backgroundColor: colors.successLight ?? "#E8F5E9",
  },
  stepIconPending: {
    backgroundColor: colors.warningLight ?? "#FFF8E1",
  },
  stepContent: {
    flex: 1,
  },
  stepLabel: {
    ...typography.bodyLarge,
    fontWeight: "500",
  },
  stepBadge: {
    ...typography.bodySmall,
    color: colors.warning,
  },
  stepDescription: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 2,
  },
  stepDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.textTertiary,
    opacity: 0.4,
  },
  // Action card
  actionCard: {
    backgroundColor: colors.primary100 ?? "#E3F2FD",
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.primary500,
  },
  actionTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  actionDescription: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  // Time
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  timeText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  timeBold: {
    fontWeight: "600",
  },
  // Org
  orgCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    backgroundColor: colors.surfaceVariant,
    borderRadius: 12,
    padding: spacing.lg,
  },
  orgInfo: {
    flex: 1,
  },
  orgName: {
    ...typography.bodyLarge,
    fontWeight: "500",
    color: colors.textPrimary,
  },
  orgType: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  // Footer
  footerActions: {
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing["2xl"],
    gap: spacing.md,
  },
  // Shared
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

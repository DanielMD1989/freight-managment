/**
 * Account Rejected Screen
 * Shows rejection reason and allows user to resubmit documents.
 * Blueprint §2: Rejected → see reason → edit & re-upload → back to awaiting approval.
 */
import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/stores/auth";
import { Button } from "../../src/components/Button";
import apiClient from "../../src/api/client";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

interface VerificationStatus {
  status: string;
  organization: {
    rejectionReason: string | null;
    name: string;
  } | null;
}

export default function AccountRejectedScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { logout, checkAuth } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await apiClient.get<VerificationStatus>(
          "/api/user/verification-status"
        );
        const data = response.data;
        setRejectionReason(data.organization?.rejectionReason ?? null);
      } catch {
        // If we can't fetch, show generic message
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const handleResubmit = () => {
    // G-AUDIT-9: Navigate to role-specific documents screen for re-upload
    const { user } = useAuthStore.getState();
    if (user?.role === "CARRIER") {
      router.push("/(carrier)/documents");
    } else {
      router.push("/(shipper)/documents");
    }
  };

  const handleCheckStatus = async () => {
    await checkAuth();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Ionicons name="close-circle-outline" size={80} color={colors.error} />
      <Text style={styles.title}>
        {t("shared.accountRejected", { defaultValue: "Registration Rejected" })}
      </Text>

      {rejectionReason ? (
        <View style={styles.reasonCard}>
          <Text style={styles.reasonLabel}>
            {t("shared.rejectionReason", { defaultValue: "Reason" })}
          </Text>
          <Text style={styles.reasonText}>{rejectionReason}</Text>
        </View>
      ) : (
        <Text style={styles.message}>
          {t("shared.rejectionGeneric", {
            defaultValue:
              "Your registration was not approved. Please review your documents and resubmit.",
          })}
        </Text>
      )}

      <View style={styles.actions}>
        <Button
          title={t("shared.resubmitDocuments", {
            defaultValue: "Resubmit Documents",
          })}
          onPress={handleResubmit}
          variant="primary"
          size="lg"
          fullWidth
        />
        <Button
          title="Check Status"
          onPress={handleCheckStatus}
          variant="outline"
          size="md"
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
    flexGrow: 1,
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
  reasonCard: {
    marginTop: spacing.xl,
    width: "100%",
    backgroundColor: colors.errorLight,
    borderRadius: 12,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.error,
  },
  reasonLabel: {
    ...typography.labelMedium,
    color: colors.errorDark,
    marginBottom: spacing.xs,
  },
  reasonText: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    lineHeight: 22,
  },
  actions: { marginTop: spacing["3xl"], width: "100%", gap: spacing.md },
});

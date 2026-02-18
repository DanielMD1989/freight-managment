/**
 * Settings Screen
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet, Switch } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../src/stores/settings";
import { useAuthStore } from "../../src/stores/auth";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import i18n from "../../src/i18n/config";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const {
    locale,
    setLocale,
    pushEnabled,
    setPushEnabled,
    gpsEnabled,
    setGpsEnabled,
  } = useSettingsStore();
  const logout = useAuthStore((s) => s.logout);

  const toggleLanguage = async () => {
    const newLocale = locale === "en" ? "am" : "en";
    await setLocale(newLocale);
    i18n.changeLanguage(newLocale);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>General</Text>

        <SettingRow
          icon="language-outline"
          label={t("settings.language")}
          value={locale === "en" ? "English" : "Amharic"}
          onPress={toggleLanguage}
        />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Notifications & Tracking</Text>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Ionicons
              name="notifications-outline"
              size={20}
              color={colors.slate500}
            />
            <Text style={styles.settingLabel}>
              {t("settings.pushNotifications")}
            </Text>
          </View>
          <Switch
            value={pushEnabled}
            onValueChange={setPushEnabled}
            trackColor={{ true: colors.primary500 }}
          />
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Ionicons
              name="location-outline"
              size={20}
              color={colors.slate500}
            />
            <Text style={styles.settingLabel}>{t("settings.gpsTracking")}</Text>
          </View>
          <Switch
            value={gpsEnabled}
            onValueChange={setGpsEnabled}
            trackColor={{ true: colors.primary500 }}
          />
        </View>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>{t("settings.security")}</Text>
        <SettingRow
          icon="lock-closed-outline"
          label={t("settings.changePassword")}
          onPress={() => {
            /* Navigate to change password */
          }}
        />
      </Card>

      <View style={styles.actions}>
        <Button
          title={t("auth.logout")}
          onPress={logout}
          variant="destructive"
          fullWidth
          size="lg"
        />
      </View>
    </ScrollView>
  );
}

function SettingRow({
  icon,
  label,
  value,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string;
  onPress?: () => void;
}) {
  return (
    <View style={styles.settingRow}>
      <Ionicons name={icon} size={20} color={colors.slate500} />
      <Text style={styles.settingLabel}>{label}</Text>
      {value && <Text style={styles.settingValue}>{value}</Text>}
      {onPress && (
        <Ionicons name="chevron-forward" size={16} color={colors.slate400} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { margin: spacing.lg, marginBottom: 0 },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.textTertiary,
    marginBottom: spacing.md,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  settingLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
  },
  settingValue: { ...typography.bodyMedium, color: colors.textSecondary },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  switchLabel: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  actions: { padding: spacing.lg },
});

/**
 * Settings Screen
 */
import React from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Pressable,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../../src/stores/settings";
import { useAuthStore } from "../../src/stores/auth";
import { pushService } from "../../src/services/push";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
export default function SettingsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { locale, pushEnabled, setPushEnabled, gpsEnabled, setGpsEnabled } =
    useSettingsStore();
  const logout = useAuthStore((s) => s.logout);

  const handlePushToggle = async (value: boolean) => {
    if (value) {
      await pushService.registerForPush();
    } else {
      await pushService.unregisterToken();
    }
    setPushEnabled(value);
  };

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>General</Text>

        <Pressable onPress={() => router.push("/(shared)/appearance")}>
          <SettingRow
            icon="color-palette-outline"
            label="Appearance"
            value={locale === "en" ? "English" : "Amharic"}
            onPress={() => router.push("/(shared)/appearance")}
          />
        </Pressable>
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
            onValueChange={handlePushToggle}
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

        <Pressable
          onPress={() => router.push("/(shared)/notification-preferences")}
        >
          <SettingRow
            icon="options-outline"
            label="Notification Preferences"
            onPress={() => router.push("/(shared)/notification-preferences")}
          />
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>{t("settings.security")}</Text>
        <Pressable onPress={() => router.push("/(shared)/change-password")}>
          <SettingRow
            icon="lock-closed-outline"
            label={t("settings.changePassword")}
            onPress={() => router.push("/(shared)/change-password")}
          />
        </Pressable>
        <Pressable onPress={() => router.push("/(shared)/mfa")}>
          <SettingRow
            icon="shield-checkmark-outline"
            label="Two-Factor Authentication"
            onPress={() => router.push("/(shared)/mfa")}
          />
        </Pressable>
        <Pressable onPress={() => router.push("/(shared)/sessions")}>
          <SettingRow
            icon="phone-portrait-outline"
            label="Active Sessions"
            onPress={() => router.push("/(shared)/sessions")}
          />
        </Pressable>
      </Card>

      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Support</Text>
        <Pressable onPress={() => router.push("/(shared)/help-support")}>
          <SettingRow
            icon="help-circle-outline"
            label="Help & Support"
            onPress={() => router.push("/(shared)/help-support")}
          />
        </Pressable>
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

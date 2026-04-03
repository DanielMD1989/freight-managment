/**
 * Appearance Screen — §14 Mobile Settings
 *
 * Language and theme selection, persisted via settings store.
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../src/components/Card";
import { colors } from "../../src/theme/colors";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import { useSettingsStore } from "../../src/stores/settings";
import i18n from "../../src/i18n/config";

const LANGUAGES = [
  { code: "en", label: "English", native: "English" },
  { code: "am", label: "Amharic", native: "አማርኛ" },
] as const;

const THEMES = [
  {
    value: "light" as const,
    label: "Light",
    icon: "sunny-outline" as const,
    desc: "Always use light theme",
  },
  {
    value: "dark" as const,
    label: "Dark",
    icon: "moon-outline" as const,
    desc: "Always use dark theme",
  },
  {
    value: "system" as const,
    label: "System",
    icon: "phone-portrait-outline" as const,
    desc: "Follow device settings",
  },
] as const;

export default function AppearanceScreen() {
  const { locale, setLocale, theme, setTheme } = useSettingsStore();

  const handleLanguage = async (code: string) => {
    await setLocale(code);
    i18n.changeLanguage(code);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Language */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Language</Text>
        <Text style={styles.sectionDesc}>
          Choose the language for the app interface.
        </Text>

        {LANGUAGES.map((lang) => {
          const selected = locale === lang.code;
          return (
            <Pressable
              key={lang.code}
              style={[styles.optionRow, selected && styles.optionRowSelected]}
              onPress={() => handleLanguage(lang.code)}
            >
              <View style={styles.optionInfo}>
                <Text
                  style={[
                    styles.optionLabel,
                    selected && styles.optionLabelSelected,
                  ]}
                >
                  {lang.label}
                </Text>
                <Text style={styles.optionNative}>{lang.native}</Text>
              </View>
              {selected && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={colors.primary600}
                />
              )}
            </Pressable>
          );
        })}
      </Card>

      {/* Theme */}
      <Card style={styles.card}>
        <Text style={styles.sectionTitle}>Theme</Text>
        <Text style={styles.sectionDesc}>
          Choose the appearance of the app.
        </Text>

        {THEMES.map((t) => {
          const selected = theme === t.value;
          return (
            <Pressable
              key={t.value}
              style={[styles.optionRow, selected && styles.optionRowSelected]}
              onPress={() => setTheme(t.value)}
            >
              <Ionicons
                name={t.icon}
                size={20}
                color={selected ? colors.primary600 : colors.slate500}
              />
              <View style={styles.optionInfo}>
                <Text
                  style={[
                    styles.optionLabel,
                    selected && styles.optionLabelSelected,
                  ]}
                >
                  {t.label}
                </Text>
                <Text style={styles.optionNative}>{t.desc}</Text>
              </View>
              {selected && (
                <Ionicons
                  name="checkmark-circle"
                  size={22}
                  color={colors.primary600}
                />
              )}
            </Pressable>
          );
        })}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { margin: spacing.lg, marginBottom: 0 },
  sectionTitle: {
    ...typography.titleSmall,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  sectionDesc: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginBottom: spacing.lg,
  },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: borderRadius.lg,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionRowSelected: {
    borderColor: colors.primary600,
    backgroundColor: colors.primary50,
  },
  optionInfo: { flex: 1 },
  optionLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  optionLabelSelected: {
    color: colors.primary700,
  },
  optionNative: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 1,
  },
});

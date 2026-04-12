/**
 * Driver Settings Screen — minimal options
 */
import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Card } from "../../src/components";
import { colors, spacing, typography } from "../../src/theme";
import { useAuthStore } from "../../src/stores/auth";

interface SettingsItem {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  destructive?: boolean;
}

export default function DriverSettingsScreen() {
  const { logout } = useAuthStore();

  const items: SettingsItem[] = [
    {
      label: "About FreightET Driver",
      icon: "information-circle-outline",
      onPress: () => Alert.alert("FreightET Driver", "Version 1.0.0"),
    },
    {
      label: "Notification Preferences",
      icon: "notifications-outline",
      onPress: () =>
        Alert.alert(
          "Coming Soon",
          "Notification preferences will be available in a future update."
        ),
    },
    {
      label: "Change Password",
      icon: "key-outline",
      onPress: () =>
        Alert.alert(
          "Coming Soon",
          "Password change will be available in a future update."
        ),
    },
    {
      label: "Log Out",
      icon: "log-out-outline",
      destructive: true,
      onPress: () => {
        Alert.alert("Log Out", "Are you sure you want to log out?", [
          { text: "Cancel", style: "cancel" },
          { text: "Log Out", style: "destructive", onPress: logout },
        ]);
      },
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        {items.map((item, i) => (
          <TouchableOpacity
            key={item.label}
            style={[styles.row, i < items.length - 1 && styles.rowBorder]}
            onPress={item.onPress}
            activeOpacity={0.7}
          >
            <Ionicons
              name={item.icon}
              size={22}
              color={item.destructive ? colors.error : colors.textSecondary}
            />
            <Text
              style={[
                styles.rowLabel,
                item.destructive && { color: colors.error },
              ]}
            >
              {item.label}
            </Text>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.slate300}
            />
          </TouchableOpacity>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  card: { marginHorizontal: spacing.lg, marginTop: spacing.lg },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowLabel: {
    ...typography.bodyLarge,
    color: colors.textPrimary,
    flex: 1,
  },
});

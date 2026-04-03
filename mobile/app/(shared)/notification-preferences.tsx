/**
 * Notification Preferences Screen — §14 Mobile Settings
 *
 * Toggle notification types per category, mirroring the web
 * /settings/notifications page.
 */
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Switch,
  Alert,
  ActivityIndicator,
} from "react-native";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { colors } from "../../src/theme/colors";
import { spacing, borderRadius } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "../../src/hooks/useNotifications";

// Same categories as web NotificationSettingsClient
interface NotificationType {
  id: string;
  label: string;
  description: string;
}

interface NotificationCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  types: NotificationType[];
}

const CATEGORIES: NotificationCategory[] = [
  {
    id: "loads",
    name: "Load Updates",
    description: "Notifications about your loads",
    icon: "cube-outline",
    types: [
      {
        id: "LOAD_ASSIGNED",
        label: "Load Assigned",
        description: "When a load is assigned to a truck",
      },
      {
        id: "LOAD_STATUS_CHANGE",
        label: "Status Changes",
        description: "When load status changes",
      },
      {
        id: "LOAD_REQUEST_RECEIVED",
        label: "Load Requests",
        description: "When you receive a load request",
      },
    ],
  },
  {
    id: "gps",
    name: "GPS & Tracking",
    description: "GPS and truck tracking alerts",
    icon: "location-outline",
    types: [
      {
        id: "GPS_OFFLINE",
        label: "GPS Offline",
        description: "When a truck GPS goes offline",
      },
    ],
  },
  {
    id: "finance",
    name: "Finance & Settlements",
    description: "Financial notifications",
    icon: "wallet-outline",
    types: [
      {
        id: "POD_SUBMITTED",
        label: "POD Submitted",
        description: "When proof of delivery is uploaded",
      },
      {
        id: "SETTLEMENT_COMPLETE",
        label: "Settlement Complete",
        description: "When settlement is processed",
      },
    ],
  },
  {
    id: "account",
    name: "Account & Security",
    description: "Account-related notifications",
    icon: "person-circle-outline",
    types: [
      {
        id: "USER_STATUS_CHANGED",
        label: "Account Status Changes",
        description: "When your account status changes",
      },
      {
        id: "LOW_BALANCE_WARNING",
        label: "Low Balance Warning",
        description: "When wallet balance is below minimum",
      },
    ],
  },
];

export default function NotificationPreferencesScreen() {
  const { data: savedPrefs, isLoading } = useNotificationPreferences();
  const updatePrefs = useUpdateNotificationPreferences();

  const [prefs, setPrefs] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);

  // Sync server state into local state
  useEffect(() => {
    if (savedPrefs) {
      setPrefs(savedPrefs);
      setHasChanges(false);
    }
  }, [savedPrefs]);

  const handleToggle = (typeId: string) => {
    setPrefs((prev) => {
      const updated = { ...prev, [typeId]: !(prev[typeId] ?? true) };
      setHasChanges(true);
      return updated;
    });
  };

  const handleSave = () => {
    updatePrefs.mutate(prefs, {
      onSuccess: () => {
        setHasChanges(false);
        Alert.alert("Saved", "Notification preferences updated.");
      },
      onError: (error) => {
        Alert.alert("Error", error.message || "Failed to save preferences");
      },
    });
  };

  if (isLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={colors.primary500} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Save button bar */}
      {hasChanges && (
        <View style={styles.saveBar}>
          <Text style={styles.saveBarText}>Unsaved changes</Text>
          <Button
            title={updatePrefs.isPending ? "Saving..." : "Save"}
            onPress={handleSave}
            size="sm"
            loading={updatePrefs.isPending}
          />
        </View>
      )}

      {CATEGORIES.map((category) => (
        <Card key={category.id} style={styles.card}>
          <View style={styles.categoryHeader}>
            <View>
              <Text style={styles.categoryName}>{category.name}</Text>
              <Text style={styles.categoryDesc}>{category.description}</Text>
            </View>
          </View>

          {category.types.map((type, index) => (
            <View
              key={type.id}
              style={[
                styles.typeRow,
                index < category.types.length - 1 && styles.typeRowBorder,
              ]}
            >
              <View style={styles.typeInfo}>
                <Text style={styles.typeLabel}>{type.label}</Text>
                <Text style={styles.typeDesc}>{type.description}</Text>
              </View>
              <Switch
                value={prefs[type.id] ?? true}
                onValueChange={() => handleToggle(type.id)}
                trackColor={{
                  false: colors.slate200,
                  true: colors.primary500,
                }}
                thumbColor={colors.white}
              />
            </View>
          ))}
        </Card>
      ))}

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Critical notifications (security alerts, account revocation) are
          always sent regardless of these settings.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.background,
  },
  saveBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.primary50,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    borderRadius: borderRadius.lg,
    borderWidth: 1,
    borderColor: colors.primary200,
  },
  saveBarText: {
    ...typography.labelMedium,
    color: colors.primary700,
  },
  card: { margin: spacing.lg, marginBottom: 0 },
  categoryHeader: {
    marginBottom: spacing.md,
  },
  categoryName: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  categoryDesc: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 2,
  },
  typeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.md,
  },
  typeRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  typeInfo: { flex: 1, marginRight: spacing.md },
  typeLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: "500",
  },
  typeDesc: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: 2,
  },
  footer: {
    padding: spacing.lg,
    paddingTop: spacing.md,
  },
  footerText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    textAlign: "center",
    lineHeight: 18,
  },
});

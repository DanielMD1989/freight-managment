/**
 * Profile Screen - View profile info
 *
 * NOTE: Edit profile and change password features are disabled because the
 * required API endpoints do not exist yet:
 * - PATCH /api/users/me (for profile updates)
 * - POST /api/auth/change-password (for password changes)
 *
 * When those endpoints are implemented, re-enable the editing UI by restoring
 * the useState calls for isEditing/showPasswordChange and the handler functions.
 */
import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../src/stores/auth";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { Badge } from "../../src/components/Badge";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

export default function ProfileScreen() {
  const { user, logout } = useAuthStore();

  if (!user) return null;

  return (
    <ScrollView style={styles.container}>
      {/* Avatar + Name */}
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {(user.firstName?.[0] ?? "").toUpperCase()}
            {(user.lastName?.[0] ?? "").toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>
          {user.firstName} {user.lastName}
        </Text>
        <Text style={styles.email}>{user.email}</Text>
        <Badge
          label={user.role}
          variant="primary"
          size="md"
          style={{ marginTop: spacing.sm }}
        />
      </View>

      {/* Read-only details */}
      <Card style={styles.card}>
        <DetailRow
          icon="person-outline"
          label="Name"
          value={`${user.firstName ?? ""} ${user.lastName ?? ""}`}
        />
        <DetailRow icon="mail-outline" label="Email" value={user.email} />
        <DetailRow icon="shield-outline" label="Role" value={user.role} />
        <DetailRow
          icon="checkmark-circle-outline"
          label="Status"
          value={user.status}
        />
      </Card>

      {/* Edit Profile - disabled until API endpoint exists */}
      <Card style={styles.card}>
        <View style={styles.disabledHeader}>
          <View style={styles.disabledHeaderLeft}>
            <Ionicons name="pencil-outline" size={20} color={colors.slate400} />
            <Text style={styles.disabledTitle}>Edit Profile</Text>
          </View>
          <Badge label="Coming Soon" variant="neutral" size="sm" />
        </View>
        <Text style={styles.comingSoonText}>
          Profile editing will be available in a future update.
        </Text>
      </Card>

      {/* Change Password - disabled until API endpoint exists */}
      <Card style={styles.card}>
        <View style={styles.disabledHeader}>
          <View style={styles.disabledHeaderLeft}>
            <Ionicons
              name="lock-closed-outline"
              size={20}
              color={colors.slate400}
            />
            <Text style={styles.disabledTitle}>Change Password</Text>
          </View>
          <Badge label="Coming Soon" variant="neutral" size="sm" />
        </View>
        <Text style={styles.comingSoonText}>
          Password changes will be available in a future update.
        </Text>
      </Card>

      <View style={styles.actions}>
        <Button
          title="Logout"
          onPress={logout}
          variant="destructive"
          fullWidth
          size="lg"
        />
      </View>
    </ScrollView>
  );
}

function DetailRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={20} color={colors.slate400} />
      <View style={styles.detailContent}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    alignItems: "center",
    padding: spacing["3xl"],
    backgroundColor: colors.white,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: colors.primary100,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { ...typography.displaySmall, color: colors.primary700 },
  name: {
    ...typography.headlineMedium,
    color: colors.textPrimary,
    marginTop: spacing.md,
  },
  email: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  card: { margin: spacing.lg },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.slate100,
  },
  detailContent: { flex: 1 },
  detailLabel: { ...typography.bodySmall, color: colors.textTertiary },
  detailValue: { ...typography.bodyMedium, color: colors.textPrimary },
  disabledHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  disabledHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  disabledTitle: {
    ...typography.titleMedium,
    color: colors.slate400,
  },
  comingSoonText: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.sm,
  },
  actions: { padding: spacing.lg, paddingBottom: spacing["3xl"] },
});

/**
 * Team Management Screen
 * Members list, invitations, invite member modal
 */
import React, { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "../../src/stores/auth";
import {
  useTeamMembers,
  useTeamInvitations,
  useInviteMember,
  useRemoveMember,
  useCancelInvitation,
} from "../../src/hooks/useTeam";
import { Card } from "../../src/components/Card";
import { Button } from "../../src/components/Button";
import { Badge } from "../../src/components/Badge";
import { Input } from "../../src/components/Input";
import { LoadingSpinner } from "../../src/components/LoadingSpinner";
import { EmptyState } from "../../src/components/EmptyState";
import { colors } from "../../src/theme/colors";
import { spacing } from "../../src/theme/spacing";
import { typography } from "../../src/theme/typography";

type Tab = "members" | "invitations";

function getRoleOptions(userRole: string | undefined): string[] {
  if (userRole === "CARRIER") return ["CARRIER", "DISPATCHER"];
  if (userRole === "SHIPPER") return ["SHIPPER", "DISPATCHER"];
  return ["DISPATCHER"];
}

export default function TeamScreen() {
  useTranslation();
  const user = useAuthStore((s) => s.user);
  const orgId = user?.organizationId ?? null;
  const roleOptions = getRoleOptions(user?.role);

  const [activeTab, setActiveTab] = useState<Tab>("members");
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState(roleOptions[0]);

  const {
    data: members,
    isLoading: membersLoading,
    refetch: refetchMembers,
    isRefetching: membersRefetching,
  } = useTeamMembers(orgId);

  const {
    data: invitations,
    isLoading: invitationsLoading,
    refetch: refetchInvitations,
    isRefetching: invitationsRefetching,
  } = useTeamInvitations(orgId);

  const inviteMember = useInviteMember();
  const removeMember = useRemoveMember();
  const cancelInvitation = useCancelInvitation();

  const isLoading =
    activeTab === "members" ? membersLoading : invitationsLoading;
  const isRefetching =
    activeTab === "members" ? membersRefetching : invitationsRefetching;

  const handleRefresh = () => {
    if (activeTab === "members") {
      refetchMembers();
    } else {
      refetchInvitations();
    }
  };

  const handleRemoveMember = (userId: string, name: string) => {
    Alert.alert(
      "Remove Member",
      `Are you sure you want to remove ${name} from the team?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => {
            if (orgId) {
              removeMember.mutate({ orgId, userId });
            }
          },
        },
      ]
    );
  };

  const handleCancelInvitation = (invitationId: string, email: string) => {
    Alert.alert(
      "Cancel Invitation",
      `Cancel the invitation sent to ${email}?`,
      [
        { text: "Keep", style: "cancel" },
        {
          text: "Cancel Invite",
          style: "destructive",
          onPress: () => {
            if (orgId) {
              cancelInvitation.mutate({ orgId, invitationId });
            }
          },
        },
      ]
    );
  };

  const handleInvite = () => {
    if (!inviteEmail.trim()) {
      Alert.alert("Error", "Please enter an email address.");
      return;
    }
    if (!orgId) return;

    inviteMember.mutate(
      { orgId, data: { email: inviteEmail.trim(), role: inviteRole } },
      {
        onSuccess: () => {
          setShowInviteModal(false);
          setInviteEmail("");
          setInviteRole("CARRIER");
          Alert.alert("Success", "Invitation sent successfully.");
        },
        onError: (err) => {
          Alert.alert("Error", err.message ?? "Failed to send invitation.");
        },
      }
    );
  };

  if (!orgId) {
    return (
      <EmptyState
        icon="people-outline"
        title="No Organization"
        message="You need to be part of an organization to manage team members."
      />
    );
  }

  const getRoleVariant = (role: string) => {
    switch (role) {
      case "CARRIER":
        return "primary" as const;
      case "SHIPPER":
        return "info" as const;
      case "DISPATCHER":
        return "warning" as const;
      case "ADMIN":
      case "SUPER_ADMIN":
        return "error" as const;
      default:
        return "neutral" as const;
    }
  };

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, activeTab === "members" && styles.tabActive]}
          onPress={() => setActiveTab("members")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "members" && styles.tabTextActive,
            ]}
          >
            Members
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "invitations" && styles.tabActive]}
          onPress={() => setActiveTab("invitations")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "invitations" && styles.tabTextActive,
            ]}
          >
            Invitations
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      {isLoading ? (
        <LoadingSpinner fullScreen />
      ) : (
        <ScrollView
          style={styles.content}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={handleRefresh}
            />
          }
        >
          {activeTab === "members" ? (
            <>
              {!members || members.length === 0 ? (
                <EmptyState
                  icon="people-outline"
                  title="No Team Members"
                  message="Invite team members to get started"
                />
              ) : (
                members.map((member) => (
                  <Card key={member.id} style={styles.memberCard}>
                    <View style={styles.memberRow}>
                      <View style={styles.memberAvatar}>
                        <Text style={styles.avatarText}>
                          {(member.firstName?.[0] ?? "").toUpperCase()}
                          {(member.lastName?.[0] ?? "").toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>
                          {member.firstName} {member.lastName}
                        </Text>
                        <Text style={styles.memberEmail}>{member.email}</Text>
                      </View>
                      <Badge
                        label={member.role}
                        variant={getRoleVariant(member.role)}
                        size="sm"
                      />
                    </View>
                    {member.id !== user?.id && (
                      <TouchableOpacity
                        style={styles.removeButton}
                        onPress={() =>
                          handleRemoveMember(
                            member.id,
                            `${member.firstName} ${member.lastName}`
                          )
                        }
                      >
                        <Ionicons
                          name="close-circle-outline"
                          size={20}
                          color={colors.error}
                        />
                        <Text style={styles.removeText}>Remove</Text>
                      </TouchableOpacity>
                    )}
                  </Card>
                ))
              )}
            </>
          ) : (
            <>
              {!invitations || invitations.length === 0 ? (
                <EmptyState
                  icon="mail-outline"
                  title="No Pending Invitations"
                  message="Invite team members using the button below"
                />
              ) : (
                invitations.map((invite) => (
                  <Card key={invite.id} style={styles.memberCard}>
                    <View style={styles.memberRow}>
                      <View style={styles.inviteAvatar}>
                        <Ionicons
                          name="mail-outline"
                          size={20}
                          color={colors.primary600}
                        />
                      </View>
                      <View style={styles.memberInfo}>
                        <Text style={styles.memberName}>{invite.email}</Text>
                        <Text style={styles.memberEmail}>
                          Invited as {invite.role}
                        </Text>
                      </View>
                      <Badge
                        label={invite.status}
                        variant="warning"
                        size="sm"
                      />
                    </View>
                    <TouchableOpacity
                      style={styles.removeButton}
                      onPress={() =>
                        handleCancelInvitation(invite.id, invite.email)
                      }
                    >
                      <Ionicons
                        name="close-circle-outline"
                        size={20}
                        color={colors.error}
                      />
                      <Text style={styles.removeText}>Cancel Invite</Text>
                    </TouchableOpacity>
                  </Card>
                ))
              )}
            </>
          )}

          <View style={{ height: spacing["3xl"] }} />
        </ScrollView>
      )}

      {/* Invite button */}
      <View style={styles.floatingButton}>
        <Button
          title="Invite Member"
          onPress={() => setShowInviteModal(true)}
          variant="primary"
          size="lg"
          fullWidth
          icon={
            <Ionicons
              name="person-add-outline"
              size={20}
              color={colors.white}
            />
          }
        />
      </View>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        animationType="slide"
        transparent
        onRequestClose={() => setShowInviteModal(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Invite Team Member</Text>
              <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <Input
              label="Email Address"
              value={inviteEmail}
              onChangeText={setInviteEmail}
              placeholder="team@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              required
            />

            <Text style={styles.roleLabel}>Role</Text>
            <View style={styles.roleChips}>
              {roleOptions.map((role) => (
                <TouchableOpacity
                  key={role}
                  style={[
                    styles.roleChip,
                    inviteRole === role && styles.roleChipActive,
                  ]}
                  onPress={() => setInviteRole(role)}
                >
                  <Text
                    style={[
                      styles.roleChipText,
                      inviteRole === role && styles.roleChipTextActive,
                    ]}
                  >
                    {role}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                onPress={() => setShowInviteModal(false)}
                variant="outline"
                size="md"
                style={{ flex: 1 }}
              />
              <Button
                title="Send Invite"
                onPress={handleInvite}
                variant="primary"
                size="md"
                loading={inviteMember.isPending}
                style={{ flex: 1 }}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.primary600,
  },
  tabText: {
    ...typography.labelLarge,
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.primary600,
  },
  content: {
    flex: 1,
    padding: spacing.lg,
  },
  memberCard: {
    marginBottom: spacing.md,
  },
  memberRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  memberAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary100,
    justifyContent: "center",
    alignItems: "center",
  },
  inviteAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary50,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    ...typography.labelMedium,
    color: colors.primary700,
    fontWeight: "600",
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    ...typography.titleSmall,
    color: colors.textPrimary,
  },
  memberEmail: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.slate100,
    alignSelf: "flex-end",
  },
  removeText: {
    ...typography.labelSmall,
    color: colors.error,
  },
  floatingButton: {
    padding: spacing.lg,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: spacing["2xl"],
    paddingBottom: spacing["4xl"],
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xl,
  },
  modalTitle: {
    ...typography.headlineSmall,
    color: colors.textPrimary,
  },
  roleLabel: {
    ...typography.labelMedium,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  roleChips: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  roleChip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: 20,
    backgroundColor: colors.slate100,
  },
  roleChipActive: {
    backgroundColor: colors.primary600,
  },
  roleChipText: {
    ...typography.labelMedium,
    color: colors.slate600,
  },
  roleChipTextActive: {
    color: colors.white,
  },
  modalActions: {
    flexDirection: "row",
    gap: spacing.md,
  },
});

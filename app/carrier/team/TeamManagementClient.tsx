/**
 * Team Management Client Component
 *
 * Phase 2 - Story 16.9B: Company Admin Tools
 * Task 16.9B.1: Company User Management
 */

"use client";

import { useState } from "react";
import { getCSRFToken } from "@/lib/csrfFetch";

interface Member {
  id: string;
  name: string;
  email: string;
  role: string;
  status: string;
  createdAt: string;
  lastLoginAt: string | null;
}

interface Invitation {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
}

interface Organization {
  id: string;
  name: string;
  type: string;
  isVerified: boolean;
}

interface Props {
  organization: Organization;
  initialMembers: Member[];
  initialInvitations: Invitation[];
  currentUserId: string;
}

export default function TeamManagementClient({
  organization,
  initialMembers,
  initialInvitations,
  currentUserId,
}: Props) {
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [invitations, setInvitations] =
    useState<Invitation[]>(initialInvitations);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("CARRIER");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/organizations/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        body: JSON.stringify({
          email: inviteEmail,
          role: inviteRole,
          organizationId: organization.id,
        }),
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send invitation");
      }

      const data = await response.json();
      setInvitations([data.invitation, ...invitations]);
      setShowInviteModal(false);
      setInviteEmail("");
      setSuccess("Invitation sent successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!confirm("Are you sure you want to cancel this invitation?")) return;

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(
        `/api/organizations/invitations/${invitationId}`,
        {
          method: "DELETE",
          headers: { ...(csrfToken && { "X-CSRF-Token": csrfToken }) },
          credentials: "include",
        }
      );

      if (!response.ok) {
        throw new Error("Failed to cancel invitation");
      }

      setInvitations(invitations.filter((inv) => inv.id !== invitationId));
      setSuccess("Invitation cancelled");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    if (memberId === currentUserId) {
      setError("You cannot remove yourself from the team");
      return;
    }

    if (
      !confirm(`Are you sure you want to remove ${memberName} from the team?`)
    ) {
      return;
    }

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/organizations/members/${memberId}`, {
        method: "DELETE",
        headers: { ...(csrfToken && { "X-CSRF-Token": csrfToken }) },
        credentials: "include",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to remove member");
      }

      setMembers(members.filter((m) => m.id !== memberId));
      setSuccess("Member removed successfully");
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  // Status colors from StatusBadge.tsx (source of truth)
  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      PENDING: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
      SUSPENDED: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
      REGISTERED: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    };
    return styles[status] || "bg-slate-500/10 text-slate-600";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className="space-y-6">
      {/* Messages */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/30">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-1 text-sm text-red-600 underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/30">
          <p className="text-sm text-green-800 dark:text-green-200">
            {success}
          </p>
        </div>
      )}

      {/* Organization Info */}
      <div className="rounded-lg border border-[#064d51]/15 bg-white p-6 shadow dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-[#064d51] dark:text-white">
              {organization.name}
            </h2>
            <p className="text-sm text-[#064d51]/70 dark:text-gray-400">
              {organization.type} Organization
              {organization.isVerified && (
                <span className="ml-2 inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  Verified
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => setShowInviteModal(true)}
            className="rounded-lg bg-[#1e9c99] px-4 py-2 font-medium text-white hover:bg-[#064d51]"
          >
            Invite Member
          </button>
        </div>
      </div>

      {/* Team Members */}
      <div className="rounded-lg border border-[#064d51]/15 bg-white shadow dark:border-slate-700 dark:bg-slate-800">
        <div className="border-b border-[#064d51]/15 px-6 py-4 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-[#064d51] dark:text-white">
            Team Members ({members.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-[#f0fdfa] dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                  Member
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                  Joined
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                  Last Login
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {members.map((member) => (
                <tr
                  key={member.id}
                  className="hover:bg-[#f0fdfa] dark:hover:bg-slate-700/50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-[#064d51] dark:text-white">
                        {member.name}
                        {member.id === currentUserId && (
                          <span className="ml-2 text-xs text-[#064d51]/60">
                            (You)
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[#064d51]/60 dark:text-gray-400">
                        {member.email}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm text-[#064d51] dark:text-white">
                      {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${getStatusBadge(
                        member.status
                      )}`}
                    >
                      {member.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-[#064d51]/60 dark:text-gray-400">
                    {formatDate(member.createdAt)}
                  </td>
                  <td className="px-6 py-4 text-sm whitespace-nowrap text-[#064d51]/60 dark:text-gray-400">
                    {member.lastLoginAt
                      ? formatDate(member.lastLoginAt)
                      : "Never"}
                  </td>
                  <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                    {member.id !== currentUserId && (
                      <button
                        onClick={() =>
                          handleRemoveMember(member.id, member.name)
                        }
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations */}
      {invitations.length > 0 && (
        <div className="rounded-lg border border-[#064d51]/15 bg-white shadow dark:border-slate-700 dark:bg-slate-800">
          <div className="border-b border-[#064d51]/15 px-6 py-4 dark:border-slate-700">
            <h3 className="text-lg font-semibold text-[#064d51] dark:text-white">
              Pending Invitations ({invitations.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#f0fdfa] dark:bg-slate-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                    Expires
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium tracking-wider text-[#064d51]/60 uppercase dark:text-gray-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
                {invitations.map((invitation) => (
                  <tr
                    key={invitation.id}
                    className="hover:bg-[#f0fdfa] dark:hover:bg-slate-700/50"
                  >
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-[#064d51] dark:text-white">
                      {invitation.email}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-[#064d51] dark:text-white">
                      {invitation.role}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-[#064d51]/60 dark:text-gray-400">
                      {formatDate(invitation.createdAt)}
                    </td>
                    <td className="px-6 py-4 text-sm whitespace-nowrap text-[#064d51]/60 dark:text-gray-400">
                      {formatDate(invitation.expiresAt)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm whitespace-nowrap">
                      <button
                        onClick={() => handleCancelInvitation(invitation.id)}
                        className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                      >
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-lg bg-white shadow-xl dark:bg-slate-800">
            <div className="border-b border-[#064d51]/15 px-6 py-4 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-[#064d51] dark:text-white">
                Invite Team Member
              </h3>
            </div>
            <form onSubmit={handleInvite} className="space-y-4 p-6">
              <div>
                <label className="mb-1 block text-sm font-medium text-[#064d51]/80 dark:text-gray-300">
                  Email Address
                </label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                  className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                  placeholder="colleague@example.com"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-[#064d51]/80 dark:text-gray-300">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full rounded-lg border border-[#064d51]/20 px-3 py-2 focus:border-[#1e9c99] focus:ring-2 focus:ring-[#1e9c99] dark:border-slate-600 dark:bg-slate-700 dark:text-white"
                >
                  <option value="CARRIER">Carrier</option>
                </select>
                <p className="mt-1 text-xs text-[#064d51]/60">
                  New members will have standard carrier permissions
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="rounded-lg border border-[#064d51]/20 px-4 py-2 text-[#064d51]/80 hover:bg-[#f0fdfa] dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-lg bg-[#1e9c99] px-4 py-2 text-white hover:bg-[#064d51] disabled:opacity-50"
                >
                  {loading ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

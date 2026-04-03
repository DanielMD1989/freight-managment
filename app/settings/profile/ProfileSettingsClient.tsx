"use client";

/**
 * Profile Settings Client Component
 *
 * Sprint 19 - Profile Menu + Settings Navigation
 *
 * Allows users to view and edit their profile information
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";

interface ProfileSettingsClientProps {
  user: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    phone: string | null;
    role: string;
    status: string;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
    lastLoginAt: string | null;
    createdAt: string;
    organization: {
      id: string;
      name: string;
      type: string;
      isVerified: boolean;
    } | null;
  };
}

export default function ProfileSettingsClient({
  user,
}: ProfileSettingsClientProps) {
  const router = useRouter();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: user.firstName || "",
    lastName: user.lastName || "",
    phone: user.phone || "",
  });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update profile");
      }

      toast.success("Profile updated successfully");
      setIsEditing(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to update profile"
      );
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      ACTIVE:
        "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
      PENDING_VERIFICATION:
        "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
      REGISTERED:
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
      SUSPENDED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
      REJECTED:
        "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400",
    };
    return styles[status] || styles.REGISTERED;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
            Profile Information
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your personal information and account details
          </p>
        </div>
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
          >
            Edit Profile
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => {
                setIsEditing(false);
                setFormData({
                  firstName: user.firstName || "",
                  lastName: user.lastName || "",
                  phone: user.phone || "",
                });
              }}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        )}
      </div>

      {/* Profile Form */}
      <div className="space-y-6">
        {/* Avatar Section */}
        <div className="flex items-center gap-4 border-b border-gray-200 pb-6 dark:border-slate-700">
          <div className="relative">
            {user.organization?.name && (
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-teal-600 text-2xl font-semibold text-white">
                {(user as { avatarUrl?: string }).avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(user as { avatarUrl?: string }).avatarUrl!}
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    {(user.firstName?.[0] || "").toUpperCase()}
                    {(user.lastName?.[0] || "").toUpperCase()}
                  </>
                )}
              </div>
            )}
            {isEditing && (
              <label className="absolute -right-1 -bottom-1 flex h-7 w-7 cursor-pointer items-center justify-center rounded-full bg-teal-600 text-white shadow-md transition-colors hover:bg-teal-700">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="h-3.5 w-3.5"
                >
                  <path d="M1 8.25a1.25 1.25 0 112.5 0v7.5a1.25 1.25 0 11-2.5 0v-7.5zM7.5 4.5a.75.75 0 00-.75.75v10.5a.75.75 0 001.5 0V5.25a.75.75 0 00-.75-.75zm5 2a.75.75 0 00-.75.75v8.5a.75.75 0 001.5 0v-8.5a.75.75 0 00-.75-.75zm5 2a.75.75 0 00-.75.75v6.5a.75.75 0 001.5 0v-6.5a.75.75 0 00-.75-.75z" />
                </svg>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 5 * 1024 * 1024) {
                      toast.error("Image must be under 5MB");
                      return;
                    }
                    // Upload via existing uploads endpoint
                    const formData = new FormData();
                    formData.append("file", file);
                    try {
                      const csrfToken = await getCSRFToken();
                      const uploadRes = await fetch("/api/uploads", {
                        method: "POST",
                        headers: {
                          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
                        },
                        credentials: "include",
                        body: formData,
                      });
                      if (!uploadRes.ok) throw new Error("Upload failed");
                      const uploadData = await uploadRes.json();
                      const url = uploadData.url || uploadData.fileUrl;
                      // Save avatarUrl to profile
                      const saveRes = await fetch("/api/user/profile", {
                        method: "PATCH",
                        headers: {
                          "Content-Type": "application/json",
                          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
                        },
                        credentials: "include",
                        body: JSON.stringify({ avatarUrl: url }),
                      });
                      if (saveRes.ok) {
                        toast.success("Profile picture updated");
                        router.refresh();
                      } else {
                        toast.error("Failed to save profile picture");
                      }
                    } catch {
                      toast.error("Failed to upload image");
                    }
                  }}
                />
              </label>
            )}
          </div>
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              {user.firstName} {user.lastName}
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {user.email}
            </p>
            <span
              className={`mt-1 inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(user.status)}`}
            >
              {user.status.replace("_", " ")}
            </span>
          </div>
        </div>

        {/* Personal Information */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              First Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.firstName}
                onChange={(e) =>
                  setFormData({ ...formData, firstName: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">
                {user.firstName || "-"}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Last Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={formData.lastName}
                onChange={(e) =>
                  setFormData({ ...formData, lastName: e.target.value })
                }
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            ) : (
              <p className="text-gray-900 dark:text-white">
                {user.lastName || "-"}
              </p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Email Address
            </label>
            <div className="flex items-center gap-2">
              <p className="text-gray-900 dark:text-white">{user.email}</p>
              {user.isEmailVerified && (
                <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  Verified
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Contact support to change your email address
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Phone Number
            </label>
            {isEditing ? (
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) =>
                  setFormData({ ...formData, phone: e.target.value })
                }
                placeholder="+251 9XX XXX XXX"
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
              />
            ) : (
              <div className="flex items-center gap-2">
                <p className="text-gray-900 dark:text-white">
                  {user.phone || "-"}
                </p>
                {user.isPhoneVerified && (
                  <span className="inline-flex items-center rounded bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    Verified
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Account Information */}
        <div className="border-t border-gray-200 pt-6 dark:border-slate-700">
          <h3 className="mb-4 text-sm font-medium text-gray-700 dark:text-gray-300">
            Account Information
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
                Role
              </label>
              <p className="text-gray-900 dark:text-white">{user.role}</p>
            </div>

            {user.organization && (
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
                  Organization
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-gray-900 dark:text-white">
                    {user.organization.name}
                  </p>
                  {user.organization.isVerified && (
                    <span className="inline-flex items-center rounded bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                      Verified
                    </span>
                  )}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
                Last Login
              </label>
              <p className="text-gray-900 dark:text-white">
                {formatDate(user.lastLoginAt)}
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-gray-500 dark:text-gray-400">
                Member Since
              </label>
              <p className="text-gray-900 dark:text-white">
                {formatDate(user.createdAt)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Delete Account — §14 */}
      {user.role !== "ADMIN" && user.role !== "SUPER_ADMIN" && (
        <div className="mt-8 rounded-lg border border-red-200 bg-red-50/50 p-6 dark:border-red-900 dark:bg-red-900/10">
          <h3 className="text-sm font-semibold text-red-700 dark:text-red-400">
            Delete Account
          </h3>
          <p className="mt-1 text-xs text-red-600/80 dark:text-red-400/80">
            This will deactivate your account. You have 30 days to contact
            support if you change your mind.
          </p>
          <button
            onClick={() => setShowDeleteModal(true)}
            className="mt-3 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
          >
            Delete My Account
          </button>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md overflow-hidden rounded-2xl border border-slate-200/60 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="bg-gradient-to-r from-red-700 to-red-600 px-6 py-4">
              <h3 className="text-lg font-semibold text-white">
                Delete Account
              </h3>
              <p className="mt-0.5 text-sm text-red-200">
                This action will deactivate your account
              </p>
            </div>

            <div className="space-y-4 px-6 py-5">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Enter your password to confirm. Your account will be suspended
                and all active sessions will be revoked.
              </p>

              <div>
                <label className="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Password
                </label>
                <input
                  type="password"
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  placeholder="Enter your password"
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: "var(--card)",
                    color: "var(--foreground)",
                    borderColor: "var(--border)",
                  }}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold tracking-wide text-gray-500 uppercase">
                  Reason{" "}
                  <span className="font-normal normal-case">(optional)</span>
                </label>
                <textarea
                  value={deleteReason}
                  onChange={(e) => setDeleteReason(e.target.value)}
                  placeholder="Why are you leaving?"
                  rows={2}
                  maxLength={500}
                  className="w-full resize-none rounded-lg border px-3 py-2 text-sm"
                  style={{
                    background: "var(--card)",
                    color: "var(--foreground)",
                    borderColor: "var(--border)",
                  }}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 border-t px-6 py-4 dark:border-slate-700">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletePassword("");
                  setDeleteReason("");
                }}
                disabled={isDeleting}
                className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!deletePassword) {
                    toast.error("Password is required");
                    return;
                  }
                  setIsDeleting(true);
                  try {
                    const csrfToken = await getCSRFToken();
                    const res = await fetch("/api/user/account", {
                      method: "DELETE",
                      headers: {
                        "Content-Type": "application/json",
                        ...(csrfToken && { "X-CSRF-Token": csrfToken }),
                      },
                      credentials: "include",
                      body: JSON.stringify({
                        password: deletePassword,
                        reason: deleteReason.trim() || undefined,
                      }),
                    });
                    if (res.ok) {
                      toast.success("Account deleted. Redirecting...");
                      setTimeout(() => router.push("/login"), 1500);
                    } else {
                      const data = await res.json();
                      toast.error(data.error || "Failed to delete account");
                    }
                  } catch {
                    toast.error("Failed to delete account");
                  } finally {
                    setIsDeleting(false);
                  }
                }}
                disabled={isDeleting || !deletePassword}
                className="rounded-lg bg-red-600 px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete My Account"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

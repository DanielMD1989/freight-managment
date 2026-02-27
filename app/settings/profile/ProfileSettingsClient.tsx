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
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-teal-600 text-2xl font-semibold text-white">
            {(user.firstName?.[0] || "").toUpperCase()}
            {(user.lastName?.[0] || "").toUpperCase()}
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
    </div>
  );
}

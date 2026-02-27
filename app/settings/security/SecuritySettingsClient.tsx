"use client";

/**
 * Security Settings Client Component
 *
 * Sprint 19 - Session Management & Security
 *
 * Password change, MFA, and session management
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import { getCSRFToken } from "@/lib/csrfFetch";

interface SecuritySettingsClientProps {
  user: {
    id: string;
    email: string;
    phone: string | null;
    lastLoginAt: string | null;
    mfaEnabled: boolean;
    mfaPhone: string | null;
    recoveryCodesGeneratedAt: string | null;
    recoveryCodesUsedCount: number;
  };
  sessions: {
    id: string;
    deviceInfo: string | null;
    ipAddress: string | null;
    lastSeenAt: string;
    createdAt: string;
  }[];
  securityEvents: {
    id: string;
    eventType: string;
    ipAddress: string | null;
    deviceInfo: string | null;
    success: boolean;
    createdAt: string;
  }[];
}

// Password strength indicator
function PasswordStrength({ password }: { password: string }) {
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  };

  const strength = Object.values(checks).filter(Boolean).length;
  const strengthColors = [
    "bg-red-500",
    "bg-orange-500",
    "bg-yellow-500",
    "bg-green-500",
  ];
  const strengthLabels = ["Weak", "Fair", "Good", "Strong"];

  return (
    <div className="mt-2">
      <div className="mb-1 flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded ${i < strength ? strengthColors[strength - 1] : "bg-gray-200 dark:bg-gray-700"}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-gray-500 dark:text-gray-400">
          {strength > 0 ? strengthLabels[strength - 1] : "Enter password"}
        </span>
        <div className="flex gap-2 text-gray-500 dark:text-gray-400">
          <span className={checks.length ? "text-green-600" : ""}>
            8+ chars
          </span>
          <span className={checks.uppercase ? "text-green-600" : ""}>A-Z</span>
          <span className={checks.lowercase ? "text-green-600" : ""}>a-z</span>
          <span className={checks.number ? "text-green-600" : ""}>0-9</span>
        </div>
      </div>
    </div>
  );
}

export default function SecuritySettingsClient({
  user,
  sessions,
  securityEvents,
}: SecuritySettingsClientProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<
    "password" | "sessions" | "activity"
  >("password");

  // Password change state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Session management state
  const [revokingSession, setRevokingSession] = useState<string | null>(null);
  const [isRevokingAll, setIsRevokingAll] = useState(false);

  // MFA state
  const [mfaStep, setMfaStep] = useState<"idle" | "phone" | "verify" | "codes">(
    "idle"
  );
  const [mfaPhone, setMfaPhone] = useState(user.mfaPhone || "");
  const [mfaOtp, setMfaOtp] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [isEnablingMFA, setIsEnablingMFA] = useState(false);
  const [isDisablingMFA, setIsDisablingMFA] = useState(false);
  const [disablePassword, setDisablePassword] = useState("");

  const handleChangePassword = async () => {
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (passwordForm.newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setIsChangingPassword(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/user/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to change password");
      }

      toast.success(
        "Password changed successfully. Other sessions have been logged out."
      );
      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to change password"
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleRevokeSession = async (sessionId: string) => {
    setRevokingSession(sessionId);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`/api/user/sessions/${sessionId}`, {
        method: "DELETE",
        headers: { ...(csrfToken && { "X-CSRF-Token": csrfToken }) },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke session");
      }

      toast.success("Session revoked successfully");
      router.refresh();
    } catch (error) {
      toast.error("Failed to revoke session");
    } finally {
      setRevokingSession(null);
    }
  };

  // MFA handlers
  const handleStartMFASetup = () => {
    setMfaStep("phone");
    setMfaPhone(user.phone || "");
  };

  const handleSendMFACode = async () => {
    if (!mfaPhone || mfaPhone.length < 9) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setIsEnablingMFA(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/user/mfa/enable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify({ phone: mfaPhone }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send verification code");
      }

      toast.success("Verification code sent to your phone");
      setMfaStep("verify");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send code"
      );
    } finally {
      setIsEnablingMFA(false);
    }
  };

  const handleVerifyMFACode = async () => {
    if (!mfaOtp || mfaOtp.length !== 6) {
      toast.error("Please enter the 6-digit code");
      return;
    }

    setIsEnablingMFA(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/user/mfa/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify({ otp: mfaOtp }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to verify code");
      }

      toast.success("Two-factor authentication enabled!");
      setRecoveryCodes(data.recoveryCodes || []);
      setMfaStep("codes");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to verify code"
      );
    } finally {
      setIsEnablingMFA(false);
    }
  };

  const handleDisableMFA = async () => {
    if (!disablePassword) {
      toast.error("Please enter your password");
      return;
    }

    setIsDisablingMFA(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/user/mfa/disable", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(csrfToken && { "X-CSRF-Token": csrfToken }),
        },
        credentials: "include",
        body: JSON.stringify({ password: disablePassword }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to disable MFA");
      }

      toast.success("Two-factor authentication disabled");
      setDisablePassword("");
      setMfaStep("idle");
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to disable MFA"
      );
    } finally {
      setIsDisablingMFA(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    if (!confirm("This will log you out of all other devices. Continue?")) {
      return;
    }

    setIsRevokingAll(true);
    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch("/api/user/sessions/revoke-all", {
        method: "POST",
        headers: { ...(csrfToken && { "X-CSRF-Token": csrfToken }) },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to revoke sessions");
      }

      const data = await response.json();
      toast.success(`${data.revokedCount} session(s) revoked`);
      router.refresh();
    } catch (error) {
      toast.error("Failed to revoke sessions");
    } finally {
      setIsRevokingAll(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatEventType = (type: string) => {
    const labels: Record<string, string> = {
      LOGIN_SUCCESS: "Successful login",
      LOGIN_FAILURE: "Failed login attempt",
      LOGOUT: "Logged out",
      PASSWORD_CHANGE: "Password changed",
      PASSWORD_RESET: "Password reset",
      MFA_ENABLE: "MFA enabled",
      MFA_DISABLE: "MFA disabled",
      SESSION_REVOKE: "Session revoked",
      SESSION_REVOKE_ALL: "All sessions revoked",
      PROFILE_UPDATE: "Profile updated",
    };
    return labels[type] || type;
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Security Settings
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Manage your password, two-factor authentication, and active sessions
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200 dark:border-slate-700">
        <div className="flex gap-4">
          {[
            { id: "password", label: "Password" },
            { id: "sessions", label: "Sessions" },
            { id: "activity", label: "Activity" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`border-b-2 px-1 pb-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-teal-600 text-teal-600 dark:text-teal-400"
                  : "border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Password Tab */}
      {activeTab === "password" && (
        <div className="space-y-6">
          <div className="max-w-md">
            <h3 className="mb-4 text-sm font-medium text-gray-900 dark:text-white">
              Change Password
            </h3>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Current Password
                </label>
                <input
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      currentPassword: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      newPassword: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                {passwordForm.newPassword && (
                  <PasswordStrength password={passwordForm.newPassword} />
                )}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) =>
                    setPasswordForm({
                      ...passwordForm,
                      confirmPassword: e.target.value,
                    })
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                />
                {passwordForm.confirmPassword &&
                  passwordForm.newPassword !== passwordForm.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">
                      Passwords do not match
                    </p>
                  )}
              </div>

              <button
                onClick={handleChangePassword}
                disabled={
                  isChangingPassword ||
                  !passwordForm.currentPassword ||
                  !passwordForm.newPassword ||
                  passwordForm.newPassword !== passwordForm.confirmPassword
                }
                className="w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isChangingPassword ? "Changing..." : "Change Password"}
              </button>

              <p className="text-xs text-gray-500 dark:text-gray-400">
                Changing your password will log you out of all other devices.
              </p>
            </div>
          </div>

          {/* MFA Section */}
          <div className="border-t border-gray-200 pt-6 dark:border-slate-700">
            <h3 className="mb-2 text-sm font-medium text-gray-900 dark:text-white">
              Two-Factor Authentication
            </h3>
            <p className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Add an extra layer of security to your account with SMS
              verification
            </p>

            {/* MFA Enabled State */}
            {user.mfaEnabled && mfaStep === "idle" && (
              <div className="space-y-4">
                <div className="rounded-lg border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-green-100 p-2 dark:bg-green-800">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-5 w-5 text-green-600 dark:text-green-400"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 1a4.5 4.5 0 00-4.5 4.5V9H5a2 2 0 00-2 2v6a2 2 0 002 2h10a2 2 0 002-2v-6a2 2 0 00-2-2h-.5V5.5A4.5 4.5 0 0010 1zm3 8V5.5a3 3 0 10-6 0V9h6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-green-800 dark:text-green-300">
                        Two-factor authentication is enabled
                      </p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        Phone: ****{user.mfaPhone?.slice(-4)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Enter your password to disable MFA
                  </label>
                  <input
                    type="password"
                    value={disablePassword}
                    onChange={(e) => setDisablePassword(e.target.value)}
                    placeholder="Current password"
                    className="w-full max-w-md rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                  <button
                    onClick={handleDisableMFA}
                    disabled={isDisablingMFA || !disablePassword}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                  >
                    {isDisablingMFA
                      ? "Disabling..."
                      : "Disable Two-Factor Authentication"}
                  </button>
                </div>
              </div>
            )}

            {/* MFA Not Enabled - Idle State */}
            {!user.mfaEnabled && mfaStep === "idle" && (
              <div className="rounded-lg bg-gray-50 p-4 dark:bg-slate-800">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-gray-200 p-2 dark:bg-slate-700">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className="h-5 w-5 text-gray-500"
                    >
                      <path
                        fillRule="evenodd"
                        d="M8 7a5 5 0 113.61 4.804l-1.903 1.903A1 1 0 019 14H8v1a1 1 0 01-1 1H6v1a1 1 0 01-1 1H3a1 1 0 01-1-1v-2a1 1 0 01.293-.707L8.196 8.39A5.002 5.002 0 018 7zm5-3a.75.75 0 000 1.5A1.5 1.5 0 0114.5 7 .75.75 0 0016 7a3 3 0 00-3-3z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Two-factor authentication is not enabled
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Protect your account with SMS verification codes
                    </p>
                  </div>
                  <button
                    onClick={handleStartMFASetup}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
                  >
                    Enable
                  </button>
                </div>
              </div>
            )}

            {/* MFA Setup - Phone Step */}
            {mfaStep === "phone" && (
              <div className="max-w-md space-y-4">
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Step 1: Enter your phone number to receive verification
                    codes
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Phone Number (Ethiopian)
                  </label>
                  <input
                    type="tel"
                    value={mfaPhone}
                    onChange={(e) => setMfaPhone(e.target.value)}
                    placeholder="09XXXXXXXX or +251..."
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleSendMFACode}
                    disabled={isEnablingMFA || !mfaPhone}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                  >
                    {isEnablingMFA ? "Sending..." : "Send Code"}
                  </button>
                  <button
                    onClick={() => setMfaStep("idle")}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {/* MFA Setup - Verify Step */}
            {mfaStep === "verify" && (
              <div className="max-w-md space-y-4">
                <div className="rounded-lg bg-blue-50 p-4 dark:bg-blue-900/20">
                  <p className="text-sm text-blue-800 dark:text-blue-300">
                    Step 2: Enter the 6-digit code sent to your phone
                  </p>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Verification Code
                  </label>
                  <input
                    type="text"
                    value={mfaOtp}
                    onChange={(e) =>
                      setMfaOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    maxLength={6}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-center font-mono text-2xl tracking-widest text-gray-900 dark:border-slate-600 dark:bg-slate-800 dark:text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleVerifyMFACode}
                    disabled={isEnablingMFA || mfaOtp.length !== 6}
                    className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700 disabled:opacity-50"
                  >
                    {isEnablingMFA ? "Verifying..." : "Verify"}
                  </button>
                  <button
                    onClick={() => setMfaStep("phone")}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-800 dark:text-gray-400"
                  >
                    Back
                  </button>
                </div>
              </div>
            )}

            {/* MFA Setup - Recovery Codes Step */}
            {mfaStep === "codes" && recoveryCodes.length > 0 && (
              <div className="space-y-4">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                  <p className="mb-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                    Save your recovery codes!
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    These codes can be used to access your account if you lose
                    your phone. Store them securely. They will not be shown
                    again.
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-100 p-4 font-mono text-sm dark:bg-slate-800">
                  {recoveryCodes.map((code, index) => (
                    <div
                      key={index}
                      className="text-gray-800 dark:text-gray-200"
                    >
                      {code}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(recoveryCodes.join("\n"));
                    toast.success("Recovery codes copied to clipboard");
                  }}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 dark:border-slate-600 dark:text-gray-300 dark:hover:bg-slate-800"
                >
                  Copy All Codes
                </button>
                <button
                  onClick={() => {
                    setMfaStep("idle");
                    setRecoveryCodes([]);
                  }}
                  className="ml-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-teal-700"
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sessions Tab */}
      {activeTab === "sessions" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                Active Sessions
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Manage your logged-in devices
              </p>
            </div>
            {sessions.length > 1 && (
              <button
                onClick={handleRevokeAllSessions}
                disabled={isRevokingAll}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-900/20"
              >
                {isRevokingAll ? "Revoking..." : "Log out all devices"}
              </button>
            )}
          </div>

          <div className="space-y-3">
            {sessions.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No active sessions found
              </p>
            ) : (
              sessions.map((session, index) => (
                <div
                  key={session.id}
                  className={`flex items-center justify-between rounded-lg border p-4 ${
                    index === 0
                      ? "border-teal-200 bg-teal-50 dark:border-teal-800 dark:bg-teal-900/20"
                      : "border-gray-200 dark:border-slate-700"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-white p-2 shadow-sm dark:bg-slate-800">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="h-5 w-5 text-gray-500"
                      >
                        <path
                          fillRule="evenodd"
                          d="M2 4.25A2.25 2.25 0 014.25 2h11.5A2.25 2.25 0 0118 4.25v8.5A2.25 2.25 0 0115.75 15h-3.105a3.501 3.501 0 001.1 1.677A.75.75 0 0113.26 18H6.74a.75.75 0 01-.484-1.323A3.501 3.501 0 007.355 15H4.25A2.25 2.25 0 012 12.75v-8.5zm1.5 0a.75.75 0 01.75-.75h11.5a.75.75 0 01.75.75v7.5a.75.75 0 01-.75.75H4.25a.75.75 0 01-.75-.75v-7.5z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {session.deviceInfo || "Unknown device"}
                        </p>
                        {index === 0 && (
                          <span className="rounded bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700 dark:bg-teal-900/50 dark:text-teal-400">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {session.ipAddress || "Unknown IP"} · Last active{" "}
                        {formatDate(session.lastSeenAt)}
                      </p>
                    </div>
                  </div>
                  {index !== 0 && (
                    <button
                      onClick={() => handleRevokeSession(session.id)}
                      disabled={revokingSession === session.id}
                      className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 disabled:opacity-50 dark:hover:bg-red-900/20"
                    >
                      {revokingSession === session.id
                        ? "Revoking..."
                        : "Revoke"}
                    </button>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Activity Tab */}
      {activeTab === "activity" && (
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Security Activity
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Recent security-related events on your account
            </p>
          </div>

          <div className="space-y-2">
            {securityEvents.length === 0 ? (
              <p className="py-4 text-center text-sm text-gray-500 dark:text-gray-400">
                No security events found
              </p>
            ) : (
              securityEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-slate-800"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        event.success ? "bg-green-500" : "bg-red-500"
                      }`}
                    />
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {formatEventType(event.eventType)}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {event.deviceInfo || "Unknown device"} ·{" "}
                        {event.ipAddress || "Unknown IP"}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {formatDate(event.createdAt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

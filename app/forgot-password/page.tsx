/**
 * Forgot Password Page
 *
 * Sprint 19 - Password Reset Flow
 *
 * Allows users to reset their password using OTP
 */

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-hot-toast";
import Link from "next/link";

type Step = "email" | "otp" | "success";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [devOTP, setDevOTP] = useState<string | null>(null);

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset code");
      }

      // In development, show the OTP for testing
      if (data.devOTP) {
        setDevOTP(data.devOTP);
      }

      toast.success(
        "If an account exists with this email, you will receive a reset code."
      );
      setStep("otp");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to send reset code"
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, otp, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.details) {
          throw new Error(data.details.join(", "));
        }
        throw new Error(data.error || "Failed to reset password");
      }

      toast.success("Password reset successfully!");
      setStep("success");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to reset password"
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Password strength indicator
  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[a-z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(newPassword);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100 px-4 dark:bg-slate-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Reset Your Password
          </h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            {step === "email" && "Enter your email to receive a reset code"}
            {step === "otp" && "Enter the code sent to your email"}
            {step === "success" && "Your password has been reset"}
          </p>
        </div>

        <div className="rounded-xl bg-white p-8 shadow-lg dark:bg-slate-800">
          {step === "email" && (
            <form onSubmit={handleRequestOTP} className="space-y-6">
              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  placeholder="Enter your email"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Sending..." : "Send Reset Code"}
              </button>
            </form>
          )}

          {step === "otp" && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              {devOTP && (
                <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-800 dark:bg-yellow-900/20">
                  <p className="text-xs text-yellow-800 dark:text-yellow-200">
                    <strong>Development Only:</strong> Your OTP is{" "}
                    <code className="rounded bg-yellow-100 px-1 font-mono dark:bg-yellow-800">
                      {devOTP}
                    </code>
                  </p>
                </div>
              )}

              <div>
                <label
                  htmlFor="otp"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Reset Code
                </label>
                <input
                  id="otp"
                  type="text"
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-center font-mono text-2xl tracking-widest text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  placeholder="000000"
                  maxLength={6}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="newPassword"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  New Password
                </label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  placeholder="Enter new password"
                  required
                />
                {/* Password strength indicator */}
                {newPassword && (
                  <div className="mt-2">
                    <div className="flex gap-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className={`h-1 flex-1 rounded ${
                            passwordStrength >= level
                              ? passwordStrength <= 1
                                ? "bg-red-500"
                                : passwordStrength <= 2
                                  ? "bg-orange-500"
                                  : passwordStrength <= 3
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                              : "bg-gray-200 dark:bg-gray-700"
                          }`}
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {passwordStrength <= 1 && "Weak"}
                      {passwordStrength === 2 && "Fair"}
                      {passwordStrength === 3 && "Good"}
                      {passwordStrength === 4 && "Strong"}
                    </p>
                  </div>
                )}
                <ul className="mt-2 space-y-1 text-xs text-gray-500 dark:text-gray-400">
                  <li
                    className={newPassword.length >= 8 ? "text-green-600" : ""}
                  >
                    {newPassword.length >= 8 ? "✓" : "○"} At least 8 characters
                  </li>
                  <li
                    className={
                      /[A-Z]/.test(newPassword) ? "text-green-600" : ""
                    }
                  >
                    {/[A-Z]/.test(newPassword) ? "✓" : "○"} One uppercase letter
                  </li>
                  <li
                    className={
                      /[a-z]/.test(newPassword) ? "text-green-600" : ""
                    }
                  >
                    {/[a-z]/.test(newPassword) ? "✓" : "○"} One lowercase letter
                  </li>
                  <li
                    className={
                      /[0-9]/.test(newPassword) ? "text-green-600" : ""
                    }
                  >
                    {/[0-9]/.test(newPassword) ? "✓" : "○"} One number
                  </li>
                </ul>
              </div>

              <div>
                <label
                  htmlFor="confirmPassword"
                  className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  Confirm Password
                </label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-gray-900 focus:border-transparent focus:ring-2 focus:ring-teal-500 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                  placeholder="Confirm new password"
                  required
                />
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="mt-1 text-xs text-red-500">
                    Passwords do not match
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={
                  isLoading ||
                  passwordStrength < 4 ||
                  newPassword !== confirmPassword
                }
                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {isLoading ? "Resetting..." : "Reset Password"}
              </button>

              <button
                type="button"
                onClick={() => setStep("email")}
                className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                Didn&apos;t receive a code? Try again
              </button>
            </form>
          )}

          {step === "success" && (
            <div className="space-y-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  className="h-8 w-8 text-green-600 dark:text-green-400"
                >
                  <path
                    fillRule="evenodd"
                    d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Password Reset Complete
                </h2>
                <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                  Your password has been successfully reset. You can now log in
                  with your new password.
                </p>
              </div>
              <Link
                href="/login"
                className="inline-block w-full rounded-lg bg-blue-600 px-4 py-3 text-center font-medium text-white transition-colors hover:bg-blue-700"
              >
                Go to Login
              </Link>
            </div>
          )}
        </div>

        {step !== "success" && (
          <p className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
            Remember your password?{" "}
            <Link
              href="/login"
              className="text-teal-600 hover:text-teal-700 dark:text-teal-400"
            >
              Back to Login
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}

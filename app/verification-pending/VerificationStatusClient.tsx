"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { csrfFetch } from "@/lib/csrfFetch";

interface VerificationStep {
  id: string;
  label: string;
  status: "completed" | "pending" | "not_started";
  description?: string;
}

interface VerificationData {
  status: string;
  userRole: string;
  canAccessMarketplace: boolean;
  organization: {
    id: string;
    name: string;
    type: string;
    isVerified: boolean;
    verificationStatus: string;
    rejectionReason: string | null;
    documentsLockedAt: string | null;
  } | null;
  verification: {
    steps: VerificationStep[];
    progressPercent: number;
    documentsUploaded: boolean;
    documentCount: number;
    isEmailVerified: boolean;
    isPhoneVerified: boolean;
  };
  nextAction: {
    type: string;
    label: string;
    description: string;
  } | null;
  estimatedReviewTime: string | null;
}

interface Props {
  initialStatus: string;
  userRole: string;
  userEmail: string;
}

export function VerificationStatusClient({
  initialStatus,
  userRole,
  userEmail,
}: Props) {
  const router = useRouter();
  const [data, setData] = useState<VerificationData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  // OTP verification state
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [otpExpiresAt, setOtpExpiresAt] = useState<number | null>(null);
  const [otpCountdown, setOtpCountdown] = useState<number>(0);
  const [otpVerified, setOtpVerified] = useState(false);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // OTP countdown timer
  useEffect(() => {
    if (otpExpiresAt) {
      const tick = () => {
        const remaining = Math.max(
          0,
          Math.floor((otpExpiresAt - Date.now()) / 1000)
        );
        setOtpCountdown(remaining);
        if (remaining <= 0 && countdownRef.current) {
          clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
      };
      tick();
      countdownRef.current = setInterval(tick, 1000);
      return () => {
        if (countdownRef.current) clearInterval(countdownRef.current);
      };
    }
  }, [otpExpiresAt]);

  const sendOtp = async () => {
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await csrfFetch("/api/auth/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ channel: "email" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Failed to send OTP");
      }
      const body = await res.json();
      setOtpSent(true);
      setOtpExpiresAt(Date.now() + (body.expiresIn ?? 600) * 1000);
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Failed to send OTP");
    } finally {
      setOtpLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otpCode.length !== 6) return;
    setOtpLoading(true);
    setOtpError(null);
    try {
      const res = await csrfFetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ code: otpCode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Invalid code");
      }
      setOtpVerified(true);
      // Refresh status checklist to show email verified
      fetchStatus();
    } catch (err) {
      setOtpError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setOtpLoading(false);
    }
  };

  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/user/verification-status");
      if (!response.ok) {
        throw new Error("Failed to fetch verification status");
      }
      const result = await response.json();
      setData(result);
      setLastRefresh(new Date());

      // If user became ACTIVE, redirect to their portal
      if (result.canAccessMarketplace) {
        const redirectPath =
          userRole === "CARRIER"
            ? "/carrier"
            : userRole === "SHIPPER"
              ? "/shipper"
              : userRole === "DISPATCHER"
                ? "/dispatcher"
                : "/";
        router.push(redirectPath);
        return;
      }

      // G-W5-1: Redirect on rejection or suspension
      if (result.status === "REJECTED") {
        router.push("/account-rejected");
        return;
      }
      if (result.status === "SUSPENDED") {
        router.push("/account-suspended");
        return;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [router, userRole]);

  // Initial fetch and auto-refresh every 30 seconds
  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const getStepIcon = (status: "completed" | "pending" | "not_started") => {
    switch (status) {
      case "completed":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        );
      case "pending":
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-yellow-100">
            <svg
              className="h-5 w-5 animate-spin text-yellow-600"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          </div>
        );
      default:
        return (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
            <div className="h-3 w-3 rounded-full bg-slate-300" />
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-blue-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
            <svg
              className="h-8 w-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mb-2 text-xl font-semibold text-gray-900">
            Error Loading Status
          </h2>
          <p className="mb-4 text-gray-600">{error}</p>
          <button
            onClick={fetchStatus}
            className="rounded-lg bg-blue-600 px-6 py-2 text-white transition hover:bg-blue-700"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-8 py-6 text-white">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-white/20">
            <svg
              className="h-7 w-7"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Account Verification</h1>
            <p className="text-sm text-blue-100">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="border-b border-slate-100 px-8 py-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-slate-700">Progress</span>
          <span className="text-sm font-semibold text-blue-600">
            {data?.verification.progressPercent || 0}%
          </span>
        </div>
        <div className="h-2 w-full rounded-full bg-slate-100">
          <div
            className="h-2 rounded-full bg-blue-600 transition-all duration-500"
            style={{ width: `${data?.verification.progressPercent || 0}%` }}
          />
        </div>
      </div>

      {/* OTP Verification — G-AUDIT-5 */}
      {data && data.verification.isEmailVerified === false && !otpVerified && (
        <div className="border-b border-slate-100 px-8 py-6">
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5">
            <h3 className="mb-2 text-base font-semibold text-amber-900">
              Email Verification Required
            </h3>
            {!otpSent ? (
              <>
                <p className="mb-4 text-sm text-amber-700">
                  We need to verify your email address ({userEmail}) before
                  proceeding.
                </p>
                <button
                  onClick={sendOtp}
                  disabled={otpLoading}
                  className="rounded-lg bg-amber-600 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
                >
                  {otpLoading ? "Sending..." : "Send Verification Code"}
                </button>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-amber-700">
                  Enter the 6-digit code sent to {userEmail}
                </p>
                <div className="mb-3 flex gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) =>
                      setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="000000"
                    className="w-32 rounded-lg border border-amber-300 bg-white px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-amber-500 focus:ring-2 focus:ring-amber-200 focus:outline-none"
                  />
                  <button
                    onClick={verifyOtp}
                    disabled={otpLoading || otpCode.length !== 6}
                    className="rounded-lg bg-amber-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-amber-700 disabled:opacity-50"
                  >
                    {otpLoading ? "Verifying..." : "Verify"}
                  </button>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  {otpCountdown > 0 ? (
                    <span className="text-amber-600">
                      Code expires in {Math.floor(otpCountdown / 60)}:
                      {String(otpCountdown % 60).padStart(2, "0")}
                    </span>
                  ) : (
                    <button
                      onClick={sendOtp}
                      disabled={otpLoading}
                      className="text-amber-700 underline hover:text-amber-900 disabled:opacity-50"
                    >
                      Resend Code
                    </button>
                  )}
                </div>
              </>
            )}
            {otpError && (
              <p className="mt-2 text-sm text-red-600">{otpError}</p>
            )}
          </div>
        </div>
      )}

      {/* OTP Verified success */}
      {otpVerified && (
        <div className="border-b border-slate-100 px-8 py-4">
          <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3">
            <svg
              className="h-5 w-5 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
            <span className="text-sm font-medium text-green-700">
              Email verified successfully
            </span>
          </div>
        </div>
      )}

      {/* Status Badge */}
      <div className="px-8 pt-6 pb-2">
        <div className="inline-flex items-center gap-2 rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-sm font-medium text-yellow-700">
          <span className="h-2 w-2 animate-pulse rounded-full bg-yellow-500" />
          {initialStatus === "REGISTERED"
            ? "Registration Complete"
            : "Under Review"}
        </div>
      </div>

      {/* Verification Steps */}
      <div className="px-8 py-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Verification Steps
        </h2>
        <div className="space-y-4">
          {data?.verification.steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-4">
              {getStepIcon(step.status)}
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className={`font-medium ${
                      step.status === "completed"
                        ? "text-green-700"
                        : step.status === "pending"
                          ? "text-yellow-700"
                          : "text-slate-500"
                    }`}
                  >
                    {step.label}
                  </span>
                  {step.status === "pending" && (
                    <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700">
                      In Progress
                    </span>
                  )}
                </div>
                {step.description && (
                  <p className="mt-0.5 text-sm text-slate-500">
                    {step.description}
                  </p>
                )}
              </div>
              {index < (data?.verification.steps.length || 0) - 1 && (
                <div className="absolute top-8 left-4 h-8 w-0.5 bg-slate-200" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Next Action */}
      {data?.nextAction && (
        <div className="px-8 pb-6">
          <div className="rounded-xl border border-blue-100 bg-blue-50 p-4">
            <h3 className="mb-1 font-semibold text-blue-900">
              {data.nextAction.label}
            </h3>
            <p className="text-sm text-blue-700">
              {data.nextAction.description}
            </p>
            {data.nextAction.type === "upload_documents" && (
              <Link
                href={
                  userRole === "CARRIER"
                    ? "/carrier/documents"
                    : "/shipper/documents"
                }
                className="mt-3 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                  />
                </svg>
                Upload Documents
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Estimated Time */}
      {data?.estimatedReviewTime && (
        <div className="px-8 pb-6">
          <div className="flex items-center gap-3 text-sm text-slate-600">
            <svg
              className="h-5 w-5 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>
              Estimated review time:{" "}
              <span className="font-medium">{data.estimatedReviewTime}</span>
            </span>
          </div>
        </div>
      )}

      {/* Organization Info */}
      {data?.organization && (
        <div className="px-8 pb-6">
          <div className="rounded-xl bg-slate-50 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-200">
                <svg
                  className="h-5 w-5 text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <div>
                <p className="font-medium text-slate-900">
                  {data.organization.name}
                </p>
                <p className="text-sm text-slate-500">
                  {data.organization.type.replace(/_/g, " ")}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer Actions */}
      <div className="border-t border-slate-100 bg-slate-50 px-8 py-6">
        <div className="flex flex-col gap-3 sm:flex-row">
          <a
            href="mailto:support@freightflow.app"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              />
            </svg>
            Contact Support
          </a>
          <a
            href="/api/auth/logout"
            className="inline-flex flex-1 items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
              />
            </svg>
            Log Out
          </a>
        </div>

        {/* Last Refresh */}
        <div className="mt-4 text-center">
          <button
            onClick={fetchStatus}
            className="text-xs text-slate-400 transition hover:text-slate-600"
          >
            Last updated: {lastRefresh.toLocaleTimeString()} • Click to refresh
          </button>
        </div>
      </div>
    </div>
  );
}

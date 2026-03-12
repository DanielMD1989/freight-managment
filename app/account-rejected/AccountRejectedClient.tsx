"use client";

import { useState, useEffect } from "react";

interface Props {
  userEmail: string;
  userRole: string;
}

interface VerificationStatus {
  status: string;
  organization: {
    rejectionReason: string | null;
    name: string;
  } | null;
}

export function AccountRejectedClient({ userEmail, userRole }: Props) {
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function fetchStatus() {
      try {
        const response = await fetch("/api/user/verification-status");
        if (response.ok) {
          const data: VerificationStatus = await response.json();
          setRejectionReason(data.organization?.rejectionReason ?? null);
        }
      } catch {
        // Show generic message on failure
      } finally {
        setLoading(false);
      }
    }
    fetchStatus();
  }, []);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const response = await fetch("/api/user/verification-status");
      if (response.ok) {
        const data: VerificationStatus = await response.json();
        // If status changed from REJECTED, reload to trigger middleware redirect
        if (data.status !== "REJECTED") {
          window.location.href = "/";
          return;
        }
        setRejectionReason(data.organization?.rejectionReason ?? null);
      }
    } catch {
      // Ignore
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  if (loading) {
    return (
      <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-xl">
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-red-600 border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 px-8 py-6 text-white">
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
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Registration Rejected</h1>
            <p className="text-sm text-red-100">{userEmail}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {rejectionReason ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <h3 className="mb-1 text-sm font-semibold text-red-800">
              Reason for Rejection
            </h3>
            <p className="text-sm text-red-700">{rejectionReason}</p>
          </div>
        ) : (
          <p className="text-slate-600">
            Your registration was not approved. Please review your documents and
            resubmit for another review.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="border-t border-slate-100 bg-slate-50 px-8 py-6">
        <div className="flex flex-col gap-3">
          <a
            href={
              userRole === "CARRIER"
                ? "/carrier/documents"
                : "/shipper/documents"
            }
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
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
            Resubmit Documents
          </a>
          <button
            onClick={handleCheckStatus}
            disabled={checking}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            {checking ? (
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
            ) : (
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
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            )}
            Check Status
          </button>
          <button
            onClick={handleLogout}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-slate-500 transition hover:text-slate-700"
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
          </button>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useState } from "react";

interface Props {
  status: "REGISTERED" | "PENDING_VERIFICATION";
}

/**
 * Banner shown at the top of allowed pages for users pending verification.
 * Displays warning about limited access and links to take action.
 */
export function PendingVerificationBanner({ status }: Props) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) {
    return null;
  }

  return (
    <div className="border-b border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            {/* Warning Icon */}
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-amber-600"
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

            {/* Message */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-amber-800">
                {status === "REGISTERED" ? (
                  <>
                    Your account is pending verification.{" "}
                    <span className="font-normal text-amber-700">
                      Upload your documents to access the marketplace.
                    </span>
                  </>
                ) : (
                  <>
                    Your documents are under review.{" "}
                    <span className="font-normal text-amber-700">
                      We&apos;ll notify you once verified.
                    </span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {status === "REGISTERED" && (
              <Link
                href="/settings/documents"
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-amber-700"
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

            <Link
              href="/verification-pending"
              className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-sm font-medium text-amber-700 transition hover:bg-amber-50"
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              Check Status
            </Link>

            {/* Dismiss button */}
            <button
              onClick={() => setDismissed(true)}
              className="rounded-lg p-1.5 text-amber-500 transition hover:bg-amber-100 hover:text-amber-700"
              aria-label="Dismiss"
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
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Wrapper component that fetches status and renders banner if needed.
 * Use this in layouts where you want the banner to appear conditionally.
 */
export function PendingVerificationBannerWrapper() {
  // Note: This component should receive status from parent or context
  // For now, we'll export the base component to be used with server-side props
  return null;
}

export default PendingVerificationBanner;

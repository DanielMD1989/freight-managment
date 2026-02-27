/**
 * Unauthorized Access Page
 *
 * Displayed when users try to access pages without proper permissions
 */

"use client";

import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="mb-4 text-6xl">🔒</div>
          <h1 className="mb-2 text-3xl font-bold text-gray-900">
            Access Denied
          </h1>
          <p className="text-gray-600">
            You don&apos;t have permission to access this page.
          </p>
        </div>

        <div className="mb-6 rounded-lg bg-white p-6 shadow-md">
          <h2 className="mb-3 text-lg font-semibold text-gray-900">
            Common Reasons:
          </h2>
          <ul className="space-y-2 text-left text-sm text-gray-600">
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>You need a different role to access this page</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>You need to belong to an organization</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>Your account needs verification</span>
            </li>
            <li className="flex items-start gap-2">
              <span>•</span>
              <span>The resource belongs to another organization</span>
            </li>
          </ul>
        </div>

        <div className="space-y-3">
          <Link
            href="/"
            className="block w-full rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition-colors hover:bg-blue-700"
          >
            Go to Homepage
          </Link>
          <Link
            href="/"
            className="block w-full rounded-lg border border-gray-300 px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Go to Portal
          </Link>
          <button
            onClick={() => window.history.back()}
            className="block w-full px-6 py-3 font-medium text-gray-600 hover:text-gray-900"
          >
            ← Go Back
          </button>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          Need help? Contact your administrator or{" "}
          <a
            href="mailto:support@example.com"
            className="text-blue-600 hover:underline"
          >
            support@example.com
          </a>
        </div>
      </div>
    </div>
  );
}

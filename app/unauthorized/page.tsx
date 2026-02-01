/**
 * Unauthorized Access Page
 *
 * Displayed when users try to access pages without proper permissions
 */

'use client';

import Link from 'next/link';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        <div className="mb-8">
          <div className="text-6xl mb-4">🔒</div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600">
            You don't have permission to access this page.
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">
            Common Reasons:
          </h2>
          <ul className="text-left space-y-2 text-sm text-gray-600">
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
            className="block w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            Go to Homepage
          </Link>
          <Link
            href="/"
            className="block w-full px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
          >
            Go to Portal
          </Link>
          <button
            onClick={() => window.history.back()}
            className="block w-full px-6 py-3 text-gray-600 hover:text-gray-900 font-medium"
          >
            ← Go Back
          </button>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          Need help? Contact your administrator or{' '}
          <a href="mailto:support@example.com" className="text-blue-600 hover:underline">
            support@example.com
          </a>
        </div>
      </div>
    </div>
  );
}

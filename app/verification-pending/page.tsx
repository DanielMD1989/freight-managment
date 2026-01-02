/**
 * Sprint 2: User Verification Workflow
 * Page shown to users whose accounts are pending verification
 */

import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function VerificationPendingPage() {
  const session = await getSession();

  if (!session) {
    redirect('/login');
  }

  // If user is already ACTIVE, redirect to dashboard
  if (session.status === 'ACTIVE') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white shadow-lg rounded-lg p-8">
        <div className="text-center">
          {/* Icon */}
          <div className="mx-auto w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-4">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>

          {/* Title */}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Account Verification Pending
          </h1>

          {/* Status */}
          {session.status === 'REGISTERED' && (
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Thank you for registering! Your account has been created successfully.
              </p>
              <p className="text-gray-600 mb-4">
                To access the marketplace, please upload your verification documents.
              </p>
              <button className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition">
                Upload Documents
              </button>
            </div>
          )}

          {session.status === 'PENDING_VERIFICATION' && (
            <div className="mb-6">
              <p className="text-gray-600 mb-4">
                Your documents have been submitted and are currently under review by our team.
              </p>
              <p className="text-gray-600 mb-4">
                We will notify you once your account has been verified. This typically takes 1-2 business days.
              </p>
            </div>
          )}

          {/* Contact Info */}
          <div className="bg-gray-50 rounded-lg p-4 mt-6">
            <p className="text-sm text-gray-600">
              Need help? Contact our support team at{' '}
              <a href="mailto:support@freightplatform.com" className="text-blue-600 hover:underline">
                support@freightplatform.com
              </a>
            </p>
          </div>

          {/* Logout Button */}
          <div className="mt-6">
            <a
              href="/api/auth/logout"
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Log out
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

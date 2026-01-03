/**
 * Platform Metrics Dashboard Page
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.8: Platform Metrics Dashboard
 *
 * Comprehensive platform health and performance overview
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import PlatformMetricsClient from './PlatformMetricsClient';

export const metadata = {
  title: 'Platform Metrics | Admin',
  description: 'Comprehensive platform health and performance metrics',
};

export default async function PlatformMetricsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Only Super Admins can access
  if (user.role !== 'SUPER_ADMIN') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Platform Metrics Dashboard
          </h1>
          <p className="text-gray-600 mt-2">
            Comprehensive overview of platform health, performance, and growth
          </p>
        </div>

        {/* Info Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">
            Real-Time Platform Insights
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-800">
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-bold">•</span>
                <span>
                  <strong>User Metrics:</strong> Total users, active rates, and organization breakdown
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">•</span>
                <span>
                  <strong>Load Performance:</strong> Completion rates, active loads, and status distribution
                </span>
              </li>
            </ul>
            <ul className="space-y-2">
              <li className="flex items-start gap-2">
                <span className="font-bold">•</span>
                <span>
                  <strong>Financial Health:</strong> Total revenue, settlement status, and commission tracking
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold">•</span>
                <span>
                  <strong>Trust & Safety:</strong> Flagged organizations, disputes, and bypass detection
                </span>
              </li>
            </ul>
          </div>
        </div>

        {/* Client Component */}
        <PlatformMetricsClient />
      </div>
    </div>
  );
}

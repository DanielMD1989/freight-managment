/**
 * Admin Commission Settings Page
 *
 * Sprint 16 - Story 16.9: Admin Tools for GPS & Commission Management
 *
 * Manage platform commission rates and view revenue statistics
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CommissionSettingsClient from './CommissionSettingsClient';

export const metadata = {
  title: 'Commission Settings | Admin',
  description: 'Manage platform commission rates and view revenue',
};

export default async function CommissionSettingsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Only admins can access
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Commission Settings
          </h1>
          <p className="text-gray-600 mt-2">
            Configure platform commission rates and monitor revenue
          </p>
        </div>

        {/* Client Component */}
        <CommissionSettingsClient />
      </div>
    </div>
  );
}

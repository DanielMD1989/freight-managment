/**
 * Admin GPS Management Page
 *
 * Sprint 16 - Story 16.9: Admin Tools for GPS & Commission Management
 *
 * Manage GPS devices, view status, and monitor truck tracking
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import GpsManagementClient from './GpsManagementClient';

export const metadata = {
  title: 'GPS Management | Admin',
  description: 'Manage GPS devices and monitor truck tracking',
};

export default async function GpsManagementPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Only admins and platform ops can access
  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            GPS Device Management
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor and manage GPS devices across all trucks
          </p>
        </div>

        {/* Client Component */}
        <GpsManagementClient />
      </div>
    </div>
  );
}

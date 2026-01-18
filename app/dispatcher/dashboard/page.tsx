/**
 * Dispatcher Dashboard
 *
 * Sprint 16 - Story 16.4: Dispatcher System
 *
 * System-wide view of all loads and trucks for dispatchers
 * - View all loads (any organization)
 * - View all trucks (any organization)
 * - Assign loads to trucks
 * - Access GPS tracking for all active loads
 * - Filter and search capabilities
 */

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import DispatcherDashboardClient from './DispatcherDashboardClient';

export const metadata: Metadata = {
  title: 'Dispatcher Dashboard - Freight Management',
  description: 'System-wide dispatcher dashboard for load and truck management',
};

export default async function DispatcherDashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Only DISPATCHER, PLATFORM_OPS, and ADMIN can access
  if (
    user.role !== 'DISPATCHER' &&
    user.role !== 'SUPER_ADMIN' &&
    user.role !== 'ADMIN'
  ) {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-[1800px] mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Dispatcher Dashboard
          </h1>
          <p className="text-gray-600 mt-1">
            System-wide view of all loads and trucks
          </p>
        </div>

        {/* Client Component */}
        <DispatcherDashboardClient
          user={{
            userId: user.id,
            email: user.email,
            role: user.role,
            name: [user.firstName, user.lastName].filter(Boolean).join(' ') || undefined,
          }}
        />
      </div>
    </div>
  );
}

/**
 * Feature Flags Management Page
 *
 * Sprint 10 - Story 10.7: Feature Flag System
 *
 * Allows admins to toggle features on/off for the platform
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import FeatureFlagsClient from './FeatureFlagsClient';

export const metadata = {
  title: 'Feature Flags | Admin',
  description: 'Manage platform feature flags',
};

export default async function FeatureFlagsPage() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/admin/feature-flags');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/unauthorized');
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Feature Flags</h1>
        <p className="text-gray-600 mt-2">
          Enable or disable platform features
        </p>
      </div>

      <FeatureFlagsClient />
    </div>
  );
}

/**
 * Admin Analytics Dashboard Page
 *
 * Comprehensive analytics with time period filtering
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import AdminAnalyticsClient from './AdminAnalyticsClient';

export const metadata = {
  title: 'Analytics | Admin',
  description: 'Platform analytics and performance metrics',
};

export default async function AdminAnalyticsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-[var(--bg-tinted)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <AdminAnalyticsClient />
      </div>
    </div>
  );
}

/**
 * Shipper Analytics Dashboard Page
 *
 * Analytics for shipper's own loads and performance
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import ShipperAnalyticsClient from './ShipperAnalyticsClient';

export const metadata = {
  title: 'Analytics | Shipper Dashboard',
  description: 'Your load analytics and performance metrics',
};

export default async function ShipperAnalyticsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'SHIPPER' && user.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-[var(--bg-tinted)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <ShipperAnalyticsClient />
      </div>
    </div>
  );
}

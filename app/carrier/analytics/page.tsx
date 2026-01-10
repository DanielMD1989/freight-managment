/**
 * Carrier Analytics Dashboard Page
 *
 * Analytics for carrier's trucks and performance
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import CarrierAnalyticsClient from './CarrierAnalyticsClient';

export const metadata = {
  title: 'Analytics | Carrier Dashboard',
  description: 'Your truck and load analytics',
};

export default async function CarrierAnalyticsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  if (user.role !== 'CARRIER' && user.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-[var(--bg-tinted)]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <CarrierAnalyticsClient />
      </div>
    </div>
  );
}

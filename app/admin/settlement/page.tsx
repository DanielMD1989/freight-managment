/**
 * Settlement Automation Dashboard
 *
 * Sprint 16 - Story 16.7: Commission & Revenue Model
 *
 * Admin dashboard for monitoring and managing automated settlements
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import SettlementAutomationClient from './SettlementAutomationClient';

export const metadata = {
  title: 'Settlement Automation | Admin',
  description: 'Monitor and manage automated POD verification and settlements',
};

export default async function SettlementAutomationPage() {
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
            Settlement Automation
          </h1>
          <p className="text-gray-600 mt-2">
            Monitor POD verification and settlement processing
          </p>
        </div>

        {/* Client Component */}
        <SettlementAutomationClient />
      </div>
    </div>
  );
}

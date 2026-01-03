/**
 * Automation Rules Engine Page
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.5: Automation Rules Engine
 *
 * SuperAdmin page for configuring settlement automation rules
 */

import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { db } from '@/lib/db';
import AutomationRulesClient from './AutomationRulesClient';

export const metadata = {
  title: 'Automation Rules | Admin',
  description: 'Configure settlement automation rules',
};

export default async function AutomationRulesPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Only Super Admins can access
  if (user.role !== 'SUPER_ADMIN') {
    redirect('/unauthorized');
  }

  // Fetch current automation settings
  let settings = await db.systemSettings.findUnique({
    where: { id: 'system' },
    select: {
      settlementAutomationEnabled: true,
      autoVerifyPodEnabled: true,
      autoVerifyPodTimeoutHours: true,
      settlementBatchSize: true,
      emailNotifySettlementSuccess: true,
      emailNotifySettlementFailure: true,
      autoSettlementMinAmount: true,
      autoSettlementMaxAmount: true,
    },
  });

  // Create default settings if they don't exist
  if (!settings) {
    settings = await db.systemSettings.create({
      data: {
        id: 'system',
        lastModifiedBy: user.id,
        settlementAutomationEnabled: true,
        autoVerifyPodEnabled: true,
        autoVerifyPodTimeoutHours: 24,
        settlementBatchSize: 50,
        emailNotifySettlementSuccess: false,
        emailNotifySettlementFailure: true,
        autoSettlementMinAmount: 0,
        autoSettlementMaxAmount: 0,
      },
      select: {
        settlementAutomationEnabled: true,
        autoVerifyPodEnabled: true,
        autoVerifyPodTimeoutHours: true,
        settlementBatchSize: true,
        emailNotifySettlementSuccess: true,
        emailNotifySettlementFailure: true,
        autoSettlementMinAmount: true,
        autoSettlementMaxAmount: true,
      },
    });
  }

  // Convert Decimal to number for client component
  const initialSettings = {
    settlementAutomationEnabled: settings.settlementAutomationEnabled,
    autoVerifyPodEnabled: settings.autoVerifyPodEnabled,
    autoVerifyPodTimeoutHours: settings.autoVerifyPodTimeoutHours,
    settlementBatchSize: settings.settlementBatchSize,
    emailNotifySettlementSuccess: settings.emailNotifySettlementSuccess,
    emailNotifySettlementFailure: settings.emailNotifySettlementFailure,
    autoSettlementMinAmount: Number(settings.autoSettlementMinAmount),
    autoSettlementMaxAmount: Number(settings.autoSettlementMaxAmount),
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Automation Rules Engine
              </h1>
              <p className="text-gray-600 mt-2">
                Configure settlement automation behavior and rules
              </p>
            </div>
            <a
              href="/admin/settlement"
              className="px-4 py-2 bg-gray-100 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-200 font-medium"
            >
              Back to Settlement
            </a>
          </div>
        </div>

        {/* Info Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">
            About Automation Rules
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>
                <strong>Settlement Automation:</strong> When enabled, the system
                automatically processes settlements for loads with verified POD
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>
                <strong>Auto-Verify POD:</strong> Automatically verifies POD after
                the configured timeout if shipper doesn't respond
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>
                <strong>Amount Limits:</strong> Set minimum and maximum amounts for
                auto-settlement. Loads outside these limits require manual approval
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>
                <strong>Batch Size:</strong> Controls how many settlements are
                processed at once to prevent system overload
              </span>
            </li>
          </ul>
        </div>

        {/* Client Component */}
        <AutomationRulesClient initialSettings={initialSettings} />
      </div>
    </div>
  );
}

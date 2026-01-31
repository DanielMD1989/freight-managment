/**
 * System Settings Page
 *
 * Sprint 10 - Story 10.6: System Configuration
 *
 * Allows admins to configure platform-wide settings
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import SystemSettingsClient from './SystemSettingsClient';

interface SystemSettings {
  id: string;
  // Rate Limiting
  rateLimitDocumentUpload: number;
  rateLimitTruckPosting: number;
  rateLimitFileDownload: number;
  rateLimitAuthAttempts: number;

  // Match Score Thresholds
  matchScoreMinimum: number;
  matchScoreGood: number;
  matchScoreExcellent: number;

  // Email Notifications
  emailNotificationsEnabled: boolean;
  emailNotifyDocumentApproval: boolean;
  emailNotifyDocumentRejection: boolean;
  emailNotifyLoadAssignment: boolean;
  emailNotifyPodVerification: boolean;

  // File Upload Limits
  maxFileUploadSizeMb: number;
  maxDocumentsPerEntity: number;

  // General Settings
  platformMaintenanceMode: boolean;
  platformMaintenanceMessage: string | null;
  requireEmailVerification: boolean;
  requirePhoneVerification: boolean;

  // Metadata
  lastModifiedBy: string;
  lastModifiedAt: string;
  createdAt: string;
}

/**
 * Fetch system settings from API
 */
async function getSettings(): Promise<SystemSettings | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const response = await fetch(`${baseUrl}/api/admin/settings`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch settings:', response.status);
      return null;
    }

    const data = await response.json();
    return data.settings;
  } catch (error) {
    console.error('Error fetching settings:', error);
    return null;
  }
}

/**
 * System Settings Page
 */
export default async function SystemSettingsPage() {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/admin/settings');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN')) {
    redirect('/unauthorized');
  }

  // Fetch settings
  const settings = await getSettings();

  if (!settings) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
          <p className="text-gray-600 mt-2">Configure platform-wide settings</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            Failed to load settings. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">System Settings</h1>
        <p className="text-gray-600 mt-2">
          Configure platform-wide settings and defaults
        </p>
      </div>

      {/* Settings Client Component */}
      <SystemSettingsClient initialSettings={settings} />
    </div>
  );
}

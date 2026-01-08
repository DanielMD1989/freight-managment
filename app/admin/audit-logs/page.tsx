/**
 * Global Audit Log Viewer Page
 *
 * View and filter audit logs for security monitoring
 * Sprint 10 - Story 10.5: Audit Logs Viewer
 * Sprint 16 - Story 16.9A: SuperAdmin Tools (Enhanced)
 */

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { getCurrentUser } from '@/lib/auth';
import AuditLogViewerClient from './AuditLogViewerClient';

interface AuditLog {
  id: string;
  eventType: string;
  severity: string;
  userId: string | null;
  userEmail: string | null;
  organizationId: string | null;
  organizationName: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  resource: string | null;
  resourceId: string | null;
  action: string | null;
  result: 'SUCCESS' | 'FAILURE';
  details: Record<string, any> | null;
  timestamp: string;
}

interface AuditLogsResponse {
  logs: AuditLog[];
  total: number;
  limit: number;
  offset: number;
}

/**
 * Fetch audit logs from API
 */
async function getAuditLogs(
  offset: number = 0,
  limit: number = 100,
  filters?: {
    severity?: string;
    eventType?: string;
    userId?: string;
    organizationId?: string;
    startDate?: string;
    endDate?: string;
  }
): Promise<AuditLogsResponse | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session');

    if (!sessionCookie) {
      return null;
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const params = new URLSearchParams({
      offset: offset.toString(),
      limit: limit.toString(),
    });

    if (filters) {
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.eventType) params.append('eventType', filters.eventType);
      if (filters.userId) params.append('userId', filters.userId);
      if (filters.organizationId)
        params.append('organizationId', filters.organizationId);
      if (filters.startDate) params.append('startDate', filters.startDate);
      if (filters.endDate) params.append('endDate', filters.endDate);
    }

    const response = await fetch(`${baseUrl}/api/admin/audit-logs?${params}`, {
      headers: {
        Cookie: `session=${sessionCookie.value}`,
      },
      cache: 'no-store',
    });

    if (!response.ok) {
      console.error('Failed to fetch audit logs:', response.status);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return null;
  }
}

/**
 * Global Audit Log Viewer Page - SuperAdmin Access
 */
export default async function AdminAuditLogsPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Only Super Admins can access
  if (user.role !== 'SUPER_ADMIN') {
    redirect('/unauthorized');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Global Audit Log Viewer
          </h1>
          <p className="text-gray-600 mt-2">
            View and filter all platform activity and security events
          </p>
        </div>

        {/* Info Panel */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
          <h3 className="font-semibold text-blue-900 mb-3">
            About Audit Logs
          </h3>
          <ul className="space-y-2 text-sm text-blue-800">
            <li className="flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>
                <strong>Security Events:</strong> Authentication attempts, permission changes, and access violations
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>
                <strong>Data Operations:</strong> Create, update, and delete operations on critical resources
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>
                <strong>System Events:</strong> Configuration changes, automation runs, and system alerts
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-bold">•</span>
              <span>
                <strong>Compliance:</strong> All events are immutable and retained for audit and compliance purposes
              </span>
            </li>
          </ul>
        </div>

        {/* Client Component */}
        <AuditLogViewerClient />
      </div>
    </div>
  );
}

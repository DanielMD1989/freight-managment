/**
 * Admin Audit Logs Viewer Page
 *
 * View and filter audit logs for security monitoring
 * Sprint 10 - Story 10.5: Audit Logs Viewer
 */

import { cookies } from 'next/headers';
import { verifyToken } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AuditLogsClient from './AuditLogsClient';

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
 * Admin Audit Logs Viewer Page
 */
export default async function AdminAuditLogsPage({
  searchParams,
}: {
  searchParams: {
    offset?: string;
    limit?: string;
    severity?: string;
    eventType?: string;
    userId?: string;
    organizationId?: string;
    startDate?: string;
    endDate?: string;
  };
}) {
  // Verify authentication
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session');

  if (!sessionCookie) {
    redirect('/login?redirect=/admin/audit-logs');
  }

  const session = await verifyToken(sessionCookie.value);

  if (!session || session.role !== 'ADMIN') {
    redirect('/unauthorized');
  }

  // Get query parameters
  const offset = parseInt(searchParams.offset || '0');
  const limit = parseInt(searchParams.limit || '100');
  const filters = {
    severity: searchParams.severity,
    eventType: searchParams.eventType,
    userId: searchParams.userId,
    organizationId: searchParams.organizationId,
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
  };

  // Fetch audit logs
  const data = await getAuditLogs(offset, limit, filters);

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
          <p className="text-gray-600 mt-2">
            Security and activity monitoring
          </p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">
            Failed to load audit logs. Please try refreshing the page.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Audit Logs</h1>
        <p className="text-gray-600 mt-2">
          Security and activity monitoring ({data.total.toLocaleString()} total
          events)
        </p>
      </div>

      {/* Audit Logs Client Component */}
      <AuditLogsClient
        initialLogs={data.logs}
        total={data.total}
        limit={data.limit}
        offset={data.offset}
        initialFilters={filters}
      />
    </div>
  );
}

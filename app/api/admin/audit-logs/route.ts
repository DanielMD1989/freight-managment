/**
 * Audit Log Viewer API
 *
 * GET /api/admin/audit-logs
 *
 * View audit logs with filtering and pagination.
 *
 * Security:
 * - Admin only
 * - Supports filtering by user, organization, event type, severity, date range
 * - Pagination for large result sets
 *
 * Sprint 9 - Story 9.9: Audit Logging & Monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/rbac/permissions';
import {
  queryAuditLogs,
  getAuditLogStats,
  AuditEventType,
  AuditSeverity,
} from '@/lib/auditLog';

/**
 * GET /api/admin/audit-logs
 *
 * Query audit logs with filters.
 *
 * Query parameters:
 * - userId: Filter by user ID
 * - organizationId: Filter by organization ID
 * - eventType: Filter by event type (AUTH_LOGIN_SUCCESS, FILE_UPLOAD, etc.)
 * - severity: Filter by severity (INFO, WARNING, ERROR, CRITICAL)
 * - startDate: Filter by start date (ISO 8601)
 * - endDate: Filter by end date (ISO 8601)
 * - limit: Max results (default: 100, max: 1000)
 * - offset: Pagination offset
 *
 * Returns: { logs: [], total: number, limit: number, offset: number }
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin permission
    await requirePermission(Permission.VIEW_AUDIT_LOGS);

    const { searchParams } = new URL(request.url);

    // Parse filters
    const userId = searchParams.get('userId') || undefined;
    const organizationId = searchParams.get('organizationId') || undefined;
    const eventType = searchParams.get('eventType') as AuditEventType | undefined;
    const severity = searchParams.get('severity') as AuditSeverity | undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');
    const limit = parseInt(searchParams.get('limit') || '100', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Parse dates
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // Validate event type if provided
    if (eventType && !Object.values(AuditEventType).includes(eventType)) {
      return NextResponse.json(
        { error: 'Invalid event type' },
        { status: 400 }
      );
    }

    // Validate severity if provided
    if (severity && !Object.values(AuditSeverity).includes(severity)) {
      return NextResponse.json(
        { error: 'Invalid severity level' },
        { status: 400 }
      );
    }

    // Query audit logs
    const result = await queryAuditLogs({
      userId,
      organizationId,
      eventType,
      severity,
      startDate,
      endDate,
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Error querying audit logs:', error);

    return NextResponse.json(
      { error: 'Failed to query audit logs' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/audit-logs/stats
 *
 * Get audit log statistics.
 *
 * Query parameters:
 * - organizationId: Filter by organization
 * - startDate: Filter by start date
 * - endDate: Filter by end date
 *
 * Returns statistics about audit log events.
 */
export async function stats(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_AUDIT_LOGS);

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    const stats = await getAuditLogStats(organizationId, startDate, endDate);

    return NextResponse.json(stats);
  } catch (error: any) {
    console.error('Error getting audit log stats:', error);

    return NextResponse.json(
      { error: 'Failed to get audit log statistics' },
      { status: 500 }
    );
  }
}

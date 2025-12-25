/**
 * Audit Log Statistics API
 *
 * GET /api/admin/audit-logs/stats
 *
 * Get aggregate statistics about audit log events.
 *
 * Security: Admin only
 *
 * Sprint 9 - Story 9.9: Audit Logging & Monitoring
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/lib/auth';
import { Permission } from '@/lib/rbac/permissions';
import { getAuditLogStats } from '@/lib/auditLog';

/**
 * GET /api/admin/audit-logs/stats
 *
 * Get audit log statistics.
 *
 * Query parameters:
 * - organizationId: Filter by organization
 * - startDate: Filter by start date (ISO 8601)
 * - endDate: Filter by end date (ISO 8601)
 *
 * Returns:
 * {
 *   totalLogs: number,
 *   authFailures: number,
 *   authzFailures: number,
 *   rateLimitViolations: number,
 *   csrfViolations: number,
 *   fileUploads: number,
 *   documentVerifications: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Require admin permission
    await requirePermission(Permission.VIEW_AUDIT_LOGS);

    const { searchParams } = new URL(request.url);

    const organizationId = searchParams.get('organizationId') || undefined;
    const startDateStr = searchParams.get('startDate');
    const endDateStr = searchParams.get('endDate');

    // Parse dates
    const startDate = startDateStr ? new Date(startDateStr) : undefined;
    const endDate = endDateStr ? new Date(endDateStr) : undefined;

    // Get statistics
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

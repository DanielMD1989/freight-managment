/**
 * Support Report API
 *
 * Sprint 19 - Support Features
 *
 * Allows users to report issues, bad behavior, or submit feedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createNotificationForRole } from '@/lib/notifications';

// Request body schema for support report
const supportReportSchema = z.object({
  type: z.enum(['BUG', 'MISCONDUCT', 'FEEDBACK', 'OTHER'], {
    message: 'Invalid report type'
  }),
  subject: z.string()
    .min(3, 'Subject must be at least 3 characters')
    .max(200, 'Subject must not exceed 200 characters'),
  description: z.string()
    .min(10, 'Description must be at least 10 characters')
    .max(5000, 'Description must not exceed 5000 characters'),
  entityType: z.string().optional(),
  entityId: z.string().optional(),
});

/**
 * POST /api/support/report
 * Submit a support report or feedback
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    const body = await request.json();

    // Validate request body with Zod
    const validation = supportReportSchema.safeParse(body);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }

    const { type, subject, description, entityType, entityId } = validation.data;

    // Get user details
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        organizationId: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const reportId = `report-${Date.now()}`;

    // Create audit log entry for the report
    // Using AuditLog model fields: eventType, severity, resource, resourceId, result, message, metadata
    await db.auditLog.create({
      data: {
        userId: session.userId,
        organizationId: user.organizationId,
        eventType: 'SUPPORT_REPORT_SUBMITTED',
        severity: type === 'MISCONDUCT' ? 'WARNING' : 'INFO',
        resource: 'SUPPORT_REPORT',
        resourceId: reportId,
        action: type,
        result: 'SUCCESS',
        message: subject,
        ipAddress,
        userAgent,
        metadata: {
          reportType: type,
          subject,
          description,
          relatedEntityType: entityType || null,
          relatedEntityId: entityId || null,
          userEmail: user.email,
          userName: `${user.firstName} ${user.lastName}`,
          submittedAt: new Date().toISOString(),
        },
      },
    });

    // Notify admin/support team about new report
    await createNotificationForRole({
      role: 'ADMIN',
      type: 'SUPPORT_REPORT',
      title: `New Support Report: ${type}`,
      message: `${user.firstName} ${user.lastName} (${user.email}) submitted a ${type.toLowerCase()} report: "${subject}"`,
      metadata: { reportId, type, subject, userEmail: user.email },
    }).catch((err) => console.error('Failed to notify admins about support report:', err));

    return NextResponse.json({
      success: true,
      message: 'Report submitted successfully. Our support team will review it.',
      referenceId: `SR-${Date.now().toString(36).toUpperCase()}`,
    });
  } catch (error) {
    console.error('Failed to submit support report:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to submit report' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/support/report
 * Get user's submitted reports
 */
export async function GET() {
  try {
    const session = await requireAuth();

    // Get user's reports from audit log
    const reports = await db.auditLog.findMany({
      where: {
        userId: session.userId,
        eventType: 'SUPPORT_REPORT_SUBMITTED',
      },
      select: {
        id: true,
        resourceId: true,
        metadata: true,
        message: true,
        action: true,
      },
      orderBy: { id: 'desc' },
      take: 20,
    });

    const formattedReports = reports.map((report) => {
      const metadata = report.metadata as Record<string, unknown> | null;
      return {
        id: report.id,
        referenceId: report.resourceId,
        type: report.action || (metadata?.reportType as string),
        subject: report.message || (metadata?.subject as string),
        status: 'SUBMITTED', // In a real implementation, track status
        submittedAt: metadata?.submittedAt || null,
      };
    });

    return NextResponse.json({
      reports: formattedReports,
    });
  } catch (error) {
    console.error('Failed to get support reports:', error);

    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to retrieve reports' },
      { status: 500 }
    );
  }
}

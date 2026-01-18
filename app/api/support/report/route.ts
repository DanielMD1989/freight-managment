/**
 * Support Report API
 *
 * Sprint 19 - Support Features
 *
 * Allows users to report issues, bad behavior, or submit feedback.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

interface ReportBody {
  type: 'BUG' | 'MISCONDUCT' | 'FEEDBACK' | 'OTHER';
  subject: string;
  description: string;
  entityType?: string;
  entityId?: string;
}

/**
 * POST /api/support/report
 * Submit a support report or feedback
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const ipAddress = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
    const userAgent = request.headers.get('user-agent');

    const body = await request.json() as ReportBody;
    const { type, subject, description, entityType, entityId } = body;

    // Validate inputs
    if (!type || !subject || !description) {
      return NextResponse.json(
        { error: 'Type, subject, and description are required' },
        { status: 400 }
      );
    }

    // Validate type
    const validTypes = ['BUG', 'MISCONDUCT', 'FEEDBACK', 'OTHER'];
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid report type' },
        { status: 400 }
      );
    }

    // Validate subject and description length
    if (subject.length < 3 || subject.length > 200) {
      return NextResponse.json(
        { error: 'Subject must be between 3 and 200 characters' },
        { status: 400 }
      );
    }

    if (description.length < 10 || description.length > 5000) {
      return NextResponse.json(
        { error: 'Description must be between 10 and 5000 characters' },
        { status: 400 }
      );
    }

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

    // TODO: In production, send notification to support team
    console.log(`[SUPPORT REPORT] New ${type} report from ${user.email}: ${subject}`);

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

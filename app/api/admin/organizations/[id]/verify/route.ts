/**
 * Organization Verification API
 *
 * Sprint 16 - Story 16.5: Trust & Reliability Features
 *
 * Allows admins to verify/unverify organizations
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { writeAuditLog, AuditEventType, AuditSeverity } from '@/lib/auditLog';
// M7 FIX: Add CSRF validation
import { validateCSRFWithMobile } from '@/lib/csrf';

/**
 * POST /api/admin/organizations/[id]/verify
 *
 * Verify an organization (admin only)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // M7 FIX: Add CSRF validation
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: orgId } = await params;
    const session = await requireAuth();

    // Only admins can verify organizations
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Check if organization exists
    const organization = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        isVerified: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if already verified
    if (organization.isVerified) {
      return NextResponse.json(
        { error: 'Organization is already verified' },
        { status: 400 }
      );
    }

    // Verify the organization
    const updatedOrg = await db.organization.update({
      where: { id: orgId },
      data: {
        isVerified: true,
        verifiedAt: new Date(),
      },
    });

    // Create audit log entry
    await writeAuditLog({
      eventType: AuditEventType.ORG_VERIFIED,
      severity: AuditSeverity.INFO,
      userId: session.userId,
      organizationId: orgId,
      resource: 'organization',
      resourceId: orgId,
      action: 'VERIFY',
      result: 'SUCCESS',
      message: `Organization verified: ${organization.name}`,
      metadata: { organizationName: organization.name },
      timestamp: new Date(),
    });

    return NextResponse.json({
      message: 'Organization verified successfully',
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        isVerified: updatedOrg.isVerified,
        verifiedAt: updatedOrg.verifiedAt,
      },
    });
  } catch (error) {
    console.error('Verify organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/organizations/[id]/verify
 *
 * Remove verification from an organization (admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // M7 FIX: Add CSRF validation
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const { id: orgId } = await params;
    const session = await requireAuth();

    // Only admins can unverify organizations
    if (session.role !== 'ADMIN' && session.role !== 'SUPER_ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      );
    }

    // Check if organization exists
    const organization = await db.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        isVerified: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    // Check if not verified
    if (!organization.isVerified) {
      return NextResponse.json(
        { error: 'Organization is not verified' },
        { status: 400 }
      );
    }

    // Remove verification
    const updatedOrg = await db.organization.update({
      where: { id: orgId },
      data: {
        isVerified: false,
        verifiedAt: null,
      },
    });

    // Create audit log entry
    await writeAuditLog({
      eventType: AuditEventType.ORG_VERIFIED,
      severity: AuditSeverity.INFO,
      userId: session.userId,
      organizationId: orgId,
      resource: 'organization',
      resourceId: orgId,
      action: 'UNVERIFY',
      result: 'SUCCESS',
      message: `Organization verification removed: ${organization.name}`,
      metadata: { organizationName: organization.name },
      timestamp: new Date(),
    });

    return NextResponse.json({
      message: 'Organization verification removed',
      organization: {
        id: updatedOrg.id,
        name: updatedOrg.name,
        isVerified: updatedOrg.isVerified,
        verifiedAt: updatedOrg.verifiedAt,
      },
    });
  } catch (error) {
    console.error('Unverify organization error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

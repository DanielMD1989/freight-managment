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
    const { id: orgId } = await params;
    const session = await requireAuth();

    // Only admins can verify organizations
    if (session.role !== 'ADMIN' && session.role !== 'PLATFORM_OPS') {
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

    // TODO: Create audit log entry
    // await db.auditLog.create({
    //   data: {
    //     userId: session.userId,
    //     action: 'VERIFY_ORGANIZATION',
    //     entityType: 'ORGANIZATION',
    //     entityId: orgId,
    //     description: `Verified organization: ${organization.name}`,
    //   },
    // });

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
    const { id: orgId } = await params;
    const session = await requireAuth();

    // Only admins can unverify organizations
    if (session.role !== 'ADMIN' && session.role !== 'PLATFORM_OPS') {
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

    // TODO: Create audit log entry
    // await db.auditLog.create({
    //   data: {
    //     userId: session.userId,
    //     action: 'UNVERIFY_ORGANIZATION',
    //     entityType: 'ORGANIZATION',
    //     entityId: orgId,
    //     description: `Removed verification from organization: ${organization.name}`,
    //   },
    // });

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

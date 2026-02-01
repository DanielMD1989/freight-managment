/**
 * Organization Invitations API
 *
 * Phase 2 - Story 16.9B: Company Admin Tools
 * Task 16.9B.1: Company User Management
 *
 * POST /api/organizations/invitations - Create invitation
 * GET /api/organizations/invitations - List invitations
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const createInvitationSchema = z.object({
  email: z.string().email(),
  role: z.enum(['CARRIER', 'SHIPPER', 'DISPATCHER']),
  organizationId: z.string(),
});

/**
 * POST /api/organizations/invitations
 * Create a new invitation to join the organization
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    const body = await request.json();
    const data = createInvitationSchema.parse(body);

    // Verify user belongs to the organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    if (!user?.organizationId || user.organizationId !== data.organizationId) {
      return NextResponse.json(
        { error: 'You can only invite members to your own organization' },
        { status: 403 }
      );
    }

    // Check if email is already a member
    const existingMember = await db.user.findFirst({
      where: {
        email: data.email,
        organizationId: data.organizationId,
      },
    });

    if (existingMember) {
      return NextResponse.json(
        { error: 'This email is already a member of your organization' },
        { status: 400 }
      );
    }

    // Check for existing pending invitation
    const existingInvitation = await db.invitation.findFirst({
      where: {
        email: data.email,
        organizationId: data.organizationId,
        status: 'PENDING',
        expiresAt: { gt: new Date() },
      },
    });

    if (existingInvitation) {
      return NextResponse.json(
        { error: 'A pending invitation already exists for this email' },
        { status: 400 }
      );
    }

    // Create invitation (expires in 7 days)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    const invitation = await db.invitation.create({
      data: {
        email: data.email,
        role: data.role as any,
        organizationId: data.organizationId,
        invitedById: session.userId,
        expiresAt,
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        expiresAt: true,
      },
    });

    // TODO: Send invitation email with link containing token

    return NextResponse.json({
      message: 'Invitation sent successfully',
      invitation,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Create invitation error:', error);
    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/organizations/invitations
 * List all invitations for the user's organization
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Get user's organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user?.organizationId) {
      return NextResponse.json(
        { error: 'User not associated with an organization' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: any = {
      organizationId: user.organizationId,
    };

    if (status) {
      where.status = status;
    }

    const invitations = await db.invitation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
        expiresAt: true,
        acceptedAt: true,
      },
    });

    return NextResponse.json({ invitations });
  } catch (error) {
    console.error('List invitations error:', error);
    return NextResponse.json(
      { error: 'Failed to list invitations' },
      { status: 500 }
    );
  }
}

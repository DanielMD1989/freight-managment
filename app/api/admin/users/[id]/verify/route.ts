/**
 * Sprint 2: User Verification Workflow
 * API endpoint for admin to verify/approve/reject/suspend user accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, Permission } from '@/lib/rbac';
import { z } from 'zod';

const verifyUserSchema = z.object({
  status: z.enum(['PENDING_VERIFICATION', 'ACTIVE', 'SUSPENDED', 'REJECTED']),
  reason: z.string().optional(), // Optional reason for suspension/rejection
});

// POST /api/admin/users/[id]/verify - Update user verification status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Only ADMIN and SUPER_ADMIN can verify users
    await requirePermission(Permission.VERIFY_DOCUMENTS);

    const body = await request.json();
    const { status, reason } = verifyUserSchema.parse(body);

    const { id: userId } = await params;

    // Get current user
    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Update user status
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: { status },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Log the verification action
    console.log(`User ${userId} status updated: ${user.status} → ${status}`, {
      userId,
      previousStatus: user.status,
      newStatus: status,
      reason,
      timestamp: new Date().toISOString(),
    });

    // TODO: Send notification to user about status change
    // TODO: Send email notification

    return NextResponse.json({
      message: `User status updated to ${status}`,
      user: updatedUser,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('User verification error:', error);
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    );
  }
}

/**
 * Sprint 2: User Verification Workflow
 * API endpoint for admin to verify/approve/reject/suspend user accounts
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requirePermission, Permission } from '@/lib/rbac';
import { z } from 'zod';
import { notifyUserVerification } from '@/lib/notifications';
import { zodErrorResponse } from '@/lib/validation';
import { sendEmail, createEmailHTML } from '@/lib/email';

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

    // Send in-app notification about status change
    const isApproved = status === 'ACTIVE';
    await notifyUserVerification({
      userId,
      verified: isApproved,
      reason: reason || (status === 'SUSPENDED' ? 'Account suspended by admin' : status === 'REJECTED' ? 'Account rejected by admin' : undefined),
    });

    // Send email notification
    if (user.email) {
      const statusLabel = status === 'ACTIVE' ? 'Approved' : status === 'SUSPENDED' ? 'Suspended' : status === 'REJECTED' ? 'Rejected' : status;
      const statusBadgeClass = isApproved ? 'status-approved' : 'status-rejected';
      const emailContent = `
        <h1>Account Status Update</h1>
        <p>Dear ${user.firstName || 'User'},</p>
        <p>Your account status has been updated.</p>
        <div class="status-badge ${statusBadgeClass}">${statusLabel.toUpperCase()}</div>
        ${reason ? `<div class="info-section" style="border-left-color: #ef4444;"><p><strong>Reason:</strong> ${reason}</p></div>` : ''}
        ${isApproved ? '<p>You now have full access to the FreightET platform.</p>' : '<p>If you have questions, please contact our support team.</p>'}
        <a href="${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/login" class="button">
          Go to Platform
        </a>
      `;
      sendEmail({
        to: user.email,
        subject: `Account ${statusLabel} - FreightET`,
        html: createEmailHTML(emailContent),
        text: `Your FreightET account status has been updated to: ${statusLabel}.${reason ? ` Reason: ${reason}` : ''}`,
      }).catch((err) => console.error('Failed to send user verification email:', err));
    }

    return NextResponse.json({
      message: `User status updated to ${status}`,
      user: updatedUser,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    console.error('User verification error:', error);
    return NextResponse.json(
      { error: 'Failed to update user status' },
      { status: 500 }
    );
  }
}

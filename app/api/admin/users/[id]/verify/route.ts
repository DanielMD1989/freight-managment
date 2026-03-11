/**
 * Sprint 2: User Verification Workflow
 * API endpoint for admin to verify/approve/reject/suspend user accounts
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revokeAllSessions } from "@/lib/auth";
import { requirePermission, Permission } from "@/lib/rbac";
import { z } from "zod";
import { notifyUserVerification } from "@/lib/notifications";
import { handleApiError } from "@/lib/apiErrors";
import { sendEmail, createEmailHTML } from "@/lib/email";
// CSRF FIX: Add CSRF validation
import { validateCSRFWithMobile } from "@/lib/csrf";
import { zodErrorResponse } from "@/lib/validation";
// G-A17-4: Cache invalidation after status change
import { CacheInvalidation } from "@/lib/cache";

const verifyUserSchema = z
  .object({
    status: z.enum(["PENDING_VERIFICATION", "ACTIVE", "SUSPENDED", "REJECTED"]),
    reason: z.string().optional(), // Required for REJECTED; optional otherwise
  })
  .superRefine((data, ctx) => {
    if (data.status === "REJECTED" && !data.reason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Reason is required when rejecting a user",
        path: ["reason"],
      });
    }
  });

// POST /api/admin/users/[id]/verify - Update user verification status
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF FIX: Validate CSRF token
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Only ADMIN and SUPER_ADMIN can verify users
    await requirePermission(Permission.VERIFY_DOCUMENTS);

    const body = await request.json();
    const parsed = verifyUserSchema.safeParse(body);
    if (!parsed.success) {
      return zodErrorResponse(parsed.error);
    }
    const { status, reason } = parsed.data;

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
      return NextResponse.json({ error: "User not found" }, { status: 404 });
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

    // G-A17-4: Invalidate status cache so change takes effect immediately
    await CacheInvalidation.user(userId);

    // G-M3-3: Revoke all sessions when rejecting a user so existing JWTs are invalidated
    if (status === "REJECTED") {
      await revokeAllSessions(userId);
    }

    // G-A2-4: When rejecting a user, sync org to REJECTED if not already APPROVED
    if (status === "REJECTED") {
      const userWithOrg = await db.user.findUnique({
        where: { id: userId },
        select: {
          organization: { select: { id: true, verificationStatus: true } },
        },
      });
      if (
        userWithOrg?.organization &&
        userWithOrg.organization.verificationStatus !== "APPROVED"
      ) {
        await db.organization.update({
          where: { id: userWithOrg.organization.id },
          data: {
            verificationStatus: "REJECTED",
            rejectionReason: reason || "Account rejected by admin",
            rejectedAt: new Date(),
            isVerified: false,
            documentsLockedAt: null,
          },
        });
      }
    }

    // Send in-app notification about status change
    const isApproved = status === "ACTIVE";
    await notifyUserVerification({
      userId,
      verified: isApproved,
      reason:
        reason ||
        (status === "SUSPENDED"
          ? "Account suspended by admin"
          : status === "REJECTED"
            ? "Account rejected by admin"
            : undefined),
    });

    // Send email notification
    if (user.email) {
      const statusLabel =
        status === "ACTIVE"
          ? "Approved"
          : status === "SUSPENDED"
            ? "Suspended"
            : status === "REJECTED"
              ? "Rejected"
              : status;
      const statusBadgeClass = isApproved
        ? "status-approved"
        : "status-rejected";
      const emailContent = `
        <h1>Account Status Update</h1>
        <p>Dear ${user.firstName || "User"},</p>
        <p>Your account status has been updated.</p>
        <div class="status-badge ${statusBadgeClass}">${statusLabel.toUpperCase()}</div>
        ${reason ? `<div class="info-section" style="border-left-color: #ef4444;"><p><strong>Reason:</strong> ${reason}</p></div>` : ""}
        ${isApproved ? "<p>You now have full access to the FreightET platform.</p>" : "<p>If you have questions, please contact our support team.</p>"}
        <a href="${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/login" class="button">
          Go to Platform
        </a>
      `;
      sendEmail({
        to: user.email,
        subject: `Account ${statusLabel} - FreightET`,
        html: createEmailHTML(emailContent),
        text: `Your FreightET account status has been updated to: ${statusLabel}.${reason ? ` Reason: ${reason}` : ""}`,
      }).catch((err) =>
        console.error("Failed to send user verification email:", err)
      );
    }

    return NextResponse.json({
      message: `User status updated to ${status}`,
      user: updatedUser,
    });
  } catch (error) {
    return handleApiError(error, "User verification error");
  }
}

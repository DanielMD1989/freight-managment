export const dynamic = "force-dynamic";
/**
 * Account Deletion API — §14 Settings
 *
 * DELETE /api/user/account
 *
 * Soft-deletes the user account: sets status to SUSPENDED, records
 * revocation reason, revokes all sessions. Admin can restore later.
 * Requires password confirmation.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { db } from "@/lib/db";
import { handleApiError } from "@/lib/apiErrors";
import bcrypt from "bcryptjs";

const deleteAccountSchema = z.object({
  password: z.string().min(1, "Password is required"),
  reason: z.string().max(500, "Reason cannot exceed 500 characters").optional(),
});

export async function DELETE(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();

    const body = await request.json();
    const parsed = deleteAccountSchema.safeParse(body);
    if (!parsed.success) {
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(parsed.error);
    }
    const { password, reason } = parsed.data;

    // Admin/SuperAdmin cannot self-delete (platform integrity)
    if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
      return NextResponse.json(
        {
          error:
            "Admin accounts cannot be self-deleted. Contact a Super Admin.",
        },
        { status: 403 }
      );
    }

    // Verify password
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { id: true, passwordHash: true, status: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const passwordValid = await bcrypt.compare(password, user.passwordHash);
    if (!passwordValid) {
      return NextResponse.json(
        { error: "Incorrect password" },
        { status: 400 }
      );
    }

    // Soft-delete: suspend account + revoke all sessions
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: session.userId },
        data: {
          status: "SUSPENDED",
          isActive: false,
          revokedAt: new Date(),
          revocationReason: reason
            ? `User requested deletion: ${reason}`
            : "User requested account deletion",
        },
      });

      // Revoke all sessions
      await tx.session.updateMany({
        where: { userId: session.userId },
        data: { revokedAt: new Date() },
      });
    });

    return NextResponse.json({
      success: true,
      message:
        "Your account has been deactivated. Contact support within 30 days if you wish to restore it.",
    });
  } catch (error) {
    return handleApiError(error, "DELETE /api/user/account");
  }
}

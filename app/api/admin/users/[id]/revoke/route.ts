/**
 * POST /api/admin/users/[id]/revoke
 *
 * G-A17-1: Dedicated revoke-access endpoint (Blueprint §9/§10).
 * G-A17-5: SuperAdmin-only path for Admin targets enforced via canManageUser().
 *
 * Actions on revocation:
 *  1. Sets user.status = SUSPENDED, revokedAt, revocationReason
 *  2. Calls revokeAllSessions() — terminates all active sessions immediately
 *  3. Calls CacheInvalidation.user() — clears requireActiveUser() cache
 *  4. Sends in-app notification to the revoked user
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser, revokeAllSessions } from "@/lib/auth";
import { Permission } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac/permissions";
import { z } from "zod";
import { UserRole } from "@prisma/client";
import { handleApiError } from "@/lib/apiErrors";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { CacheInvalidation } from "@/lib/cache";
import { createNotification } from "@/lib/notifications";

// Roles that Admin cannot manage (only SuperAdmin can)
const ADMIN_PROTECTED_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

function canManageUser(
  currentUserRole: string,
  targetUserRole: UserRole
): { allowed: boolean; error?: string } {
  if (currentUserRole === "SUPER_ADMIN") return { allowed: true };

  if (currentUserRole === "ADMIN") {
    if (ADMIN_PROTECTED_ROLES.includes(targetUserRole)) {
      return {
        allowed: false,
        error: "Admin cannot revoke access for Admin or SuperAdmin users",
      };
    }
    return { allowed: true };
  }

  return {
    allowed: false,
    error: "You do not have permission to revoke user access",
  };
}

const revokeSchema = z.object({
  reason: z.string().min(10).max(500),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "admin-users",
      ip,
      RPS_CONFIGS.write.rps,
      RPS_CONFIGS.write.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { id: targetUserId } = await params;

    // Permission check
    if (
      !hasPermission(
        session.role as UserRole,
        Permission.ACTIVATE_DEACTIVATE_USERS
      )
    ) {
      return NextResponse.json(
        { error: "You do not have permission to revoke user access" },
        { status: 403 }
      );
    }

    // Cannot self-revoke
    if (targetUserId === session.userId) {
      return NextResponse.json(
        { error: "You cannot revoke your own access" },
        { status: 400 }
      );
    }

    // Parse body
    const body = await request.json();
    const parsed = revokeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation error", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const { reason } = parsed.data;

    // Fetch target user
    const targetUser = await db.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, status: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Hierarchy guard
    const manageCheck = canManageUser(
      session.role,
      targetUser.role as UserRole
    );
    if (!manageCheck.allowed) {
      return NextResponse.json({ error: manageCheck.error }, { status: 403 });
    }

    // Reject if already suspended
    if (targetUser.status === "SUSPENDED") {
      return NextResponse.json(
        { error: "User access is already revoked" },
        { status: 409 }
      );
    }

    const revokedAt = new Date();

    // 1. Persist revocation
    await db.user.update({
      where: { id: targetUserId },
      data: {
        status: "SUSPENDED",
        revokedAt,
        revocationReason: reason,
      },
    });

    // 2. Terminate all active sessions immediately
    await revokeAllSessions(targetUserId);

    // 3. Clear requireActiveUser() cache
    await CacheInvalidation.user(targetUserId);

    // 4. Notify the revoked user
    await createNotification({
      userId: targetUserId,
      type: "USER_STATUS_CHANGED",
      title: "Account Access Revoked",
      message: `Your platform access has been revoked. Reason: ${reason}`,
      metadata: { reason, revokedAt: revokedAt.toISOString() },
      skipPreferenceCheck: true,
    });

    return NextResponse.json({
      message: "Access revoked",
      userId: targetUserId,
      revokedAt,
    });
  } catch (error) {
    return handleApiError(error, "Revoke access error");
  }
}

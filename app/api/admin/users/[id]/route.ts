/**
 * Admin User Management API
 *
 * Individual user management endpoints for Admin/SuperAdmin.
 *
 * GET /api/admin/users/[id] - Get user details
 * PATCH /api/admin/users/[id] - Update user (phone, status, etc.)
 * DELETE /api/admin/users/[id] - Delete user
 *
 * Permission enforcement per PRD:
 * - Admin: Can manage Carrier/Shipper/Dispatcher only
 * - SuperAdmin: Can manage any user including Admin
 * - Phone change: Only Admin/SuperAdmin (users cannot change own)
 *
 * L8 FIX: KNOWN LIMITATION - Audit logging not persisted to database.
 * Production implementation should:
 * 1. Use writeAuditLog() from lib/auditLog to persist changes
 * 2. Log: userId, action type, target user, changes, timestamp
 * 3. Implement proper audit trail for compliance
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { Permission } from "@/lib/rbac";
import { hasPermission } from "@/lib/rbac/permissions";
import { z } from "zod";
import { UserRole, UserStatus } from "@prisma/client";
import { handleApiError } from "@/lib/apiErrors";
// CSRF FIX: Add CSRF validation
import { validateCSRFWithMobile } from "@/lib/csrf";
// H2-H6, M12 FIX: Import types for proper typing
import type { UserUpdateData } from "@/lib/types/admin";

// Roles that Admin cannot manage (only SuperAdmin can)
const ADMIN_PROTECTED_ROLES: UserRole[] = ["ADMIN", "SUPER_ADMIN"];

// Roles that Admin can manage

const updateUserSchema = z.object({
  phone: z.string().min(10).max(20).optional(),
  status: z
    .enum([
      "REGISTERED",
      "PENDING_VERIFICATION",
      "ACTIVE",
      "SUSPENDED",
      "REJECTED",
    ])
    .optional(),
  isActive: z.boolean().optional(), // Legacy field
  reason: z.string().max(500).optional(), // Reason for status change
});

/**
 * Check if the current user can manage the target user
 */
function canManageUser(
  currentUserRole: string,
  targetUserRole: UserRole
): { allowed: boolean; error?: string } {
  // SuperAdmin can manage anyone
  if (currentUserRole === "SUPER_ADMIN") {
    return { allowed: true };
  }

  // Admin can only manage operational roles (Carrier, Shipper, Dispatcher)
  if (currentUserRole === "ADMIN") {
    if (ADMIN_PROTECTED_ROLES.includes(targetUserRole)) {
      return {
        allowed: false,
        error: "Admin cannot modify Admin or SuperAdmin users",
      };
    }
    return { allowed: true };
  }

  // Other roles cannot manage users
  return {
    allowed: false,
    error: "You do not have permission to manage users",
  };
}

/**
 * GET /api/admin/users/[id]
 * Get detailed user information
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireActiveUser();
    const { id: userId } = await params;

    // H2 FIX: Cast to UserRole instead of any
    // Check view permission
    const userRole = session.role as UserRole;
    const canView =
      hasPermission(userRole, Permission.VIEW_USERS) ||
      hasPermission(userRole, Permission.VIEW_ALL_USERS);

    if (!canView) {
      return NextResponse.json(
        { error: "You do not have permission to view users" },
        { status: 403 }
      );
    }

    const user = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        isEmailVerified: true,
        isPhoneVerified: true,
        organizationId: true,
        organization: {
          select: {
            id: true,
            name: true,
            type: true,
            isVerified: true,
          },
        },
        createdAt: true,
        updatedAt: true,
        lastLoginAt: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Admin cannot view SuperAdmin/Admin details (only SuperAdmin can)
    if (
      session.role === "ADMIN" &&
      ADMIN_PROTECTED_ROLES.includes(user.role as UserRole)
    ) {
      return NextResponse.json(
        { error: "You do not have permission to view this user" },
        { status: 403 }
      );
    }

    return NextResponse.json({ user });
  } catch (error) {
    return handleApiError(error, "Get user error");
  }
}

/**
 * PATCH /api/admin/users/[id]
 * Update user details (phone, status)
 *
 * Phone change rules:
 * - Users cannot change their own phone (no self-service)
 * - Admin can change phone for Carrier/Shipper/Dispatcher
 * - SuperAdmin can change phone for anyone
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF FIX: Validate CSRF token
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { id: userId } = await params;

    // Get target user
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if current user can manage target user
    const manageCheck = canManageUser(
      session.role,
      targetUser.role as UserRole
    );
    if (!manageCheck.allowed) {
      return NextResponse.json({ error: manageCheck.error }, { status: 403 });
    }

    // Parse and validate request body
    const body = await request.json();
    const validatedData = updateUserSchema.parse(body);

    // H4 FIX: Use typed update data instead of any
    const updateData: UserUpdateData = {};
    const changes: string[] = [];

    // M12 FIX: Store role as UserRole for proper typing
    const sessionRole = session.role as UserRole;

    // Phone change
    if (validatedData.phone !== undefined) {
      // Check CHANGE_USER_PHONE permission
      if (!hasPermission(sessionRole, Permission.CHANGE_USER_PHONE)) {
        return NextResponse.json(
          { error: "You do not have permission to change user phone numbers" },
          { status: 403 }
        );
      }

      // Prevent changing own phone
      if (userId === session.userId) {
        return NextResponse.json(
          {
            error:
              "You cannot change your own phone number. Contact a supervisor.",
          },
          { status: 403 }
        );
      }

      updateData.phone = validatedData.phone;
      updateData.isPhoneVerified = false; // Reset verification on phone change
      changes.push(
        `phone: ${targetUser.phone || "none"} → ${validatedData.phone}`
      );
    }

    // Status change
    if (validatedData.status !== undefined) {
      // Check ACTIVATE_DEACTIVATE_USERS permission
      if (!hasPermission(sessionRole, Permission.ACTIVATE_DEACTIVATE_USERS)) {
        return NextResponse.json(
          { error: "You do not have permission to change user status" },
          { status: 403 }
        );
      }

      updateData.status = validatedData.status as UserStatus;
      changes.push(`status: ${targetUser.status} → ${validatedData.status}`);
    }

    // Legacy isActive field
    if (validatedData.isActive !== undefined) {
      updateData.isActive = validatedData.isActive;
      changes.push(`isActive: ${validatedData.isActive}`);
    }

    // Check if there's anything to update
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    // Perform update
    const updatedUser = await db.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        isActive: true,
        isPhoneVerified: true,
        updatedAt: true,
      },
    });

    // Log the action
    return NextResponse.json({
      message: "User updated successfully",
      user: updatedUser,
      changes,
    });
  } catch (error) {
    return handleApiError(error, "Update user error");
  }
}

/**
 * DELETE /api/admin/users/[id]
 * Delete a user
 *
 * Delete rules:
 * - Admin can delete Carrier/Shipper/Dispatcher (DELETE_NON_ADMIN_USERS)
 * - SuperAdmin can delete Admin (DELETE_ADMIN) and all others
 * - Cannot delete yourself
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // CSRF FIX: Validate CSRF token
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { id: userId } = await params;

    // Cannot delete yourself
    if (userId === session.userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account" },
        { status: 403 }
      );
    }

    // Get target user
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check delete permissions based on target role
    const targetRole = targetUser.role as UserRole;

    if (ADMIN_PROTECTED_ROLES.includes(targetRole)) {
      // Deleting Admin/SuperAdmin requires DELETE_ADMIN permission
      if (!hasPermission(session.role as UserRole, Permission.DELETE_ADMIN)) {
        return NextResponse.json(
          { error: "Only SuperAdmin can delete Admin users" },
          { status: 403 }
        );
      }
    } else {
      // Deleting operational roles requires DELETE_NON_ADMIN_USERS permission
      if (
        !hasPermission(
          session.role as UserRole,
          Permission.DELETE_NON_ADMIN_USERS
        )
      ) {
        return NextResponse.json(
          { error: "You do not have permission to delete users" },
          { status: 403 }
        );
      }
    }

    // Perform soft delete (set isActive to false and status to SUSPENDED)
    // Or hard delete - depending on business requirements
    // For now, we'll do a soft delete for audit trail
    const deletedUser = await db.user.update({
      where: { id: userId },
      data: {
        isActive: false,
        status: "SUSPENDED",
        // Optionally anonymize: email: `deleted_${userId}@deleted.local`
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
      },
    });

    // Log the deletion
    return NextResponse.json({
      message: "User deleted successfully",
      user: deletedUser,
    });
  } catch (error) {
    return handleApiError(error, "Delete user error");
  }
}

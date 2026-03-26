import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma, UserRole } from "@prisma/client";
import { requirePermission, Permission } from "@/lib/rbac";
import { hashPassword, revokeAllSessions } from "@/lib/auth";
import { CacheInvalidation } from "@/lib/cache";
import { writeAuditLog, AuditEventType, AuditSeverity } from "@/lib/auditLog";
import { z } from "zod";
import { zodErrorResponse } from "@/lib/validation";
// M1 FIX: Add CSRF validation
import { validateCSRFWithMobile } from "@/lib/csrf";

// GET /api/admin/users - List all users
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_USERS);

    const { searchParams } = request.nextUrl;
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");
    const role = searchParams.get("role");
    const search = searchParams.get("search");

    // H1 FIX: Use typed Prisma where input instead of any
    const where: Prisma.UserWhereInput = {};

    // H14 FIX: Validate role against UserRole enum
    if (role && Object.values(UserRole).includes(role as UserRole)) {
      where.role = role as UserRole;
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: "insensitive" } },
        { firstName: { contains: search, mode: "insensitive" } },
        { lastName: { contains: search, mode: "insensitive" } },
      ];
    }

    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          email: true,
          phone: true,
          firstName: true,
          lastName: true,
          role: true,
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
          lastLoginAt: true,
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: {
          createdAt: "desc",
        },
      }),
      db.user.count({ where }),
    ]);

    return NextResponse.json({
      users,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    // L6 FIX: Server-side logging intentional for debugging - errors not exposed to client
    console.error("List users error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// G-SA1-1: POST /api/admin/users - Create admin user (SUPER_ADMIN only)
const createAdminSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().min(10).max(20).optional(),
  password: z.string().min(8).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requirePermission(Permission.CREATE_ADMIN);

    const body = await request.json();
    const data = createAdminSchema.parse(body);

    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email: data.email },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await hashPassword(data.password);

    const user = await db.user.create({
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || null,
        passwordHash,
        role: "ADMIN",
        status: "ACTIVE",
        isActive: true,
        isEmailVerified: true,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
    });

    await writeAuditLog({
      eventType: AuditEventType.ADMIN_ACTION,
      severity: AuditSeverity.WARNING,
      userId: session.userId,
      resource: "user",
      resourceId: user.id,
      action: "ADMIN_CREATED",
      result: "SUCCESS",
      message: `SuperAdmin ${session.userId} created admin account ${user.email}`,
      metadata: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: "ADMIN",
      },
      timestamp: new Date(),
    }).catch((err) => console.error("Audit log failed:", err));

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    console.error("Create admin error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// §10 V1 FIX: SUPER_ADMIN removed — blueprint only authorizes creating ADMIN accounts
const updateUserSchema = z.object({
  userId: z.string(),
  role: z.enum(["SHIPPER", "CARRIER", "DISPATCHER", "ADMIN"]),
});

// PATCH /api/admin/users - Update user role
export async function PATCH(request: NextRequest) {
  try {
    // M1 FIX: Add CSRF validation
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requirePermission(Permission.ASSIGN_ROLES);

    const body = await request.json();
    const { userId, role } = updateUserSchema.parse(body);

    // G-SA1-2: Cannot change your own role (prevents self-demotion)
    if (userId === session.userId) {
      return NextResponse.json(
        { error: "You cannot change your own role" },
        { status: 403 }
      );
    }

    // §10 V1 FIX: Fetch target user to validate role transition
    const targetUser = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Cannot demote a SUPER_ADMIN via this endpoint (only system seed creates SUPER_ADMIN)
    if (targetUser.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Cannot change the role of a Super Admin account" },
        { status: 403 }
      );
    }

    const user = await db.user.update({
      where: { id: userId },
      data: { role },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    // §10 B2 FIX: Revoke all sessions after role change so the user's JWT
    // (which embeds the old role) is invalidated immediately.
    await revokeAllSessions(userId);
    await CacheInvalidation.user(userId);

    // Audit log for role change
    await writeAuditLog({
      eventType: AuditEventType.ADMIN_ACTION,
      severity: AuditSeverity.WARNING,
      userId: session.userId,
      resource: "user",
      resourceId: userId,
      action: "ROLE_CHANGED",
      result: "SUCCESS",
      message: `SuperAdmin ${session.userId} changed user ${user.email} role from ${targetUser.role} to ${role}`,
      metadata: {
        targetUserId: userId,
        previousRole: targetUser.role,
        newRole: role,
      },
      timestamp: new Date(),
    }).catch((err) => console.error("Audit log failed:", err));

    return NextResponse.json({
      message: "User role updated successfully",
      user,
    });
  } catch (error) {
    console.error("Update user role error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (
      error instanceof Error &&
      (error.message === "Unauthorized" ||
        error.message.startsWith("Forbidden:"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

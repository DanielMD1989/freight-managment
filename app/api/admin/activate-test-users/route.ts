/**
 * Activate Test Users API
 *
 * POST /api/admin/activate-test-users
 *
 * Updates all test users to ACTIVE status
 * Admin only endpoint
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
// M4 FIX: Add CSRF validation
import { validateCSRFWithMobile } from "@/lib/csrf";

export async function POST(request: NextRequest) {
  try {
    // M4 FIX: Add CSRF validation
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Require admin authentication
    const session = await requireAuth();
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Update all test users to ACTIVE status
    const result = await db.user.updateMany({
      where: {
        email: {
          contains: "testfreightet.com",
        },
      },
      data: {
        status: "ACTIVE",
      },
    });

    // Get updated users
    const users = await db.user.findMany({
      where: {
        email: {
          contains: "testfreightet.com",
        },
      },
      select: {
        email: true,
        status: true,
        role: true,
      },
    });

    return NextResponse.json({
      message: `Updated ${result.count} test users to ACTIVE status`,
      users,
    });
    // H7 FIX: Use unknown type with type guard
  } catch (error: unknown) {
    console.error("Error activating test users:", error);
    return NextResponse.json(
      { error: "Failed to activate test users" },
      { status: 500 }
    );
  }
}

// Also support GET for convenience (admin only)
export async function GET(request: NextRequest) {
  try {
    // Require admin authentication
    const session = await requireAuth();
    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Admin access required" },
        { status: 403 }
      );
    }

    // Get test users status
    const users = await db.user.findMany({
      where: {
        email: {
          contains: "testfreightet.com",
        },
      },
      select: {
        email: true,
        status: true,
        role: true,
      },
    });

    return NextResponse.json({ users });
    // H7 FIX: Use unknown type with type guard
  } catch (error: unknown) {
    console.error("Error fetching test users:", error);
    return NextResponse.json(
      { error: "Failed to fetch test users" },
      { status: 500 }
    );
  }
}

/**
 * Admin Withdrawal Approval/Rejection API
 *
 * PATCH /api/admin/withdrawals/[id] — Approve or reject a withdrawal request
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";

const updateSchema = z.object({
  action: z.enum(["APPROVED", "REJECTED"]),
  rejectionReason: z.string().max(500).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireAuth();

    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { action, rejectionReason } = parsed.data;

    // Get current withdrawal request
    const existing = await db.withdrawalRequest.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { error: "Withdrawal request not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "PENDING") {
      return NextResponse.json(
        { error: `Cannot update a ${existing.status} withdrawal request` },
        { status: 400 }
      );
    }

    const updated = await db.withdrawalRequest.update({
      where: { id },
      data: {
        status: action,
        approvedById: session.userId,
        approvedAt: new Date(),
        rejectionReason: action === "REJECTED" ? rejectionReason : null,
        completedAt: action === "APPROVED" ? new Date() : null,
      },
    });

    return NextResponse.json({
      message: `Withdrawal request ${action.toLowerCase()}`,
      withdrawalRequest: updated,
    });
  } catch (error) {
    console.error("Admin withdrawal update error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

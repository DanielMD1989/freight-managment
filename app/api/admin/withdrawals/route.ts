/**
 * Admin Withdrawal Management API
 *
 * GET /api/admin/withdrawals — List all withdrawal requests (admin only)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Prisma } from "@prisma/client";
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";

export async function GET(request: NextRequest) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      "admin-withdrawals",
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

    const session = await requireAuth();

    if (session.role !== "ADMIN" && session.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(
      parseInt(searchParams.get("limit") || "20", 10),
      100
    );

    const where: Prisma.WithdrawalRequestWhereInput = {};
    if (status) where.status = status;

    const [withdrawals, total] = await Promise.all([
      db.withdrawalRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      db.withdrawalRequest.count({ where }),
    ]);

    return NextResponse.json({
      withdrawals,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error("Admin withdrawals list error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

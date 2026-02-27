/**
 * Settlement Review API
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.4: Global Settlement Review Dashboard
 *
 * Provides detailed settlement data for SuperAdmin review
 */

import { NextRequest, NextResponse } from "next/server";
import { requirePermission, Permission } from "@/lib/rbac";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

/**
 * GET /api/admin/settlements
 *
 * Fetch loads for settlement review
 *
 * Query parameters:
 * - status: 'PENDING' | 'PAID' | 'DISPUTE' | 'all' (default: 'PENDING')
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.MANAGE_SETTLEMENTS);

    const { searchParams } = request.nextUrl;
    const status = searchParams.get("status") || "PENDING";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause based on status
    let where: Prisma.LoadWhereInput = {};

    switch (status) {
      case "PENDING":
        where = {
          status: "DELIVERED",
          podVerified: true,
          settlementStatus: "PENDING",
        };
        break;

      case "PAID":
        where = {
          settlementStatus: "PAID",
        };
        break;

      case "DISPUTE":
        where = {
          settlementStatus: "DISPUTE",
        };
        break;

      case "all":
        where = {
          settlementStatus: {
            in: ["PENDING", "PAID", "DISPUTE"],
          },
        };
        break;
    }

    // Fetch loads with settlement details
    const [loads, totalCount] = await Promise.all([
      db.load.findMany({
        where,
        include: {
          shipper: {
            select: {
              id: true,
              name: true,
              isVerified: true,
            },
          },
          assignedTruck: {
            include: {
              carrier: {
                select: {
                  id: true,
                  name: true,
                  isVerified: true,
                },
              },
            },
          },
        },
        orderBy: [
          { podVerifiedAt: "asc" }, // Oldest verified first
          { createdAt: "desc" },
        ],
        take: limit,
        skip: offset,
      }),
      db.load.count({ where }),
    ]);

    return NextResponse.json({
      loads,
      totalCount,
      limit,
      offset,
      hasMore: offset + loads.length < totalCount,
    });
  } catch (error) {
    console.error("Get settlements error:", error);

    if (error instanceof Error && error.name === "ForbiddenError") {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

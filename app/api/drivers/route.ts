export const dynamic = "force-dynamic";
/**
 * Driver List API — Task 14
 *
 * GET /api/drivers
 *
 * Carrier-only listing of drivers in the caller's organization. Supports
 * filtering by user status and driverProfile.isAvailable, plus cursor-free
 * page/limit pagination. Each row is enriched with an activeTrips count
 * scoped to the assigned-driver relation so the UI can surface workload.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { handleApiError } from "@/lib/apiErrors";
import { Prisma, UserStatus } from "@prisma/client";

const VALID_STATUSES: UserStatus[] = [
  "INVITED",
  "PENDING_VERIFICATION",
  "ACTIVE",
  "SUSPENDED",
];

export async function GET(request: NextRequest) {
  try {
    const session = await requireActiveUser();

    if (session.role !== "CARRIER") {
      return NextResponse.json(
        { error: "Only carriers can list drivers" },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: "You must belong to a carrier organization" },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get("status");
    const availableParam = searchParams.get("available");
    const page = Math.max(
      1,
      parseInt(searchParams.get("page") || "1", 10) || 1
    );
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10) || 20)
    );
    const skip = (page - 1) * limit;

    const where: Prisma.UserWhereInput = {
      role: "DRIVER",
      organizationId: session.organizationId,
    };

    if (statusParam && VALID_STATUSES.includes(statusParam as UserStatus)) {
      where.status = statusParam as UserStatus;
    }

    if (availableParam === "true" || availableParam === "false") {
      where.driverProfile = { isAvailable: availableParam === "true" };
    }

    const [rows, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          status: true,
          createdAt: true,
          driverProfile: {
            select: {
              cdlNumber: true,
              cdlExpiry: true,
              medicalCertExp: true,
              isAvailable: true,
              createdAt: true,
            },
          },
          _count: {
            select: {
              driverTrips: {
                where: {
                  status: {
                    in: ["ASSIGNED", "PICKUP_PENDING", "IN_TRANSIT"],
                  },
                },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.user.count({ where }),
    ]);

    const drivers = rows.map((row) => {
      const { _count, ...rest } = row;
      return {
        ...rest,
        activeTrips: _count?.driverTrips ?? 0,
      };
    });

    return NextResponse.json({
      drivers,
      total,
      page,
      limit,
    });
  } catch (error) {
    return handleApiError(error, "List drivers error");
  }
}

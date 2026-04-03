export const dynamic = "force-dynamic";
/**
 * Organization Ratings API — §12 Ratings & Reviews
 *
 * GET: Paginated list of ratings received by an organization
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";
import { handleApiError } from "@/lib/apiErrors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireActiveUser();
    const { id: orgId } = await params;

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(
      50,
      Math.max(1, parseInt(searchParams.get("limit") || "20", 10))
    );
    const skip = (page - 1) * limit;

    const org = await db.organization.findUnique({
      where: { id: orgId },
      select: { averageRating: true, totalRatings: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const [ratings, total] = await Promise.all([
      db.rating.findMany({
        where: { ratedOrgId: orgId },
        include: {
          rater: { select: { firstName: true, lastName: true } },
          trip: {
            select: {
              load: {
                select: { pickupCity: true, deliveryCity: true },
              },
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.rating.count({ where: { ratedOrgId: orgId } }),
    ]);

    return NextResponse.json({
      ratings,
      averageRating: org.averageRating ? Number(org.averageRating) : null,
      totalRatings: org.totalRatings,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, "GET /api/organizations/[id]/ratings");
  }
}

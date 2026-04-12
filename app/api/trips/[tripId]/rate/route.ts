export const dynamic = "force-dynamic";
/**
 * Trip Rating API — §12 Ratings & Reviews
 *
 * POST: Submit a 1-5 star rating for the other party on this trip
 * GET:  Retrieve ratings for this trip
 *
 * Shipper rates Carrier, Carrier rates Shipper — mutual, independent, immutable.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { notifyOrganization, NotificationType } from "@/lib/notifications";
import { handleApiError } from "@/lib/apiErrors";
import { CacheInvalidation } from "@/lib/cache";

const rateSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(300).optional(),
});

/**
 * POST /api/trips/[tripId]/rate — Submit rating
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    const session = await requireActiveUser();
    const { tripId } = await params;

    const body = await request.json();
    const parsed = rateSchema.safeParse(body);
    if (!parsed.success) {
      const { zodErrorResponse } = await import("@/lib/validation");
      return zodErrorResponse(parsed.error);
    }
    const { stars, comment } = parsed.data;

    // Fetch trip with org references
    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: {
        id: true,
        status: true,
        shipperId: true,
        carrierId: true,
        shipper: { select: { name: true } },
        carrier: { select: { name: true } },
        load: { select: { pickupCity: true, deliveryCity: true } },
      },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Task 6 (Gap 7): Drivers are not a party to the §12 rating contract —
    // ratings are between the shipper org and the carrier org. Block early
    // with a user-friendly 403.
    if (session.role === "DRIVER") {
      return NextResponse.json(
        { error: "Drivers cannot submit ratings" },
        { status: 403 }
      );
    }

    // Trip must be DELIVERED or COMPLETED
    if (!["DELIVERED", "COMPLETED"].includes(trip.status)) {
      return NextResponse.json(
        { error: "Trip must be delivered or completed before rating" },
        { status: 400 }
      );
    }

    // Determine rater role
    let raterRole: string;
    let ratedOrgId: string;
    let ratedOrgName: string;

    if (session.organizationId === trip.shipperId) {
      raterRole = "SHIPPER";
      ratedOrgId = trip.carrierId;
      ratedOrgName = trip.carrier?.name || "Carrier";
    } else if (session.organizationId === trip.carrierId) {
      raterRole = "CARRIER";
      ratedOrgId = trip.shipperId;
      ratedOrgName = trip.shipper?.name || "Shipper";
    } else {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Admin/SuperAdmin cannot submit ratings (they're not a party)
    if (session.role === "ADMIN" || session.role === "SUPER_ADMIN") {
      return NextResponse.json(
        { error: "Admins cannot submit ratings" },
        { status: 403 }
      );
    }

    // Check duplicate (@@unique enforces at DB level too)
    const existing = await db.rating.findFirst({
      where: { tripId, raterRole },
    });
    if (existing) {
      return NextResponse.json(
        { error: "You have already rated this trip" },
        { status: 409 }
      );
    }

    // Create rating + recalculate org average in transaction
    const rating = await db.$transaction(async (tx) => {
      const created = await tx.rating.create({
        data: {
          stars,
          comment: comment || null,
          raterRole,
          tripId,
          raterId: session.userId,
          ratedOrgId,
        },
      });

      // Recalculate average rating for the rated organization
      const agg = await tx.rating.aggregate({
        where: { ratedOrgId },
        _avg: { stars: true },
        _count: { stars: true },
      });

      await tx.organization.update({
        where: { id: ratedOrgId },
        data: {
          averageRating: agg._avg.stars,
          totalRatings: agg._count.stars,
        },
      });

      return created;
    });

    // Fire-and-forget: notify the rated organization
    const route =
      trip.load?.pickupCity && trip.load?.deliveryCity
        ? `${trip.load.pickupCity} → ${trip.load.deliveryCity}`
        : "your trip";
    notifyOrganization({
      organizationId: ratedOrgId,
      type: NotificationType.RATING_RECEIVED,
      title: `New ${stars}-Star Rating`,
      message: `${raterRole === "SHIPPER" ? "Shipper" : "Carrier"} rated your service ${stars}/5 for ${route}.`,
      metadata: { tripId, stars, raterRole },
    }).catch((err) => console.warn("Notification failed:", err?.message));

    // Cache invalidation
    CacheInvalidation.trip(tripId).catch((err) =>
      console.warn("Notification failed:", err?.message)
    );

    return NextResponse.json({ rating }, { status: 201 });
  } catch (error) {
    return handleApiError(error, "POST /api/trips/[tripId]/rate");
  }
}

/**
 * GET /api/trips/[tripId]/rate — Get ratings for this trip
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  try {
    const session = await requireActiveUser();
    const { tripId } = await params;

    const trip = await db.trip.findUnique({
      where: { id: tripId },
      select: { shipperId: true, carrierId: true, driverId: true },
    });

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Trip parties + admin + dispatcher can view.
    // Task 6 (Gap 7): the assigned driver can see ratings on their own trip,
    // but never on trips they're not assigned to.
    const isParty =
      session.organizationId === trip.shipperId ||
      session.organizationId === trip.carrierId;
    const isAdmin = session.role === "ADMIN" || session.role === "SUPER_ADMIN";
    const isDispatcher = session.role === "DISPATCHER";
    const isDriver =
      session.role === "DRIVER" && trip.driverId === session.userId;

    if (!isParty && !isAdmin && !isDispatcher && !isDriver) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    const ratings = await db.rating.findMany({
      where: { tripId },
      include: {
        rater: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    // Determine which rating belongs to the current user
    const myRating =
      ratings.find(
        (r) =>
          (r.raterRole === "SHIPPER" &&
            session.organizationId === trip.shipperId) ||
          (r.raterRole === "CARRIER" &&
            session.organizationId === trip.carrierId)
      ) || null;

    return NextResponse.json({ ratings, myRating });
  } catch (error) {
    return handleApiError(error, "GET /api/trips/[tripId]/rate");
  }
}

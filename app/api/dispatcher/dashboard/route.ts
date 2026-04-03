export const dynamic = "force-dynamic";
/**
 * Dispatcher Dashboard API
 *
 * GET /api/dispatcher/dashboard
 *
 * Provides dashboard statistics for dispatcher portal
 * Sprint 20 - Dashboard optimization: move stats calculation server-side
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { db } from "@/lib/db";
// M1 FIX: Add rate limiting
import { checkRpsLimit, RPS_CONFIGS } from "@/lib/rateLimit";
import { handleApiError } from "@/lib/apiErrors";

/**
 * GET /api/dispatcher/dashboard
 *
 * Returns dispatcher-specific statistics calculated server-side:
 * - Posted (unassigned) loads count
 * - Assigned loads count
 * - In-transit loads count
 * - Available trucks count
 * - Deliveries today count
 * - On-time delivery rate
 * - Alert count (late loads)
 * - Today's pickups
 */
export async function GET(request: NextRequest) {
  try {
    // M1 FIX: Apply rate limiting
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";
    const rpsResult = await checkRpsLimit(
      RPS_CONFIGS.dashboard.endpoint,
      ip,
      RPS_CONFIGS.dashboard.rps,
      RPS_CONFIGS.dashboard.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: "Rate limit exceeded. Please slow down." },
        { status: 429 }
      );
    }

    const session = await requireAuth();

    // Check if user is a dispatcher, admin, or super admin
    if (
      session.role !== "DISPATCHER" &&
      session.role !== "ADMIN" &&
      session.role !== "SUPER_ADMIN"
    ) {
      return NextResponse.json(
        { error: "Access denied. Dispatcher role required." },
        { status: 403 }
      );
    }

    // Parse optional date range for chart data (default: last 30 days)
    const searchParams = request.nextUrl.searchParams;
    const startDateParam = searchParams.get("startDate");
    const endDateParam = searchParams.get("endDate");
    const chartStart = startDateParam
      ? new Date(startDateParam + "T00:00:00")
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const chartEnd = endDateParam
      ? new Date(endDateParam + "T23:59:59")
      : new Date();

    // Get today's date boundaries
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get statistics in parallel
    const [
      postedLoads,
      assignedLoads,
      inTransitLoads,
      availableTrucks,
      deliveriesToday,
      deliveredLoads,
      lateLoads,
      pickupsToday,
      exceptionTrips,
      pendingProposals,
      openEscalations,
      onTimeRateTrendRaw,
      loadVolumeByDayRaw,
    ] = await Promise.all([
      // Posted (unassigned) loads
      db.load.count({
        where: { status: "POSTED" },
      }),

      // Assigned loads
      db.load.count({
        where: { status: "ASSIGNED" },
      }),

      // In-transit loads
      db.load.count({
        where: { status: "IN_TRANSIT" },
      }),

      // Available trucks (active postings)
      db.truckPosting.count({
        where: { status: "ACTIVE" },
      }),

      // Deliveries scheduled today
      db.load.count({
        where: {
          deliveryDate: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: {
            in: ["ASSIGNED", "IN_TRANSIT", "DELIVERED"],
          },
        },
      }),

      // Delivered trips (for on-time rate calculation) - last 30 days
      // Use Trip.deliveredAt which is the actual delivery timestamp
      db.trip.findMany({
        where: {
          status: { in: ["DELIVERED", "COMPLETED"] },
          deliveredAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          deliveredAt: true,
          load: {
            select: {
              deliveryDate: true,
            },
          },
        },
      }),

      // Late loads (alerts) - past due delivery date, not delivered/completed/cancelled
      db.load.count({
        where: {
          status: {
            notIn: ["DELIVERED", "COMPLETED", "CANCELLED"],
          },
          deliveryDate: {
            lt: new Date(),
          },
        },
      }),

      // Today's pickups
      db.load.findMany({
        where: {
          pickupDate: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: {
            in: ["POSTED", "ASSIGNED"],
          },
        },
        select: {
          id: true,
          pickupCity: true,
          deliveryCity: true,
          pickupDate: true,
          status: true,
          truckType: true,
        },
        orderBy: {
          pickupDate: "asc",
        },
        take: 10,
      }),

      // G-D8-1: Exception trips count
      db.trip.count({
        where: { status: "EXCEPTION" },
      }),

      // G-D8-2: Pending match proposals count
      db.matchProposal.count({
        where: { status: "PENDING" },
      }),

      // G-D8-3: Open escalations count (active = OPEN + ASSIGNED + IN_PROGRESS)
      db.loadEscalation.count({
        where: {
          status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] },
        },
      }),

      // On-time rate trend (for chart): daily on-time delivery rate
      db.$queryRaw<{ date: Date; total: bigint; on_time: bigint }[]>`
        SELECT
          DATE_TRUNC('day', t."deliveredAt") as date,
          COUNT(*) as total,
          COUNT(*) FILTER (
            WHERE DATE_TRUNC('day', t."deliveredAt") <= DATE_TRUNC('day', l."deliveryDate")
          ) as on_time
        FROM trips t
        JOIN loads l ON t."loadId" = l.id
        WHERE t.status IN ('DELIVERED', 'COMPLETED')
          AND t."deliveredAt" >= ${chartStart}
          AND t."deliveredAt" <= ${chartEnd}
          AND l."deliveryDate" IS NOT NULL
        GROUP BY DATE_TRUNC('day', t."deliveredAt")
        ORDER BY date ASC
      `,

      // Load volume by day (for chart): daily counts by status category
      db.$queryRaw<
        {
          date: Date;
          posted: bigint;
          in_transit: bigint;
          delivered: bigint;
        }[]
      >`
        SELECT
          DATE_TRUNC('day', "updatedAt") as date,
          COUNT(*) FILTER (WHERE status = 'POSTED') as posted,
          COUNT(*) FILTER (WHERE status = 'IN_TRANSIT') as in_transit,
          COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'COMPLETED')) as delivered
        FROM loads
        WHERE "updatedAt" >= ${chartStart} AND "updatedAt" <= ${chartEnd}
        GROUP BY DATE_TRUNC('day', "updatedAt")
        ORDER BY date ASC
      `,
    ]);

    // Calculate on-time rate using Trip.deliveredAt (actual delivery) vs Load.deliveryDate (target)
    // Compare by day - delivery on target day or earlier counts as on-time
    const onTimeDeliveries = deliveredLoads.filter((trip) => {
      if (!trip.load?.deliveryDate || !trip.deliveredAt) return true;
      const deliveredDate = new Date(trip.deliveredAt);
      const targetDate = new Date(trip.load.deliveryDate);
      // Compare dates at day precision (ignore time component)
      deliveredDate.setHours(23, 59, 59, 999);
      targetDate.setHours(23, 59, 59, 999);
      return deliveredDate <= targetDate;
    }).length;

    const onTimeRate =
      deliveredLoads.length > 0
        ? Math.round((onTimeDeliveries / deliveredLoads.length) * 100)
        : 100;

    return NextResponse.json({
      stats: {
        postedLoads,
        assignedLoads,
        inTransitLoads,
        availableTrucks,
        deliveriesToday,
        onTimeRate,
        alertCount: lateLoads,
        exceptionTrips,
        pendingProposals,
        openEscalations,
      },
      pickupsToday,
      charts: {
        onTimeRateTrend: onTimeRateTrendRaw.map((item) => {
          const total = Number(item.total);
          const onTime = Number(item.on_time);
          return {
            date: item.date,
            rate: total > 0 ? Math.round((onTime / total) * 100) : 100,
            total,
          };
        }),
        loadVolumeByDay: loadVolumeByDayRaw.map((item) => ({
          date: item.date,
          posted: Number(item.posted),
          inTransit: Number(item.in_transit),
          delivered: Number(item.delivered),
        })),
      },
    });
  } catch (error) {
    return handleApiError(error, "Dispatcher dashboard error");
  }
}

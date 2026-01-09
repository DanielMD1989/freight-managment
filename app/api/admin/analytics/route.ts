/**
 * Admin Analytics API
 *
 * GET /api/admin/analytics
 *
 * Provides comprehensive analytics for admin dashboard
 * Supports time period filtering: day, week, month, year
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, Permission } from '@/lib/rbac';
import { db } from '@/lib/db';

type TimePeriod = 'day' | 'week' | 'month' | 'year';

function getDateRange(period: TimePeriod): { start: Date; end: Date } {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case 'day':
      start.setHours(0, 0, 0, 0);
      break;
    case 'week':
      start.setDate(start.getDate() - 7);
      break;
    case 'month':
      start.setMonth(start.getMonth() - 1);
      break;
    case 'year':
      start.setFullYear(start.getFullYear() - 1);
      break;
  }

  return { start, end };
}

function getGroupByFormat(period: TimePeriod): string {
  switch (period) {
    case 'day':
      return 'hour';
    case 'week':
      return 'day';
    case 'month':
      return 'day';
    case 'year':
      return 'month';
    default:
      return 'day';
  }
}

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_DASHBOARD);

    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'month') as TimePeriod;
    const { start, end } = getDateRange(period);

    // Get all stats in parallel
    const [
      // Revenue stats
      platformRevenue,
      escrowBalance,

      // Truck stats
      totalTrucks,
      trucksByStatus,
      newTrucksInPeriod,

      // Load stats
      totalLoads,
      loadsByStatus,
      newLoadsInPeriod,

      // Trip/Delivery stats
      completedTrips,
      inTransitTrips,
      cancelledTrips,

      // User stats
      totalUsers,
      newUsersInPeriod,

      // Organization stats
      totalOrganizations,

      // Financial transactions in period
      transactionsInPeriod,

      // Disputes
      openDisputes,
      resolvedDisputesInPeriod,

      // Service fees collected
      serviceFeeRevenue,
    ] = await Promise.all([
      // Platform revenue account
      db.financialAccount.findFirst({
        where: { accountType: 'PLATFORM_REVENUE' },
        select: { balance: true },
      }),

      // Escrow balance
      db.financialAccount.findFirst({
        where: { accountType: 'ESCROW' },
        select: { balance: true },
      }),

      // Total trucks
      db.truck.count(),

      // Trucks by approval status
      db.truck.groupBy({
        by: ['approvalStatus'],
        _count: true,
      }),

      // New trucks in period
      db.truck.count({
        where: { createdAt: { gte: start, lte: end } },
      }),

      // Total loads
      db.load.count(),

      // Loads by status
      db.load.groupBy({
        by: ['status'],
        _count: true,
      }),

      // New loads in period
      db.load.count({
        where: { createdAt: { gte: start, lte: end } },
      }),

      // Completed trips (delivered loads) in period
      db.load.count({
        where: {
          status: 'DELIVERED',
          updatedAt: { gte: start, lte: end },
        },
      }),

      // In transit trips
      db.load.count({
        where: { status: 'IN_TRANSIT' },
      }),

      // Cancelled trips in period
      db.load.count({
        where: {
          status: 'CANCELLED',
          updatedAt: { gte: start, lte: end },
        },
      }),

      // Total users
      db.user.count(),

      // New users in period
      db.user.count({
        where: { createdAt: { gte: start, lte: end } },
      }),

      // Total organizations
      db.organization.count(),

      // Financial journal entries in period
      db.journalEntry.aggregate({
        where: {
          createdAt: { gte: start, lte: end },
        },
        _count: true,
      }),

      // Open disputes
      db.dispute.count({
        where: { status: { in: ['OPEN', 'UNDER_REVIEW'] } },
      }),

      // Resolved disputes in period
      db.dispute.count({
        where: {
          status: 'RESOLVED',
          updatedAt: { gte: start, lte: end },
        },
      }),

      // Service fee revenue in period
      db.load.aggregate({
        where: {
          serviceFeeStatus: 'DEDUCTED',
          serviceFeeDeductedAt: { gte: start, lte: end },
        },
        _sum: { serviceFeeEtb: true },
        _count: true,
      }),
    ]);

    // Get daily/periodic breakdown for charts
    const loadsOverTime = await db.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*) as count
      FROM loads
      WHERE "createdAt" >= ${start} AND "createdAt" <= ${end}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    const revenueOverTime = await db.$queryRaw<{ date: Date; total: number }[]>`
      SELECT DATE_TRUNC('day', "serviceFeeDeductedAt") as date,
             COALESCE(SUM("serviceFeeEtb"), 0) as total
      FROM loads
      WHERE "serviceFeeStatus" = 'DEDUCTED'
        AND "serviceFeeDeductedAt" >= ${start}
        AND "serviceFeeDeductedAt" <= ${end}
      GROUP BY DATE_TRUNC('day', "serviceFeeDeductedAt")
      ORDER BY date ASC
    `;

    const tripsOverTime = await db.$queryRaw<{ date: Date; completed: bigint; cancelled: bigint }[]>`
      SELECT
        DATE_TRUNC('day', "updatedAt") as date,
        COUNT(*) FILTER (WHERE status = 'DELIVERED') as completed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
      FROM loads
      WHERE "updatedAt" >= ${start} AND "updatedAt" <= ${end}
        AND status IN ('DELIVERED', 'CANCELLED')
      GROUP BY DATE_TRUNC('day', "updatedAt")
      ORDER BY date ASC
    `;

    // Calculate summary statistics
    type LoadStatusGroup = { status: string; _count: number };
    const postedLoads = loadsByStatus.find((s: LoadStatusGroup) => s.status === 'POSTED')?._count || 0;
    const assignedLoads = loadsByStatus.find((s: LoadStatusGroup) => s.status === 'ASSIGNED')?._count || 0;
    const deliveredLoads = loadsByStatus.find((s: LoadStatusGroup) => s.status === 'DELIVERED')?._count || 0;
    const cancelledLoads = loadsByStatus.find((s: LoadStatusGroup) => s.status === 'CANCELLED')?._count || 0;

    const approvedTrucks = trucksByStatus.find((t: { approvalStatus: string; _count: number }) => t.approvalStatus === 'APPROVED')?._count || 0;
    const pendingTrucks = trucksByStatus.find((t: { approvalStatus: string; _count: number }) => t.approvalStatus === 'PENDING')?._count || 0;

    return NextResponse.json({
      period,
      dateRange: { start, end },

      // Summary stats
      summary: {
        revenue: {
          platformBalance: Number(platformRevenue?.balance || 0),
          escrowBalance: Number(escrowBalance?.balance || 0),
          serviceFeeCollected: Number(serviceFeeRevenue._sum.serviceFeeEtb || 0),
          transactionsInPeriod: transactionsInPeriod._count || 0,
          transactionVolume: 0, // Journal entries don't have amount sum
        },
        trucks: {
          total: totalTrucks,
          approved: approvedTrucks,
          pending: pendingTrucks,
          newInPeriod: newTrucksInPeriod,
        },
        loads: {
          total: totalLoads,
          posted: postedLoads,
          assigned: assignedLoads,
          inTransit: inTransitTrips,
          delivered: deliveredLoads,
          cancelled: cancelledLoads,
          newInPeriod: newLoadsInPeriod,
        },
        trips: {
          completed: completedTrips,
          inTransit: inTransitTrips,
          cancelled: cancelledTrips,
        },
        users: {
          total: totalUsers,
          newInPeriod: newUsersInPeriod,
        },
        organizations: {
          total: totalOrganizations,
        },
        disputes: {
          open: openDisputes,
          resolvedInPeriod: resolvedDisputesInPeriod,
        },
      },

      // Charts data
      charts: {
        loadsOverTime: loadsOverTime.map(item => ({
          date: item.date,
          count: Number(item.count),
        })),
        revenueOverTime: revenueOverTime.map(item => ({
          date: item.date,
          total: Number(item.total),
        })),
        tripsOverTime: tripsOverTime.map(item => ({
          date: item.date,
          completed: Number(item.completed),
          cancelled: Number(item.cancelled),
        })),
        loadsByStatus: loadsByStatus.map((s: LoadStatusGroup) => ({
          status: s.status,
          count: s._count,
        })),
      },
    });
  } catch (error) {
    console.error('Admin analytics error:', error);

    if (error instanceof Error && error.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Failed to load analytics data' },
      { status: 500 }
    );
  }
}

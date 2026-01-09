/**
 * Shipper Analytics API
 *
 * GET /api/shipper/analytics
 *
 * Provides analytics for shipper dashboard - only their own loads
 * Supports time period filtering: day, week, month, year
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
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

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check if user is a shipper or admin
    if (session.role !== 'SHIPPER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Shipper role required.' },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization to access analytics.' },
        { status: 400 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'month') as TimePeriod;
    const { start, end } = getDateRange(period);

    const shipperId = session.organizationId;

    // Get all stats in parallel
    const [
      // Load stats
      totalLoads,
      loadsByStatus,
      loadsInPeriod,

      // Completed deliveries
      deliveredLoads,
      deliveredInPeriod,

      // Cancelled loads
      cancelledLoads,
      cancelledInPeriod,

      // Wallet balance
      walletAccount,

      // Spending (service fees paid)
      totalServiceFees,
      serviceFeesInPeriod,

      // Match proposals received
      totalProposals,
      proposalsInPeriod,

      // Load value stats
      loadValueStats,
      loadValueInPeriod,
    ] = await Promise.all([
      // Total loads
      db.load.count({
        where: { shipperId },
      }),

      // Loads by status
      db.load.groupBy({
        by: ['status'],
        where: { shipperId },
        _count: true,
      }),

      // Loads created in period
      db.load.count({
        where: {
          shipperId,
          createdAt: { gte: start, lte: end },
        },
      }),

      // Total delivered loads
      db.load.count({
        where: {
          shipperId,
          status: 'DELIVERED',
        },
      }),

      // Delivered in period
      db.load.count({
        where: {
          shipperId,
          status: 'DELIVERED',
          updatedAt: { gte: start, lte: end },
        },
      }),

      // Total cancelled loads
      db.load.count({
        where: {
          shipperId,
          status: 'CANCELLED',
        },
      }),

      // Cancelled in period
      db.load.count({
        where: {
          shipperId,
          status: 'CANCELLED',
          updatedAt: { gte: start, lte: end },
        },
      }),

      // Wallet account
      db.financialAccount.findFirst({
        where: {
          organizationId: shipperId,
          accountType: 'SHIPPER_WALLET',
        },
        select: { balance: true, currency: true },
      }),

      // Total service fees paid
      db.load.aggregate({
        where: {
          shipperId,
          serviceFeeStatus: 'DEDUCTED',
        },
        _sum: { serviceFeeEtb: true },
      }),

      // Service fees in period
      db.load.aggregate({
        where: {
          shipperId,
          serviceFeeStatus: 'DEDUCTED',
          serviceFeeDeductedAt: { gte: start, lte: end },
        },
        _sum: { serviceFeeEtb: true },
      }),

      // Total match proposals for shipper's loads
      db.matchProposal.count({
        where: {
          load: { shipperId },
        },
      }),

      // Match proposals in period
      db.matchProposal.count({
        where: {
          load: { shipperId },
          createdAt: { gte: start, lte: end },
        },
      }),

      // Total load value
      db.load.aggregate({
        where: { shipperId },
        _sum: { rate: true },
        _avg: { rate: true },
      }),

      // Load value in period
      db.load.aggregate({
        where: {
          shipperId,
          createdAt: { gte: start, lte: end },
        },
        _sum: { rate: true },
        _avg: { rate: true },
      }),
    ]);

    // Get loads over time for charts
    const loadsOverTime = await db.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*) as count
      FROM loads
      WHERE "shipperId" = ${shipperId}
        AND "createdAt" >= ${start}
        AND "createdAt" <= ${end}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `;

    const deliveriesOverTime = await db.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "updatedAt") as date, COUNT(*) as count
      FROM loads
      WHERE "shipperId" = ${shipperId}
        AND status = 'DELIVERED'
        AND "updatedAt" >= ${start}
        AND "updatedAt" <= ${end}
      GROUP BY DATE_TRUNC('day', "updatedAt")
      ORDER BY date ASC
    `;

    const spendingOverTime = await db.$queryRaw<{ date: Date; total: number }[]>`
      SELECT DATE_TRUNC('day', "serviceFeeDeductedAt") as date,
             COALESCE(SUM("serviceFeeEtb"), 0) as total
      FROM loads
      WHERE "shipperId" = ${shipperId}
        AND "serviceFeeStatus" = 'DEDUCTED'
        AND "serviceFeeDeductedAt" >= ${start}
        AND "serviceFeeDeductedAt" <= ${end}
      GROUP BY DATE_TRUNC('day', "serviceFeeDeductedAt")
      ORDER BY date ASC
    `;

    // Calculate rates
    const completionRate = totalLoads > 0
      ? ((deliveredLoads / totalLoads) * 100).toFixed(1)
      : '0';
    const cancellationRate = totalLoads > 0
      ? ((cancelledLoads / totalLoads) * 100).toFixed(1)
      : '0';

    return NextResponse.json({
      period,
      dateRange: { start, end },

      summary: {
        loads: {
          total: totalLoads,
          posted: loadsByStatus.find(s => s.status === 'POSTED')?._count || 0,
          assigned: loadsByStatus.find(s => s.status === 'ASSIGNED')?._count || 0,
          inTransit: loadsByStatus.find(s => s.status === 'IN_TRANSIT')?._count || 0,
          delivered: deliveredLoads,
          cancelled: cancelledLoads,
          newInPeriod: loadsInPeriod,
          deliveredInPeriod,
          cancelledInPeriod,
        },
        financial: {
          walletBalance: Number(walletAccount?.balance || 0),
          currency: walletAccount?.currency || 'ETB',
          totalServiceFees: Number(totalServiceFees._sum.serviceFeeEtb || 0),
          serviceFeesInPeriod: Number(serviceFeesInPeriod._sum.serviceFeeEtb || 0),
          totalLoadValue: Number(loadValueStats._sum.rate || 0),
          avgLoadValue: Number(loadValueStats._avg.rate || 0),
          loadValueInPeriod: Number(loadValueInPeriod._sum.rate || 0),
        },
        matches: {
          totalProposals,
          proposalsInPeriod,
        },
        rates: {
          completionRate: parseFloat(completionRate),
          cancellationRate: parseFloat(cancellationRate),
        },
      },

      charts: {
        loadsOverTime: loadsOverTime.map(item => ({
          date: item.date,
          count: Number(item.count),
        })),
        deliveriesOverTime: deliveriesOverTime.map(item => ({
          date: item.date,
          count: Number(item.count),
        })),
        spendingOverTime: spendingOverTime.map(item => ({
          date: item.date,
          total: Number(item.total),
        })),
        loadsByStatus: loadsByStatus.map(s => ({
          status: s.status,
          count: s._count,
        })),
      },
    });
  } catch (error) {
    console.error('Shipper analytics error:', error);

    return NextResponse.json(
      { error: 'Failed to load analytics data' },
      { status: 500 }
    );
  }
}

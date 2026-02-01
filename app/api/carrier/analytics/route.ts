/**
 * Carrier Analytics API
 *
 * GET /api/carrier/analytics
 *
 * Provides analytics for carrier dashboard - only their own trucks and loads
 * Supports time period filtering: day, week, month, year
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { getSLASummary, getSLATrends } from '@/lib/slaAggregation';

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

    // Check if user is a carrier or admin
    if (session.role !== 'CARRIER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Carrier role required.' },
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

    const carrierId = session.organizationId;

    // Get carrier's truck IDs first
    const carrierTrucks = await db.truck.findMany({
      where: { carrierId },
      select: { id: true },
    });
    const truckIds = carrierTrucks.map(t => t.id);

    // Get all stats in parallel
    const [
      // Truck stats
      totalTrucks,
      trucksByStatus,
      trucksInPeriod,

      // Truck postings
      activeTruckPostings,
      truckPostingsInPeriod,

      // Load stats (assigned to carrier's trucks)
      totalAssignedLoads,
      loadsByStatus,
      loadsAssignedInPeriod,

      // Completed deliveries
      completedDeliveries,
      completedInPeriod,

      // Cancelled loads
      cancelledLoads,
      cancelledInPeriod,

      // Wallet balance
      walletAccount,

      // Match proposals sent
      totalProposals,
      proposalsInPeriod,
      acceptedProposals,
      acceptedInPeriod,
    ] = await Promise.all([
      // Total trucks
      db.truck.count({
        where: { carrierId },
      }),

      // Trucks by approval status
      db.truck.groupBy({
        by: ['approvalStatus'],
        where: { carrierId },
        _count: true,
      }),

      // Trucks registered in period
      db.truck.count({
        where: {
          carrierId,
          createdAt: { gte: start, lte: end },
        },
      }),

      // Active truck postings
      db.truckPosting.count({
        where: {
          truck: { carrierId },
          status: 'ACTIVE',
        },
      }),

      // Truck postings in period
      db.truckPosting.count({
        where: {
          truck: { carrierId },
          createdAt: { gte: start, lte: end },
        },
      }),

      // Total loads assigned to carrier's trucks
      truckIds.length > 0
        ? db.load.count({
            where: { assignedTruckId: { in: truckIds } },
          })
        : Promise.resolve(0),

      // Loads by status (for carrier's trucks)
      truckIds.length > 0
        ? db.load.groupBy({
            by: ['status'],
            where: { assignedTruckId: { in: truckIds } },
            _count: true,
          })
        : Promise.resolve([]),

      // Loads assigned in period
      truckIds.length > 0
        ? db.load.count({
            where: {
              assignedTruckId: { in: truckIds },
              assignedAt: { gte: start, lte: end },
            },
          })
        : Promise.resolve(0),

      // Total completed deliveries
      truckIds.length > 0
        ? db.load.count({
            where: {
              assignedTruckId: { in: truckIds },
              status: 'DELIVERED',
            },
          })
        : Promise.resolve(0),

      // Completed in period
      truckIds.length > 0
        ? db.load.count({
            where: {
              assignedTruckId: { in: truckIds },
              status: 'DELIVERED',
              updatedAt: { gte: start, lte: end },
            },
          })
        : Promise.resolve(0),

      // Cancelled loads
      truckIds.length > 0
        ? db.load.count({
            where: {
              assignedTruckId: { in: truckIds },
              status: 'CANCELLED',
            },
          })
        : Promise.resolve(0),

      // Cancelled in period
      truckIds.length > 0
        ? db.load.count({
            where: {
              assignedTruckId: { in: truckIds },
              status: 'CANCELLED',
              updatedAt: { gte: start, lte: end },
            },
          })
        : Promise.resolve(0),

      // Wallet account
      db.financialAccount.findFirst({
        where: {
          organizationId: carrierId,
          accountType: 'CARRIER_WALLET',
        },
        select: { balance: true, currency: true },
      }),

      // Total match proposals sent
      db.matchProposal.count({
        where: {
          truck: { carrierId },
        },
      }),

      // Proposals in period
      db.matchProposal.count({
        where: {
          truck: { carrierId },
          createdAt: { gte: start, lte: end },
        },
      }),

      // Accepted proposals
      db.matchProposal.count({
        where: {
          truck: { carrierId },
          status: 'ACCEPTED',
        },
      }),

      // Accepted in period
      db.matchProposal.count({
        where: {
          truck: { carrierId },
          status: 'ACCEPTED',
          updatedAt: { gte: start, lte: end },
        },
      }),
    ]);

    // Get time-series data for charts using raw SQL with proper joins
    const deliveriesOverTime = truckIds.length > 0
      ? await db.$queryRaw<{ date: Date; count: bigint }[]>`
          SELECT DATE_TRUNC('day', l."updatedAt") as date, COUNT(*) as count
          FROM loads l
          JOIN trucks t ON l."assignedTruckId" = t.id
          WHERE t."carrierId" = ${carrierId}
            AND l.status = 'DELIVERED'
            AND l."updatedAt" >= ${start}
            AND l."updatedAt" <= ${end}
          GROUP BY DATE_TRUNC('day', l."updatedAt")
          ORDER BY date ASC
        `
      : [];

    const proposalsOverTime = await db.$queryRaw<{ date: Date; sent: bigint; accepted: bigint }[]>`
      SELECT
        DATE_TRUNC('day', mp."createdAt") as date,
        COUNT(*) as sent,
        COUNT(*) FILTER (WHERE mp.status = 'ACCEPTED') as accepted
      FROM match_proposals mp
      JOIN trucks t ON mp."truckId" = t.id
      WHERE t."carrierId" = ${carrierId}
        AND mp."createdAt" >= ${start}
        AND mp."createdAt" <= ${end}
      GROUP BY DATE_TRUNC('day', mp."createdAt")
      ORDER BY date ASC
    `;

    // Calculate rates
    type TruckStatusGroup = { approvalStatus: string; _count: number };
    const approvedTrucks = (trucksByStatus as TruckStatusGroup[]).find(t => t.approvalStatus === 'APPROVED')?._count || 0;
    const pendingTrucks = (trucksByStatus as TruckStatusGroup[]).find(t => t.approvalStatus === 'PENDING')?._count || 0;

    const proposalAcceptRate = totalProposals > 0
      ? ((acceptedProposals / totalProposals) * 100).toFixed(1)
      : '0';
    const completionRate = totalAssignedLoads > 0
      ? ((completedDeliveries / totalAssignedLoads) * 100).toFixed(1)
      : '0';

    // Type for load status groups
    type LoadStatusGroup = { status: string; _count: number };
    const loadStatusArray = loadsByStatus as LoadStatusGroup[];

    // Get SLA metrics for carrier's trips
    const slaPeriod = period === 'year' ? 'month' : period === 'day' ? 'day' : 'week';
    const [slaSummary, slaTrends] = await Promise.all([
      getSLASummary(slaPeriod as 'day' | 'week' | 'month', { carrierId }),
      getSLATrends(14, { carrierId }),
    ]);

    return NextResponse.json({
      period,
      dateRange: { start, end },

      summary: {
        trucks: {
          total: totalTrucks,
          approved: approvedTrucks,
          pending: pendingTrucks,
          newInPeriod: trucksInPeriod,
        },
        truckPostings: {
          active: activeTruckPostings,
          createdInPeriod: truckPostingsInPeriod,
        },
        loads: {
          total: totalAssignedLoads,
          assigned: loadStatusArray.find(s => s.status === 'ASSIGNED')?._count || 0,
          inTransit: loadStatusArray.find(s => s.status === 'IN_TRANSIT')?._count || 0,
          delivered: completedDeliveries,
          cancelled: cancelledLoads,
          assignedInPeriod: loadsAssignedInPeriod,
          completedInPeriod,
          cancelledInPeriod,
        },
        financial: {
          walletBalance: Number(walletAccount?.balance || 0),
          currency: walletAccount?.currency || 'ETB',
        },
        proposals: {
          totalSent: totalProposals,
          sentInPeriod: proposalsInPeriod,
          totalAccepted: acceptedProposals,
          acceptedInPeriod,
        },
        rates: {
          proposalAcceptRate: parseFloat(proposalAcceptRate),
          completionRate: parseFloat(completionRate),
        },
      },

      charts: {
        deliveriesOverTime: deliveriesOverTime.map(item => ({
          date: item.date,
          count: Number(item.count),
        })),
        proposalsOverTime: proposalsOverTime.map(item => ({
          date: item.date,
          sent: Number(item.sent),
          accepted: Number(item.accepted),
        })),
        loadsByStatus: loadStatusArray.map(s => ({
          status: s.status,
          count: s._count,
        })),
        slaTrends: slaTrends.map(t => ({
          date: t.date,
          pickupRate: t.pickupRate,
          deliveryRate: t.deliveryRate,
        })),
      },

      sla: {
        onTimePickupRate: slaSummary.onTimePickupRate,
        onTimeDeliveryRate: slaSummary.onTimeDeliveryRate,
        cancellationRate: slaSummary.cancellationRate,
        avgExceptionMTTR: slaSummary.avgMTTR,
        totalDeliveries: slaSummary.totalDeliveries,
        totalExceptions: slaSummary.totalExceptions,
      },
    });
  } catch (error) {
    console.error('Carrier analytics error:', error);

    return NextResponse.json(
      { error: 'Failed to load analytics data' },
      { status: 500 }
    );
  }
}

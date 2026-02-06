/**
 * Admin Analytics API
 *
 * GET /api/admin/analytics
 *
 * Provides comprehensive analytics for admin dashboard
 * Supports time period filtering: day, week, month, year
 *
 * Uses lib/admin/metrics.ts for consistent metric calculations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, Permission } from '@/lib/rbac';
import { db } from '@/lib/db';
import { getSLATrends, calculateSLAMetrics } from '@/lib/slaAggregation';
import {
  getLoadMetrics,
  getTripMetrics,
  getTruckMetrics,
  getRevenueMetrics,
  getDisputeMetrics,
  getCountMetrics,
  getPeriodMetrics,
  getChartData,
  getDateRangeForPeriod,
  type TimePeriod,
} from '@/lib/admin/metrics';

export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.VIEW_DASHBOARD);

    const searchParams = request.nextUrl.searchParams;
    const period = (searchParams.get('period') || 'month') as TimePeriod;
    const dateRange = getDateRangeForPeriod(period);
    const { start, end } = dateRange;

    // Get all stats using centralized metrics functions
    const [
      counts,
      loads,
      trips,
      trucks,
      revenue,
      disputes,
      periodMetrics,
      charts,
      transactionsInPeriod,
      resolvedDisputesInPeriod,
    ] = await Promise.all([
      getCountMetrics(),
      getLoadMetrics(),
      getTripMetrics(),
      getTruckMetrics(),
      getRevenueMetrics(dateRange),
      getDisputeMetrics(),
      getPeriodMetrics(dateRange),
      getChartData(dateRange),
      // Financial transactions in period
      db.journalEntry.aggregate({
        where: { createdAt: { gte: start, lte: end } },
        _count: true,
      }),
      // Resolved disputes in period
      db.dispute.count({
        where: {
          status: 'RESOLVED',
          updatedAt: { gte: start, lte: end },
        },
      }),
    ]);

    // Get comprehensive SLA metrics for admin (platform-wide)
    const slaPeriod = period === 'year' ? 'month' : period === 'day' ? 'day' : 'week';
    const [slaMetrics, slaTrends] = await Promise.all([
      calculateSLAMetrics(slaPeriod as 'day' | 'week' | 'month'),
      getSLATrends(30), // Admin gets 30-day trends
    ]);

    return NextResponse.json({
      period,
      dateRange: { start, end },

      // Summary stats - using centralized metrics
      summary: {
        revenue: {
          platformBalance: revenue.platformBalance,
          serviceFeeCollected: revenue.serviceFeeCollected,
          transactionsInPeriod: transactionsInPeriod._count || 0,
          transactionVolume: 0, // Journal entries don't have amount sum
        },
        trucks: {
          total: trucks.total,
          approved: trucks.byApprovalStatus['APPROVED'] || 0,
          pending: trucks.byApprovalStatus['PENDING'] || 0,
          available: trucks.available,
          unavailable: trucks.unavailable,
          newInPeriod: periodMetrics.newTrucks,
        },
        loads: {
          total: loads.total,
          // Grouped counts for quick overview
          active: loads.active,        // POSTED + SEARCHING + OFFERED
          inProgress: loads.inProgress, // ASSIGNED + PICKUP_PENDING + IN_TRANSIT
          delivered: loads.delivered,
          completed: loads.completed,
          cancelled: loads.cancelled,
          // Individual status counts for detailed view
          byStatus: {
            draft: loads.byStatus['DRAFT'] || 0,
            posted: loads.byStatus['POSTED'] || 0,
            searching: loads.byStatus['SEARCHING'] || 0,
            offered: loads.byStatus['OFFERED'] || 0,
            assigned: loads.byStatus['ASSIGNED'] || 0,
            pickupPending: loads.byStatus['PICKUP_PENDING'] || 0,
            inTransit: loads.byStatus['IN_TRANSIT'] || 0,
            delivered: loads.byStatus['DELIVERED'] || 0,
            completed: loads.byStatus['COMPLETED'] || 0,
            exception: loads.byStatus['EXCEPTION'] || 0,
            cancelled: loads.byStatus['CANCELLED'] || 0,
            expired: loads.byStatus['EXPIRED'] || 0,
            unposted: loads.byStatus['UNPOSTED'] || 0,
          },
          newInPeriod: periodMetrics.newLoads,
        },
        // Uses Trip model for trip metrics (consistent with dashboard)
        trips: {
          total: trips.total,
          active: trips.active,
          completed: periodMetrics.completedTrips,
          cancelled: periodMetrics.cancelledTrips,
          byStatus: trips.byStatus,
        },
        users: {
          total: counts.totalUsers,
          newInPeriod: periodMetrics.newUsers,
        },
        organizations: {
          total: counts.totalOrganizations,
        },
        disputes: {
          open: disputes.open + disputes.underReview,
          resolvedInPeriod: resolvedDisputesInPeriod,
        },
      },

      // Charts data - from centralized chart data function
      charts: {
        loadsOverTime: charts.loadsOverTime,
        revenueOverTime: charts.revenueOverTime,
        tripsOverTime: charts.tripsOverTime,
        loadsByStatus: Object.entries(loads.byStatus).map(([status, count]) => ({
          status,
          count,
        })),
        slaTrends: slaTrends.map(t => ({
          date: t.date,
          pickupRate: t.pickupRate,
          deliveryRate: t.deliveryRate,
          cancellationRate: t.cancellationRate,
        })),
      },

      // Comprehensive SLA metrics for admin dashboard
      sla: {
        period: slaMetrics.period,
        dateRange: {
          start: slaMetrics.startDate,
          end: slaMetrics.endDate,
        },
        pickup: {
          total: slaMetrics.pickup.total,
          onTime: slaMetrics.pickup.onTime,
          late: slaMetrics.pickup.late,
          rate: slaMetrics.pickup.rate,
          avgDelayHours: slaMetrics.pickup.avgDelayHours,
        },
        delivery: {
          total: slaMetrics.delivery.total,
          onTime: slaMetrics.delivery.onTime,
          late: slaMetrics.delivery.late,
          rate: slaMetrics.delivery.rate,
          avgDelayHours: slaMetrics.delivery.avgDelayHours,
        },
        cancellation: {
          total: slaMetrics.cancellation.total,
          cancelled: slaMetrics.cancellation.cancelled,
          rate: slaMetrics.cancellation.rate,
        },
        exceptions: {
          total: slaMetrics.exceptions.total,
          resolved: slaMetrics.exceptions.resolved,
          open: slaMetrics.exceptions.open,
          avgMTTR: slaMetrics.exceptions.avgMTTR,
          mttrByType: slaMetrics.exceptions.mttrByType,
          mttrByPriority: slaMetrics.exceptions.mttrByPriority,
        },
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

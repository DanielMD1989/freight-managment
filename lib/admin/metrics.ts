/**
 * Admin Metrics - Single Source of Truth
 *
 * This module provides centralized, consistent metric calculations
 * for all admin dashboards and analytics. All admin-related endpoints
 * should use these functions to ensure data consistency.
 *
 * Key Design Decisions:
 * - Active Trips: Uses Trip model (represents actual assignments)
 * - Active Loads: Uses Load model with status filters
 * - Revenue: Uses PLATFORM_REVENUE account balance
 * - Service Fees: Uses serviceFeeEtb from Load model (legacy but consistent)
 */

import { db } from '@/lib/db';

// ============================================================================
// TYPES
// ============================================================================

export interface DateRange {
  start: Date;
  end: Date;
}

export interface CountMetrics {
  totalUsers: number;
  totalOrganizations: number;
  totalLoads: number;
  totalTrucks: number;
}

export interface LoadMetrics {
  total: number;
  byStatus: Record<string, number>;
  // Grouped counts
  active: number;       // POSTED + SEARCHING + OFFERED
  inProgress: number;   // ASSIGNED + PICKUP_PENDING + IN_TRANSIT
  delivered: number;
  completed: number;
  cancelled: number;
}

export interface TripMetrics {
  total: number;
  byStatus: Record<string, number>;
  active: number;       // ASSIGNED + PICKUP_PENDING + IN_TRANSIT
  completed: number;    // DELIVERED + COMPLETED
  cancelled: number;
}

export interface TruckMetrics {
  total: number;
  available: number;
  unavailable: number;
  byApprovalStatus: Record<string, number>;
}

export interface RevenueMetrics {
  platformBalance: number;      // PLATFORM_REVENUE account balance
  serviceFeeCollected: number;  // Sum of serviceFeeEtb for period
  pendingWithdrawals: number;
}

export interface DisputeMetrics {
  open: number;
  underReview: number;
  resolved: number;
  total: number;
}

export interface AdminDashboardMetrics {
  counts: CountMetrics;
  loads: LoadMetrics;
  trips: TripMetrics;
  trucks: TruckMetrics;
  revenue: RevenueMetrics;
  disputes: DisputeMetrics;
  recentActivity: {
    usersLast7Days: number;
    loadsLast7Days: number;
  };
}

// ============================================================================
// LOAD STATUS CONSTANTS
// ============================================================================

/** All valid LoadStatus values from Prisma schema */
export const LOAD_STATUSES = [
  'DRAFT', 'POSTED', 'SEARCHING', 'OFFERED', 'ASSIGNED',
  'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED',
  'EXCEPTION', 'CANCELLED', 'EXPIRED', 'UNPOSTED'
] as const;

/** Load statuses considered "active" (waiting for assignment) */
export const ACTIVE_LOAD_STATUSES = ['POSTED', 'SEARCHING', 'OFFERED'] as const;

/** Load statuses considered "in progress" (being worked on) */
export const IN_PROGRESS_LOAD_STATUSES = ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'] as const;

/** All valid TripStatus values from Prisma schema */
export const TRIP_STATUSES = [
  'ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT', 'DELIVERED', 'COMPLETED', 'CANCELLED'
] as const;

/** Trip statuses considered "active" */
export const ACTIVE_TRIP_STATUSES = ['ASSIGNED', 'PICKUP_PENDING', 'IN_TRANSIT'] as const;

// ============================================================================
// CORE METRICS FUNCTIONS
// ============================================================================

/**
 * Get entity counts for admin dashboard
 */
export async function getCountMetrics(): Promise<CountMetrics> {
  const [totalUsers, totalOrganizations, totalLoads, totalTrucks] = await Promise.all([
    db.user.count(),
    db.organization.count(),
    db.load.count(),
    db.truck.count(),
  ]);

  return { totalUsers, totalOrganizations, totalLoads, totalTrucks };
}

/**
 * Get load metrics with full status breakdown
 */
export async function getLoadMetrics(): Promise<LoadMetrics> {
  const loadsByStatus = await db.load.groupBy({
    by: ['status'],
    _count: true,
  });

  const byStatus: Record<string, number> = {};
  let total = 0;

  for (const item of loadsByStatus) {
    byStatus[item.status] = item._count;
    total += item._count;
  }

  // Ensure all statuses have a value (even if 0)
  for (const status of LOAD_STATUSES) {
    if (!(status in byStatus)) {
      byStatus[status] = 0;
    }
  }

  const getCount = (status: string) => byStatus[status] || 0;

  return {
    total,
    byStatus,
    active: getCount('POSTED') + getCount('SEARCHING') + getCount('OFFERED'),
    inProgress: getCount('ASSIGNED') + getCount('PICKUP_PENDING') + getCount('IN_TRANSIT'),
    delivered: getCount('DELIVERED'),
    completed: getCount('COMPLETED'),
    cancelled: getCount('CANCELLED'),
  };
}

/**
 * Get trip metrics with full status breakdown
 *
 * IMPORTANT: Uses Trip model (not Load model) for accurate trip tracking.
 * A Load can exist without a Trip (before assignment), but a Trip
 * always represents an actual carrier assignment.
 */
export async function getTripMetrics(): Promise<TripMetrics> {
  const tripsByStatus = await db.trip.groupBy({
    by: ['status'],
    _count: true,
  });

  const byStatus: Record<string, number> = {};
  let total = 0;

  for (const item of tripsByStatus) {
    byStatus[item.status] = item._count;
    total += item._count;
  }

  // Ensure all statuses have a value
  for (const status of TRIP_STATUSES) {
    if (!(status in byStatus)) {
      byStatus[status] = 0;
    }
  }

  const getCount = (status: string) => byStatus[status] || 0;

  return {
    total,
    byStatus,
    active: getCount('ASSIGNED') + getCount('PICKUP_PENDING') + getCount('IN_TRANSIT'),
    completed: getCount('DELIVERED') + getCount('COMPLETED'),
    cancelled: getCount('CANCELLED'),
  };
}

/**
 * Get truck metrics with availability and approval status
 */
export async function getTruckMetrics(): Promise<TruckMetrics> {
  const [total, byAvailability, byApproval] = await Promise.all([
    db.truck.count(),
    db.truck.groupBy({
      by: ['isAvailable'],
      _count: true,
    }),
    db.truck.groupBy({
      by: ['approvalStatus'],
      _count: true,
    }),
  ]);

  const byApprovalStatus: Record<string, number> = {};
  for (const item of byApproval) {
    byApprovalStatus[item.approvalStatus] = item._count;
  }

  const available = byAvailability.find(t => t.isAvailable)?._count || 0;
  const unavailable = byAvailability.find(t => !t.isAvailable)?._count || 0;

  return {
    total,
    available,
    unavailable,
    byApprovalStatus,
  };
}

/**
 * Get revenue metrics from platform accounts
 *
 * IMPORTANT: Uses PLATFORM_REVENUE account for the authoritative
 * revenue balance. Service fees are calculated from Load.serviceFeeEtb
 * for historical compatibility.
 */
export async function getRevenueMetrics(dateRange?: DateRange): Promise<RevenueMetrics> {
  const [platformAccount, pendingWithdrawals, serviceFees] = await Promise.all([
    db.financialAccount.findFirst({
      where: { accountType: 'PLATFORM_REVENUE' },
      select: { balance: true },
    }),
    db.withdrawalRequest.count({
      where: { status: 'PENDING' },
    }),
    dateRange
      ? db.load.aggregate({
          where: {
            serviceFeeStatus: 'DEDUCTED',
            serviceFeeDeductedAt: { gte: dateRange.start, lte: dateRange.end },
          },
          _sum: { serviceFeeEtb: true },
        })
      : db.load.aggregate({
          where: { serviceFeeStatus: 'DEDUCTED' },
          _sum: { serviceFeeEtb: true },
        }),
  ]);

  return {
    platformBalance: Number(platformAccount?.balance || 0),
    serviceFeeCollected: Number(serviceFees._sum.serviceFeeEtb || 0),
    pendingWithdrawals,
  };
}

/**
 * Get dispute metrics
 */
export async function getDisputeMetrics(): Promise<DisputeMetrics> {
  const disputesByStatus = await db.dispute.groupBy({
    by: ['status'],
    _count: true,
  });

  const getCount = (status: string) =>
    disputesByStatus.find(d => d.status === status)?._count || 0;

  return {
    open: getCount('OPEN'),
    underReview: getCount('UNDER_REVIEW'),
    resolved: getCount('RESOLVED'),
    total: disputesByStatus.reduce((sum, d) => sum + d._count, 0),
  };
}

/**
 * Get recent activity metrics
 */
export async function getRecentActivityMetrics(days: number = 7): Promise<{
  usersLast7Days: number;
  loadsLast7Days: number;
}> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const [usersLast7Days, loadsLast7Days] = await Promise.all([
    db.user.count({ where: { createdAt: { gte: cutoff } } }),
    db.load.count({ where: { createdAt: { gte: cutoff } } }),
  ]);

  return { usersLast7Days, loadsLast7Days };
}

// ============================================================================
// COMPOSITE FUNCTIONS
// ============================================================================

/**
 * Get all admin dashboard metrics in a single call
 *
 * This is the primary function to use for the admin dashboard.
 * It fetches all metrics in parallel for optimal performance.
 */
export async function getAdminDashboardMetrics(): Promise<AdminDashboardMetrics> {
  const [counts, loads, trips, trucks, revenue, disputes, recentActivity] = await Promise.all([
    getCountMetrics(),
    getLoadMetrics(),
    getTripMetrics(),
    getTruckMetrics(),
    getRevenueMetrics(),
    getDisputeMetrics(),
    getRecentActivityMetrics(),
  ]);

  return {
    counts,
    loads,
    trips,
    trucks,
    revenue,
    disputes,
    recentActivity,
  };
}

// ============================================================================
// PERIOD-BASED METRICS (for analytics)
// ============================================================================

export type TimePeriod = 'day' | 'week' | 'month' | 'year';

/**
 * Get date range for a given time period
 */
export function getDateRangeForPeriod(period: TimePeriod): DateRange {
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

/**
 * Get counts for entities created within a time period
 */
export async function getPeriodMetrics(dateRange: DateRange) {
  const [newUsers, newLoads, newTrucks, completedTrips, cancelledTrips] = await Promise.all([
    db.user.count({
      where: { createdAt: { gte: dateRange.start, lte: dateRange.end } },
    }),
    db.load.count({
      where: { createdAt: { gte: dateRange.start, lte: dateRange.end } },
    }),
    db.truck.count({
      where: { createdAt: { gte: dateRange.start, lte: dateRange.end } },
    }),
    // Use Trip model for completed trips
    db.trip.count({
      where: {
        status: { in: ['DELIVERED', 'COMPLETED'] },
        updatedAt: { gte: dateRange.start, lte: dateRange.end },
      },
    }),
    db.trip.count({
      where: {
        status: 'CANCELLED',
        updatedAt: { gte: dateRange.start, lte: dateRange.end },
      },
    }),
  ]);

  return {
    newUsers,
    newLoads,
    newTrucks,
    completedTrips,
    cancelledTrips,
  };
}

/**
 * Get chart data for time series visualizations
 */
export async function getChartData(dateRange: DateRange) {
  const [loadsOverTime, revenueOverTime, tripsOverTime] = await Promise.all([
    db.$queryRaw<{ date: Date; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "createdAt") as date, COUNT(*) as count
      FROM loads
      WHERE "createdAt" >= ${dateRange.start} AND "createdAt" <= ${dateRange.end}
      GROUP BY DATE_TRUNC('day', "createdAt")
      ORDER BY date ASC
    `,
    db.$queryRaw<{ date: Date; total: number }[]>`
      SELECT DATE_TRUNC('day', "serviceFeeDeductedAt") as date,
             COALESCE(SUM("serviceFeeEtb"), 0) as total
      FROM loads
      WHERE "serviceFeeStatus" = 'DEDUCTED'
        AND "serviceFeeDeductedAt" >= ${dateRange.start}
        AND "serviceFeeDeductedAt" <= ${dateRange.end}
      GROUP BY DATE_TRUNC('day', "serviceFeeDeductedAt")
      ORDER BY date ASC
    `,
    // Use Trip model for trip chart data
    db.$queryRaw<{ date: Date; completed: bigint; cancelled: bigint }[]>`
      SELECT
        DATE_TRUNC('day', "updatedAt") as date,
        COUNT(*) FILTER (WHERE status IN ('DELIVERED', 'COMPLETED')) as completed,
        COUNT(*) FILTER (WHERE status = 'CANCELLED') as cancelled
      FROM trips
      WHERE "updatedAt" >= ${dateRange.start} AND "updatedAt" <= ${dateRange.end}
        AND status IN ('DELIVERED', 'COMPLETED', 'CANCELLED')
      GROUP BY DATE_TRUNC('day', "updatedAt")
      ORDER BY date ASC
    `,
  ]);

  return {
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
  };
}

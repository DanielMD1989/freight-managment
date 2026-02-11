/**
 * THIS MODULE OWNS BUSINESS TRUTH FOR: AGGREGATION / TOTALS
 *
 * All aggregation and totals calculations MUST route through this module.
 * This ensures consistent calculation methods across:
 * - Dashboard statistics
 * - Revenue calculations
 * - Load/trip counts
 * - SLA metrics
 *
 * BEHAVIOR FREEZE DATE: 2026-02-07
 * DO NOT MODIFY AGGREGATION LOGIC WITHOUT SNAPSHOT TEST COVERAGE
 *
 * Aggregation Delegation Map:
 * ---------------------------
 * | Concern              | Delegated To                | Status      |
 * |----------------------|----------------------------|-------------|
 * | Admin Metrics        | lib/admin/metrics.ts       | OWNER       |
 * | SLA Aggregation      | lib/slaAggregation.ts      | OWNER       |
 * | Trust Metrics        | lib/trustMetrics.ts        | OWNER       |
 * | Financial Totals     | THIS MODULE                | OWNER       |
 * | Chart Aggregation    | lib/admin/metrics.ts       | DELEGATED   |
 */

import { db } from '@/lib/db';
import { roundMoney, roundPercentage } from './rounding';

// Re-export admin metrics functions
export {
  getCountMetrics,
  getLoadMetrics,
  getTripMetrics,
  getTruckMetrics,
  getRevenueMetrics,
  getDisputeMetrics,
  getAdminDashboardMetrics,
  getRecentActivityMetrics,
  getPeriodMetrics,
  getChartData,
  LOAD_STATUSES,
  ACTIVE_LOAD_STATUSES,
  IN_PROGRESS_LOAD_STATUSES,
  TRIP_STATUSES,
  ACTIVE_TRIP_STATUSES,
} from './admin/metrics';

// Re-export SLA aggregation functions
export {
  runDailySLAAggregation,
  calculateSLAMetrics,
  getSLASummary,
  getSLATrends,
} from './slaAggregation';

// ============================================================================
// TYPES
// ============================================================================

export interface FinancialSummary {
  totalRevenue: number;
  shipperFeesCollected: number;
  carrierFeesCollected: number;
  pendingShipperFees: number;
  pendingCarrierFees: number;
  refundedFees: number;
}

export interface LoadSummary {
  total: number;
  posted: number;
  inTransit: number;
  completed: number;
  cancelled: number;
}

export interface CarrierEarningsSummary {
  totalEarnings: number;
  totalDistanceKm: number;
  completedTrips: number;
  averageEarningsPerTrip: number;
}

export interface ShipperSpendingSummary {
  totalSpent: number;
  pendingPayments: number;
  completedLoads: number;
  averageSpendPerLoad: number;
}

// ============================================================================
// FINANCIAL AGGREGATION
// ============================================================================

/**
 * Get financial summary for the platform
 *
 * Aggregates all service fee data across loads.
 * Uses current dual-party fields (shipperServiceFee, carrierServiceFee).
 *
 * @param dateRange - Optional date range filter
 * @returns Financial summary
 */
export async function getFinancialSummary(dateRange?: {
  start: Date;
  end: Date;
}): Promise<FinancialSummary> {
  const where = dateRange
    ? {
        createdAt: {
          gte: dateRange.start,
          lte: dateRange.end,
        },
      }
    : {};

  // Aggregate shipper fees by status
  const [shipperDeducted, shipperReserved, shipperRefunded] = await Promise.all([
    db.load.aggregate({
      where: {
        ...where,
        shipperFeeStatus: 'DEDUCTED',
      },
      _sum: { shipperServiceFee: true },
    }),
    db.load.aggregate({
      where: {
        ...where,
        shipperFeeStatus: 'RESERVED',
      },
      _sum: { shipperServiceFee: true },
    }),
    db.load.aggregate({
      where: {
        ...where,
        shipperFeeStatus: 'REFUNDED',
      },
      _sum: { shipperServiceFee: true },
    }),
  ]);

  // Aggregate carrier fees
  const carrierDeducted = await db.load.aggregate({
    where: {
      ...where,
      carrierFeeStatus: 'DEDUCTED',
    },
    _sum: { carrierServiceFee: true },
  });

  const shipperFeesCollected = roundMoney(
    Number(shipperDeducted._sum?.shipperServiceFee || 0)
  );
  const carrierFeesCollected = roundMoney(
    Number(carrierDeducted._sum?.carrierServiceFee || 0)
  );
  const pendingShipperFees = roundMoney(
    Number(shipperReserved._sum?.shipperServiceFee || 0)
  );
  const refundedFees = roundMoney(
    Number(shipperRefunded._sum?.shipperServiceFee || 0)
  );

  return {
    totalRevenue: roundMoney(shipperFeesCollected + carrierFeesCollected),
    shipperFeesCollected,
    carrierFeesCollected,
    pendingShipperFees,
    pendingCarrierFees: 0, // Carrier fees not reserved in advance
    refundedFees,
  };
}

// ============================================================================
// CARRIER AGGREGATION
// ============================================================================

/**
 * Get earnings summary for a carrier
 *
 * Aggregates completed trips and earnings.
 *
 * @param carrierId - Carrier organization ID
 * @param dateRange - Optional date range filter
 * @returns Carrier earnings summary
 */
export async function getCarrierEarningsSummary(
  carrierId: string,
  dateRange?: { start: Date; end: Date }
): Promise<CarrierEarningsSummary> {
  const statusFilter = ['DELIVERED', 'COMPLETED'] as ('DELIVERED' | 'COMPLETED')[];

  const tripWhere = {
    carrierId,
    status: { in: statusFilter },
    ...(dateRange
      ? {
          completedAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        }
      : {}),
  };

  const [tripCount, tripStats, revenueStats] = await Promise.all([
    // Get trip count
    db.trip.count({ where: tripWhere }),
    // Get trip distance sums
    db.trip.aggregate({
      where: tripWhere,
      _sum: {
        actualDistanceKm: true,
        estimatedDistanceKm: true,
      },
    }),
    // Get carrier service fees from loads with completed trips
    // Note: Load.trip is a one-to-one relation, so we filter by trip existence
    db.load.aggregate({
      where: {
        carrierFeeStatus: 'DEDUCTED',
        trip: {
          carrierId,
          status: { in: statusFilter },
        },
      },
      _sum: { carrierServiceFee: true },
    }),
  ]);

  const completedTrips = tripCount;
  const totalDistanceKm = roundMoney(
    Number(
      tripStats._sum?.actualDistanceKm ||
        tripStats._sum?.estimatedDistanceKm ||
        0
    )
  );
  const totalEarnings = roundMoney(
    Number(revenueStats._sum?.carrierServiceFee || 0)
  );

  return {
    totalEarnings,
    totalDistanceKm,
    completedTrips,
    averageEarningsPerTrip:
      completedTrips > 0 ? roundMoney(totalEarnings / completedTrips) : 0,
  };
}

// ============================================================================
// SHIPPER AGGREGATION
// ============================================================================

/**
 * Get spending summary for a shipper
 *
 * Aggregates completed loads and spending.
 *
 * @param shipperId - Shipper organization ID
 * @param dateRange - Optional date range filter
 * @returns Shipper spending summary
 */
export async function getShipperSpendingSummary(
  shipperId: string,
  dateRange?: { start: Date; end: Date }
): Promise<ShipperSpendingSummary> {
  const baseWhere = {
    shipperId,
    ...(dateRange
      ? {
          createdAt: {
            gte: dateRange.start,
            lte: dateRange.end,
          },
        }
      : {}),
  };

  const [totalSpentResult, pendingResult, completedCount] = await Promise.all([
    // Total spent (deducted fees)
    db.load.aggregate({
      where: {
        ...baseWhere,
        shipperFeeStatus: 'DEDUCTED',
      },
      _sum: { shipperServiceFee: true },
    }),
    // Pending payments (reserved fees)
    db.load.aggregate({
      where: {
        ...baseWhere,
        shipperFeeStatus: 'RESERVED',
      },
      _sum: { shipperServiceFee: true },
    }),
    // Completed load count
    db.load.count({
      where: {
        ...baseWhere,
        status: { in: ['DELIVERED', 'COMPLETED'] },
      },
    }),
  ]);

  const totalSpent = roundMoney(
    Number(totalSpentResult._sum?.shipperServiceFee || 0)
  );
  const pendingPayments = roundMoney(
    Number(pendingResult._sum?.shipperServiceFee || 0)
  );

  return {
    totalSpent,
    pendingPayments,
    completedLoads: completedCount,
    averageSpendPerLoad:
      completedCount > 0 ? roundMoney(totalSpent / completedCount) : 0,
  };
}

// ============================================================================
// LOAD SUMMARY
// ============================================================================

/**
 * Get load summary by status
 *
 * @param organizationId - Optional organization filter
 * @param role - 'shipper' or 'carrier'
 * @returns Load summary
 */
export async function getLoadSummary(
  organizationId?: string,
  role?: 'shipper' | 'carrier'
): Promise<LoadSummary> {
  const where = organizationId
    ? role === 'shipper'
      ? { shipperId: organizationId }
      : { assignedTruck: { carrierId: organizationId } }
    : {};

  const loadsByStatus = await db.load.groupBy({
    by: ['status'],
    where,
    _count: true,
  });

  const statusCounts: Record<string, number> = {};
  let total = 0;

  for (const item of loadsByStatus) {
    statusCounts[item.status] = item._count;
    total += item._count;
  }

  return {
    total,
    posted: statusCounts['POSTED'] || 0,
    inTransit: statusCounts['IN_TRANSIT'] || 0,
    completed:
      (statusCounts['DELIVERED'] || 0) + (statusCounts['COMPLETED'] || 0),
    cancelled: statusCounts['CANCELLED'] || 0,
  };
}

// ============================================================================
// RATE CALCULATIONS
// ============================================================================

/**
 * Calculate completion rate
 *
 * @param completed - Number of completed items
 * @param total - Total number of items
 * @returns Completion rate as percentage (0-100)
 */
export function calculateCompletionRate(
  completed: number,
  total: number
): number {
  if (total === 0) return 0;
  return roundPercentage((completed / total) * 100);
}

/**
 * Calculate cancellation rate
 *
 * @param cancelled - Number of cancelled items
 * @param total - Total number of items
 * @returns Cancellation rate as percentage (0-100)
 */
export function calculateCancellationRate(
  cancelled: number,
  total: number
): number {
  if (total === 0) return 0;
  return roundPercentage((cancelled / total) * 100);
}

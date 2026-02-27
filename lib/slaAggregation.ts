/**
 * SLA Aggregation Service
 * Sprint: Production Finalization
 *
 * Computes and tracks SLA metrics:
 * - On-time pickup rate
 * - On-time delivery rate
 * - Cancellation rate
 * - Exception MTTR (Mean Time To Resolution)
 *
 * ROUNDING: Delegated to lib/rounding.ts (2026-02-07)
 * Uses roundPercentage() for all percentage and time metrics (1 decimal place)
 */

import { db } from "@/lib/db";
import { roundPercentage } from "./rounding";

// =============================================================================
// TYPES
// =============================================================================

export interface SLAMetrics {
  period: "day" | "week" | "month";
  startDate: Date;
  endDate: Date;

  // Pickup SLA
  pickup: {
    total: number;
    onTime: number;
    late: number;
    rate: number; // percentage
    avgDelayHours: number | null;
  };

  // Delivery SLA
  delivery: {
    total: number;
    onTime: number;
    late: number;
    rate: number; // percentage
    avgDelayHours: number | null;
  };

  // Cancellation
  cancellation: {
    total: number;
    cancelled: number;
    rate: number; // percentage
  };

  // Exceptions
  exceptions: {
    total: number;
    resolved: number;
    open: number;
    avgMTTR: number | null; // hours
    mttrByType: Record<string, number>;
    mttrByPriority: Record<string, number>;
  };
}

export interface DailySLARecord {
  date: Date;
  metrics: SLAMetrics;
  shipperId?: string;
  carrierId?: string;
}

// =============================================================================
// DATE HELPERS
// =============================================================================

function getDateRange(period: "day" | "week" | "month"): {
  start: Date;
  end: Date;
} {
  const end = new Date();
  const start = new Date();

  switch (period) {
    case "day":
      start.setHours(0, 0, 0, 0);
      break;
    case "week":
      start.setDate(start.getDate() - 7);
      start.setHours(0, 0, 0, 0);
      break;
    case "month":
      start.setMonth(start.getMonth() - 1);
      start.setHours(0, 0, 0, 0);
      break;
  }

  return { start, end };
}

function parseDockHours(
  dockHours: string | null
): { start: number; end: number } | null {
  if (!dockHours) return null;

  // Parse format like "8:00 AM - 5:00 PM"
  const match = dockHours.match(
    /(\d{1,2}):(\d{2})\s*(AM|PM)\s*-\s*(\d{1,2}):(\d{2})\s*(AM|PM)/i
  );
  if (!match) return null;

  const [, startHour, startMin, startPeriod, endHour, endMin, endPeriod] =
    match;

  let start = parseInt(startHour);
  if (startPeriod.toUpperCase() === "PM" && start !== 12) start += 12;
  if (startPeriod.toUpperCase() === "AM" && start === 12) start = 0;
  start = start * 60 + parseInt(startMin);

  let end = parseInt(endHour);
  if (endPeriod.toUpperCase() === "PM" && end !== 12) end += 12;
  if (endPeriod.toUpperCase() === "AM" && end === 12) end = 0;
  end = end * 60 + parseInt(endMin);

  return { start, end };
}

function isWithinWindow(
  actualTime: Date,
  targetDate: Date,
  dockHours: string | null
): boolean {
  const window = parseDockHours(dockHours);

  if (!window) {
    // If no dock hours specified, compare just the dates
    const actualDay = new Date(actualTime);
    actualDay.setHours(0, 0, 0, 0);
    const targetDay = new Date(targetDate);
    targetDay.setHours(0, 0, 0, 0);
    return actualDay <= targetDay;
  }

  // Create the deadline: target date + end of dock hours window
  const deadline = new Date(targetDate);
  deadline.setHours(Math.floor(window.end / 60), window.end % 60, 0, 0);

  return actualTime <= deadline;
}

function calculateDelayHours(actualTime: Date, targetDate: Date): number {
  const diffMs = actualTime.getTime() - targetDate.getTime();
  return Math.max(0, diffMs / (1000 * 60 * 60));
}

// =============================================================================
// SLA CALCULATION FUNCTIONS
// =============================================================================

/**
 * Calculate pickup SLA metrics for a given period
 */
async function calculatePickupSLA(
  start: Date,
  end: Date,
  filters?: { shipperId?: string; carrierId?: string }
): Promise<SLAMetrics["pickup"]> {
  // Get all trips with pickups in the period
  const whereClause: Record<string, unknown> = {
    pickedUpAt: {
      gte: start,
      lte: end,
    },
    status: {
      in: ["IN_TRANSIT", "DELIVERED", "COMPLETED"],
    },
  };

  if (filters?.carrierId) {
    whereClause.carrierId = filters.carrierId;
  }

  const trips = await db.trip.findMany({
    where: whereClause,
    include: {
      load: {
        select: {
          pickupDate: true,
          pickupDockHours: true,
          shipperId: true,
        },
      },
    },
  });

  // Filter by shipper if specified
  const filteredTrips = filters?.shipperId
    ? trips.filter((t) => t.load?.shipperId === filters.shipperId)
    : trips;

  let onTime = 0;
  let late = 0;
  let totalDelayHours = 0;
  let lateCount = 0;

  for (const trip of filteredTrips) {
    if (!trip.pickedUpAt || !trip.load?.pickupDate) continue;

    const isOnTime = isWithinWindow(
      trip.pickedUpAt,
      trip.load.pickupDate,
      trip.load.pickupDockHours
    );

    if (isOnTime) {
      onTime++;
    } else {
      late++;
      const delay = calculateDelayHours(trip.pickedUpAt, trip.load.pickupDate);
      totalDelayHours += delay;
      lateCount++;
    }
  }

  const total = onTime + late;
  const rate = total > 0 ? (onTime / total) * 100 : 100;
  const avgDelayHours = lateCount > 0 ? totalDelayHours / lateCount : null;

  return {
    total,
    onTime,
    late,
    rate: roundPercentage(rate),
    avgDelayHours: avgDelayHours ? roundPercentage(avgDelayHours) : null,
  };
}

/**
 * Calculate delivery SLA metrics for a given period
 */
async function calculateDeliverySLA(
  start: Date,
  end: Date,
  filters?: { shipperId?: string; carrierId?: string }
): Promise<SLAMetrics["delivery"]> {
  const whereClause: Record<string, unknown> = {
    deliveredAt: {
      gte: start,
      lte: end,
    },
    status: {
      in: ["DELIVERED", "COMPLETED"],
    },
  };

  if (filters?.carrierId) {
    whereClause.carrierId = filters.carrierId;
  }

  const trips = await db.trip.findMany({
    where: whereClause,
    include: {
      load: {
        select: {
          deliveryDate: true,
          deliveryDockHours: true,
          shipperId: true,
        },
      },
    },
  });

  const filteredTrips = filters?.shipperId
    ? trips.filter((t) => t.load?.shipperId === filters.shipperId)
    : trips;

  let onTime = 0;
  let late = 0;
  let totalDelayHours = 0;
  let lateCount = 0;

  for (const trip of filteredTrips) {
    if (!trip.deliveredAt || !trip.load?.deliveryDate) continue;

    const isOnTime = isWithinWindow(
      trip.deliveredAt,
      trip.load.deliveryDate,
      trip.load.deliveryDockHours
    );

    if (isOnTime) {
      onTime++;
    } else {
      late++;
      const delay = calculateDelayHours(
        trip.deliveredAt,
        trip.load.deliveryDate
      );
      totalDelayHours += delay;
      lateCount++;
    }
  }

  const total = onTime + late;
  const rate = total > 0 ? (onTime / total) * 100 : 100;
  const avgDelayHours = lateCount > 0 ? totalDelayHours / lateCount : null;

  return {
    total,
    onTime,
    late,
    rate: roundPercentage(rate),
    avgDelayHours: avgDelayHours ? roundPercentage(avgDelayHours) : null,
  };
}

/**
 * Calculate cancellation rate metrics
 */
async function calculateCancellationRate(
  start: Date,
  end: Date,
  filters?: { shipperId?: string; carrierId?: string }
): Promise<SLAMetrics["cancellation"]> {
  const baseWhere: Record<string, unknown> = {
    createdAt: {
      gte: start,
      lte: end,
    },
  };

  if (filters?.shipperId) {
    baseWhere.shipperId = filters.shipperId;
  }

  // Get total loads in period
  const total = await db.load.count({ where: baseWhere });

  // Get cancelled loads in period
  const cancelled = await db.load.count({
    where: {
      ...baseWhere,
      status: "CANCELLED",
    },
  });

  const rate = total > 0 ? (cancelled / total) * 100 : 0;

  return {
    total,
    cancelled,
    rate: roundPercentage(rate),
  };
}

/**
 * Calculate exception MTTR metrics
 */
async function calculateExceptionMTTR(
  start: Date,
  end: Date,
  filters?: { shipperId?: string; carrierId?: string }
): Promise<SLAMetrics["exceptions"]> {
  const baseWhere: Record<string, unknown> = {
    createdAt: {
      gte: start,
      lte: end,
    },
  };

  // Get all exceptions in period
  const allExceptions = await db.loadEscalation.findMany({
    where: baseWhere,
    include: {
      load: {
        select: {
          shipperId: true,
        },
      },
    },
  });

  // Filter by shipper if specified
  const filteredExceptions = filters?.shipperId
    ? allExceptions.filter((e) => e.load?.shipperId === filters.shipperId)
    : allExceptions;

  const total = filteredExceptions.length;
  const resolved = filteredExceptions.filter(
    (e) => e.status === "RESOLVED" || e.status === "CLOSED"
  ).length;
  const open = total - resolved;

  // Calculate MTTR
  const resolvedWithTime = filteredExceptions.filter(
    (e) => e.resolvedAt && (e.status === "RESOLVED" || e.status === "CLOSED")
  );

  let totalMTTR = 0;
  const mttrByType: Record<string, { total: number; count: number }> = {};
  const mttrByPriority: Record<string, { total: number; count: number }> = {};

  for (const exception of resolvedWithTime) {
    const hours =
      (exception.resolvedAt!.getTime() - exception.createdAt.getTime()) /
      (1000 * 60 * 60);
    totalMTTR += hours;

    // By type
    if (!mttrByType[exception.escalationType]) {
      mttrByType[exception.escalationType] = { total: 0, count: 0 };
    }
    mttrByType[exception.escalationType].total += hours;
    mttrByType[exception.escalationType].count++;

    // By priority
    if (!mttrByPriority[exception.priority]) {
      mttrByPriority[exception.priority] = { total: 0, count: 0 };
    }
    mttrByPriority[exception.priority].total += hours;
    mttrByPriority[exception.priority].count++;
  }

  const avgMTTR =
    resolvedWithTime.length > 0 ? totalMTTR / resolvedWithTime.length : null;

  // Calculate averages
  // Rounding delegated to lib/rounding.ts:roundPercentage() (1 decimal place)
  const mttrByTypeResult: Record<string, number> = {};
  for (const [type, data] of Object.entries(mttrByType)) {
    mttrByTypeResult[type] = roundPercentage(data.total / data.count);
  }

  const mttrByPriorityResult: Record<string, number> = {};
  for (const [priority, data] of Object.entries(mttrByPriority)) {
    mttrByPriorityResult[priority] = roundPercentage(data.total / data.count);
  }

  return {
    total,
    resolved,
    open,
    avgMTTR: avgMTTR ? roundPercentage(avgMTTR) : null,
    mttrByType: mttrByTypeResult,
    mttrByPriority: mttrByPriorityResult,
  };
}

// =============================================================================
// MAIN AGGREGATION FUNCTIONS
// =============================================================================

/**
 * Calculate all SLA metrics for a given period
 */
export async function calculateSLAMetrics(
  period: "day" | "week" | "month" = "day",
  filters?: { shipperId?: string; carrierId?: string }
): Promise<SLAMetrics> {
  const { start, end } = getDateRange(period);

  const [pickup, delivery, cancellation, exceptions] = await Promise.all([
    calculatePickupSLA(start, end, filters),
    calculateDeliverySLA(start, end, filters),
    calculateCancellationRate(start, end, filters),
    calculateExceptionMTTR(start, end, filters),
  ]);

  return {
    period,
    startDate: start,
    endDate: end,
    pickup,
    delivery,
    cancellation,
    exceptions,
  };
}

/**
 * Run daily SLA aggregation job
 * Called by cron at 2 AM daily
 */
export async function runDailySLAAggregation(): Promise<{
  success: boolean;
  metrics: SLAMetrics | null;
  error?: string;
}> {
  try {
    // Calculate yesterday's metrics
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const endOfYesterday = new Date(yesterday);
    endOfYesterday.setHours(23, 59, 59, 999);

    const [pickup, delivery, cancellation, exceptions] = await Promise.all([
      calculatePickupSLA(yesterday, endOfYesterday),
      calculateDeliverySLA(yesterday, endOfYesterday),
      calculateCancellationRate(yesterday, endOfYesterday),
      calculateExceptionMTTR(yesterday, endOfYesterday),
    ]);

    const metrics: SLAMetrics = {
      period: "day",
      startDate: yesterday,
      endDate: endOfYesterday,
      pickup,
      delivery,
      cancellation,
      exceptions,
    };

    return { success: true, metrics };
  } catch (error) {
    console.error("[SLA] Aggregation failed:", error);
    return {
      success: false,
      metrics: null,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}

/**
 * Get SLA summary for dashboards
 */
export async function getSLASummary(
  period: "day" | "week" | "month" = "week",
  filters?: { shipperId?: string; carrierId?: string }
): Promise<{
  onTimePickupRate: number;
  onTimeDeliveryRate: number;
  cancellationRate: number;
  avgMTTR: number | null;
  totalDeliveries: number;
  totalExceptions: number;
}> {
  const metrics = await calculateSLAMetrics(period, filters);

  return {
    onTimePickupRate: metrics.pickup.rate,
    onTimeDeliveryRate: metrics.delivery.rate,
    cancellationRate: metrics.cancellation.rate,
    avgMTTR: metrics.exceptions.avgMTTR,
    totalDeliveries: metrics.delivery.total,
    totalExceptions: metrics.exceptions.total,
  };
}

/**
 * Get SLA trends over time
 */
export async function getSLATrends(
  days: number = 14,
  filters?: { shipperId?: string; carrierId?: string }
): Promise<
  Array<{
    date: string;
    pickupRate: number;
    deliveryRate: number;
    cancellationRate: number;
  }>
> {
  const trends: Array<{
    date: string;
    pickupRate: number;
    deliveryRate: number;
    cancellationRate: number;
  }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    date.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const [pickup, delivery, cancellation] = await Promise.all([
      calculatePickupSLA(date, endOfDay, filters),
      calculateDeliverySLA(date, endOfDay, filters),
      calculateCancellationRate(date, endOfDay, filters),
    ]);

    trends.push({
      date: date.toISOString().split("T")[0],
      pickupRate: pickup.rate,
      deliveryRate: delivery.rate,
      cancellationRate: cancellation.rate,
    });
  }

  return trends;
}

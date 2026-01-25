/**
 * Cron Job: Aggregate SLA Metrics
 * Sprint: Production Finalization
 *
 * Runs daily to compute and log SLA metrics:
 * - On-time pickup rate
 * - On-time delivery rate
 * - Cancellation rate
 * - Exception MTTR
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDailySLAAggregation } from '@/lib/slaAggregation';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Run SLA aggregation
    const result = await runDailySLAAggregation();

    if (!result.success) {
      return NextResponse.json(
        {
          success: false,
          error: result.error,
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      metrics: result.metrics
        ? {
            date: result.metrics.startDate.toISOString().split('T')[0],
            pickup: {
              rate: result.metrics.pickup.rate,
              total: result.metrics.pickup.total,
              onTime: result.metrics.pickup.onTime,
            },
            delivery: {
              rate: result.metrics.delivery.rate,
              total: result.metrics.delivery.total,
              onTime: result.metrics.delivery.onTime,
            },
            cancellation: {
              rate: result.metrics.cancellation.rate,
              total: result.metrics.cancellation.total,
              cancelled: result.metrics.cancellation.cancelled,
            },
            exceptions: {
              avgMTTR: result.metrics.exceptions.avgMTTR,
              total: result.metrics.exceptions.total,
              resolved: result.metrics.exceptions.resolved,
            },
          }
        : null,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in aggregate-sla cron:', error);
    return NextResponse.json(
      {
        error: 'Failed to aggregate SLA metrics',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'aggregate-sla',
    description:
      'Aggregates SLA metrics including pickup/delivery rates, cancellation rate, and exception MTTR',
    schedule: '0 2 * * *', // Daily at 2 AM
    metrics: [
      'on-time pickup rate',
      'on-time delivery rate',
      'cancellation rate',
      'exception MTTR',
    ],
    lastRun: null,
  });
}

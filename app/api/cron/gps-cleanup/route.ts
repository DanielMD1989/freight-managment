/**
 * GPS Data Cleanup Cron Job
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 * Task: Schedule GPS data cleanup job (90-day retention)
 *
 * Should be called daily by external cron service
 *
 * POST /api/cron/gps-cleanup
 */

import { NextRequest, NextResponse } from 'next/server';
import { deleteOldPositions } from '@/lib/gpsQuery';

/**
 * GPS data cleanup cron endpoint
 *
 * Deletes GPS positions older than 90 days
 *
 * Security: Protected by CRON_SECRET - required in all environments
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (REQUIRED - not optional)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // SECURITY: Always require CRON_SECRET - never allow unauthenticated access
    if (!cronSecret) {
      console.error('[GPS Cleanup] CRON_SECRET environment variable not set');
      return NextResponse.json(
        { error: 'Server misconfigured - CRON_SECRET required' },
        { status: 500 }
      );
    }

    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[GPS Cleanup] Starting data retention cleanup...');

    // Delete positions older than 90 days
    const daysToKeep = 90;
    const deletedCount = await deleteOldPositions(daysToKeep);

    console.log(`[GPS Cleanup] Deleted ${deletedCount} old GPS positions`);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      deletedPositions: deletedCount,
      retentionDays: daysToKeep,
    });
  } catch (error) {
    console.error('[GPS Cleanup] Error:', error);

    return NextResponse.json(
      {
        error: 'GPS cleanup failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * GET endpoint for testing (development only)
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  }

  // Same logic as POST for testing
  return POST(request);
}

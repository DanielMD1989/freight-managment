/**
 * GPS Monitoring Cron Job
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 * Task: Background GPS monitoring cron job
 *
 * Should be called every 30 seconds by external cron service
 *
 * POST /api/cron/gps-monitor
 */

import { NextRequest, NextResponse } from 'next/server';
import { pollAllGpsDevices, checkForOfflineTrucks } from '@/lib/gpsMonitoring';
import { triggerGpsOfflineAlerts } from '@/lib/gpsAlerts';

/**
 * GPS monitoring cron endpoint
 *
 * Security: Should be protected by cron secret in production
 */
export async function POST(request: NextRequest) {
  try {
    // Verify cron secret (production security)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[GPS Monitor] Starting GPS device polling...');

    // Poll all GPS devices
    const pollingSummary = await pollAllGpsDevices();

    console.log('[GPS Monitor] Polling complete:', pollingSummary);

    // Check for newly offline trucks
    const offlineTruckIds = await checkForOfflineTrucks();

    console.log(
      `[GPS Monitor] Found ${offlineTruckIds.length} offline trucks with active loads`
    );

    // Trigger alerts for offline trucks
    if (offlineTruckIds.length > 0) {
      await triggerGpsOfflineAlerts(offlineTruckIds);
      console.log('[GPS Monitor] Offline alerts triggered');
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      polling: pollingSummary,
      offlineAlerts: offlineTruckIds.length,
    });
  } catch (error) {
    console.error('[GPS Monitor] Error:', error);

    return NextResponse.json(
      {
        error: 'GPS monitoring failed',
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

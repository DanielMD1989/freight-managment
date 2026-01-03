/**
 * Cron Job: Auto-Settle Loads
 * Sprint 5 - Story 5.4: Settlement Automation
 *
 * Automatically settle completed loads with POD verification
 */

import { NextRequest, NextResponse } from 'next/server';
import { autoSettleCompletedLoads } from '@/lib/loadAutomation';

export async function POST(request: NextRequest) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Run settlement
    const result = await autoSettleCompletedLoads();

    return NextResponse.json({
      success: result.success,
      settledCount: result.settledCount || 0,
      totalFound: result.totalFound || 0,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error in auto-settle cron:', error);
    return NextResponse.json(
      {
        error: 'Failed to auto-settle loads',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'auto-settle',
    description: 'Automatically settles completed loads that have POD verification',
    schedule: '0 3 * * *', // Daily at 3 AM
    lastRun: null,
  });
}

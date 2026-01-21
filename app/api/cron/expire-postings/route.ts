/**
 * Cron Job: Expire Truck Postings and Requests
 *
 * Run daily to:
 * 1. Expire truck postings that have passed availableTo or expiresAt
 * 2. Expire pending load/truck requests that have passed expiresAt
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  expireOldTruckPostings,
  expireOldRequests,
} from '@/lib/truckPostingAutomation';

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

    // Run expirations
    const [postingsResult, requestsResult] = await Promise.all([
      expireOldTruckPostings(),
      expireOldRequests(),
    ]);

    return NextResponse.json({
      success: postingsResult.success && requestsResult.success,
      timestamp: new Date().toISOString(),
      postings: {
        expiredCount: postingsResult.expiredCount,
        details: postingsResult.details,
        error: postingsResult.error,
      },
      requests: {
        loadRequestsExpired: requestsResult.loadRequestsExpired,
        truckRequestsExpired: requestsResult.truckRequestsExpired,
        error: requestsResult.error,
      },
    });
  } catch (error) {
    console.error('Error in expire-postings cron:', error);
    return NextResponse.json(
      {
        error: 'Failed to expire postings',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    name: 'expire-postings',
    description: 'Expires truck postings and pending requests that have passed their expiry dates',
    schedule: '0 3 * * *', // Daily at 3 AM
    tasks: [
      'Expire ACTIVE truck postings where availableTo < now',
      'Expire ACTIVE truck postings where expiresAt < now',
      'Expire PENDING load requests where expiresAt < now',
      'Expire PENDING truck requests where expiresAt < now',
    ],
    lastRun: null,
  });
}

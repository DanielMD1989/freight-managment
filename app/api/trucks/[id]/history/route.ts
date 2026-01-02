/**
 * Truck GPS History API
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 *
 * Get GPS position history for a truck
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getPositionHistory } from '@/lib/gpsQuery';

/**
 * GET /api/trucks/[id]/history?start=&end=&limit=
 *
 * Get GPS position history for a truck within a date range
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: truckId } = await params;
    await requireAuth();

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const limitParam = searchParams.get('limit');

    // Default to last 24 hours if no dates provided
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const startDate = startParam ? new Date(startParam) : defaultStart;
    const endDate = endParam ? new Date(endParam) : now;
    const limit = limitParam ? parseInt(limitParam) : 1000;

    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400 }
      );
    }

    if (startDate > endDate) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400 }
      );
    }

    const positions = await getPositionHistory(truckId, startDate, endDate, limit);

    return NextResponse.json({
      positions,
      count: positions.length,
      startDate,
      endDate,
    });
  } catch (error) {
    console.error('Get truck GPS history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

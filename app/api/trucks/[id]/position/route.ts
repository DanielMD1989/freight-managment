/**
 * Truck GPS Position API
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 *
 * Get latest GPS position for a truck
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLatestPosition } from '@/lib/gpsQuery';

/**
 * GET /api/trucks/[id]/position
 *
 * Get latest GPS position for a truck
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: truckId } = await params;
    await requireAuth();

    const position = await getLatestPosition(truckId);

    if (!position) {
      return NextResponse.json(
        { error: 'No GPS position data found for this truck' },
        { status: 404 }
      );
    }

    return NextResponse.json({ position });
  } catch (error) {
    console.error('Get truck position error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

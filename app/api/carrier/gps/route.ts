/**
 * Carrier GPS API
 *
 * Fetch GPS tracking data for carrier's trucks.
 * Used for auto-refresh functionality on GPS tracking page.
 */

import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

/**
 * GET /api/carrier/gps
 *
 * Get all trucks with GPS devices for the carrier's organization
 */
export async function GET() {
  try {
    const session = await requireAuth();

    // Only carriers and admins can access GPS data
    if (session.role !== 'CARRIER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Unauthorized - Carrier access required' },
        { status: 403 }
      );
    }

    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'No organization found' },
        { status: 400 }
      );
    }

    // Fetch trucks with GPS devices
    const trucks = await db.truck.findMany({
      where: {
        carrierId: session.organizationId,
      },
      select: {
        id: true,
        licensePlate: true,
        truckType: true,
        isAvailable: true,
        currentCity: true,
        gpsDevice: {
          select: {
            id: true,
            imei: true,
            status: true,
            lastSeenAt: true,
          },
        },
      },
      orderBy: {
        licensePlate: 'asc',
      },
    });

    return NextResponse.json({
      trucks,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Get carrier GPS error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Load GPS History API
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 *
 * Get all GPS positions for a load (tracking history)
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { getLoadPositions, calculateTripDistance } from '@/lib/gpsQuery';
import { db } from '@/lib/db';

/**
 * GET /api/loads/[id]/gps-history
 *
 * Get complete GPS tracking history for a load
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: loadId } = await params;
    const session = await requireAuth();

    // Check if user has permission to view this load's GPS history
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        shipperId: true,
        trackingEnabled: true,
        assignedTruck: {
          select: {
            carrierId: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json({ error: 'Load not found' }, { status: 404 });
    }

    // Check permissions
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: {
        organizationId: true,
        role: true,
      },
    });

    const isShipper = user?.organizationId === load.shipperId;
    const isCarrier = user?.organizationId === load.assignedTruck?.carrierId;
    const isAdmin = session.role === 'ADMIN' || session.role === 'PLATFORM_OPS' || session.role === 'DISPATCHER';

    if (!isShipper && !isCarrier && !isAdmin) {
      return NextResponse.json(
        { error: 'Unauthorized to view GPS history for this load' },
        { status: 403 }
      );
    }

    if (!load.trackingEnabled) {
      return NextResponse.json(
        { error: 'GPS tracking is not enabled for this load' },
        { status: 400 }
      );
    }

    // Get all GPS positions for this load
    const positions = await getLoadPositions(loadId);

    // Calculate total distance from GPS
    const actualTripKm = calculateTripDistance(positions);

    return NextResponse.json({
      loadId,
      positions,
      count: positions.length,
      actualTripKm,
      trackingEnabled: load.trackingEnabled,
    });
  } catch (error) {
    console.error('Get load GPS history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTrackingStatus } from '@/lib/gpsTracking';

/**
 * GET /api/tracking/[trackingId]
 *
 * Public endpoint for accessing GPS tracking via unique tracking URL
 *
 * Sprint 16 - Story 16.3: GPS Live Tracking
 *
 * This endpoint is PUBLIC - no authentication required
 * The trackingId itself is the security token
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    const { trackingId } = await params;
    const trackingUrl = `/tracking/${trackingId}`;

    // Find load by tracking URL
    const load = await db.load.findUnique({
      where: { trackingUrl },
      select: {
        id: true,
        status: true,
        pickupCity: true,
        deliveryCity: true,
        pickupDate: true,
        deliveryDate: true,
        truckType: true,
        weight: true,
        originLat: true,
        originLon: true,
        destinationLat: true,
        destinationLon: true,
        trackingEnabled: true,
        trackingStartedAt: true,
        shipper: {
          select: {
            name: true,
          },
        },
        assignedTruck: {
          select: {
            licensePlate: true,
            gpsStatus: true,
            gpsLastSeenAt: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Tracking link not found or expired' },
        { status: 404 }
      );
    }

    // Check if tracking is enabled
    if (!load.trackingEnabled) {
      return NextResponse.json(
        { error: 'GPS tracking has been disabled for this load' },
        { status: 403 }
      );
    }

    // Get tracking status
    const trackingStatus = await getTrackingStatus(load.id);

    return NextResponse.json({
      load,
      tracking: trackingStatus,
    });
  } catch (error) {
    console.error('Get public tracking error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getTrackingStatus } from '@/lib/gpsTracking';
import { checkRpsLimit, RPS_CONFIGS } from '@/lib/rateLimit';

/**
 * GET /api/tracking/[trackingId]
 *
 * Public endpoint for accessing GPS tracking via unique tracking URL
 *
 * Sprint 16 - Story 16.3: GPS Live Tracking
 *
 * HIGH FIX #11: Rate limiting added to public endpoint
 *
 * Security Model:
 * - This endpoint is PUBLIC - no authentication required
 * - The trackingId itself is the security token (unguessable UUID)
 * - Rate limiting prevents abuse (30 RPS with 10 burst per IP)
 * - Tracking URLs are cryptographically random (24 hex chars)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trackingId: string }> }
) {
  try {
    // HIGH FIX #11: Apply rate limiting to public endpoint
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    const rateLimitResult = await checkRpsLimit(
      'tracking',
      ip,
      30, // 30 requests per second
      10  // 10 burst
    );

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.', retryAfter: 1 },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'Retry-After': '1',
          },
        }
      );
    }

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

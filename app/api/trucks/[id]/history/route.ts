/**
 * Truck GPS History API
 *
 * Sprint 16 - Story 16.8: GPS Data Storage & Background Monitoring
 *
 * Get GPS position history for a truck
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { getPositionHistory } from '@/lib/gpsQuery';
import { checkRpsLimit, RPS_CONFIGS } from '@/lib/rateLimit';

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
    // Rate limiting: GPS endpoints need higher limits for real-time tracking
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rpsResult = await checkRpsLimit(
      RPS_CONFIGS.gps.endpoint,
      ip,
      RPS_CONFIGS.gps.rps,
      RPS_CONFIGS.gps.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', retryAfter: 1 },
        { status: 429, headers: { 'Retry-After': '1' } }
      );
    }

    const { id: truckId } = await params;
    const session = await requireAuth();

    // Verify truck exists and user has access
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: { id: true, carrierId: true },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    // Check ownership: carrier who owns truck, shipper with active load, or admin
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isOwner = user?.organizationId === truck.carrierId;
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

    // Shippers can view history if truck is on their active load
    let isShipperWithActiveLoad = false;
    if (user?.role === 'SHIPPER' && user?.organizationId) {
      const activeLoad = await db.load.findFirst({
        where: {
          assignedTruckId: truckId,
          shipperId: user.organizationId,
          status: 'IN_TRANSIT',
        },
      });
      isShipperWithActiveLoad = !!activeLoad;
    }

    if (!isOwner && !isAdmin && !isShipperWithActiveLoad) {
      return NextResponse.json(
        { error: 'You do not have permission to view this truck\'s GPS history' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');
    const limitParam = searchParams.get('limit');

    // Default to last 24 hours if no dates provided
    const now = new Date();
    const defaultStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const startDate = startParam ? new Date(startParam) : defaultStart;
    const endDate = endParam ? new Date(endParam) : now;
    const limit = Math.min(limitParam ? parseInt(limitParam) : 1000, 1000);

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

    // Limit date range to 7 days max to prevent excessive queries
    const maxRangeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
    if (endDate.getTime() - startDate.getTime() > maxRangeMs) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 7 days' },
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

/**
 * GPS History API
 *
 * GET /api/gps/history - Get GPS position history for a trip/load or truck
 *
 * Query params:
 * - loadId: Get history for a specific load/trip
 * - truckId: Get history for a specific truck
 * - from: Start date (ISO string)
 * - to: End date (ISO string)
 * - limit: Max positions to return (default 1000)
 *
 * MAP + GPS Implementation - Phase 2
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const loadId = searchParams.get('loadId');
    const truckId = searchParams.get('truckId');
    const from = searchParams.get('from');
    const to = searchParams.get('to');
    const limit = parseInt(searchParams.get('limit') || '1000', 10);

    if (!loadId && !truckId) {
      return NextResponse.json(
        { error: 'Either loadId or truckId is required' },
        { status: 400 }
      );
    }

    // Get user's organization for access control
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    // Build where clause
    const where: any = {};

    if (loadId) {
      // Verify access to load
      const load = await db.load.findUnique({
        where: { id: loadId },
        select: {
          id: true,
          shipperId: true,
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

      // Access control
      if (session.role === 'CARRIER') {
        if (load.assignedTruck?.carrierId !== user?.organizationId) {
          return NextResponse.json(
            { error: 'You do not have access to this load' },
            { status: 403 }
          );
        }
      } else if (session.role === 'SHIPPER') {
        if (load.shipperId !== user?.organizationId) {
          return NextResponse.json(
            { error: 'You do not have access to this load' },
            { status: 403 }
          );
        }
      }
      // Admin/Dispatcher can access any load

      where.loadId = loadId;
    }

    if (truckId) {
      // Verify access to truck
      if (session.role === 'CARRIER') {
        if (!user?.organizationId) {
          return NextResponse.json(
            { error: 'User not associated with an organization' },
            { status: 403 }
          );
        }

        const truck = await db.truck.findFirst({
          where: {
            id: truckId,
            carrierId: user.organizationId,
          },
        });

        if (!truck) {
          return NextResponse.json(
            { error: 'Truck not found or access denied' },
            { status: 403 }
          );
        }
      } else if (session.role === 'SHIPPER') {
        // Shipper cannot access truck history directly
        return NextResponse.json(
          { error: 'Shippers cannot access truck history directly' },
          { status: 403 }
        );
      }
      // Admin/Dispatcher can access any truck

      where.truckId = truckId;
    }

    // Date range filter
    if (from || to) {
      where.timestamp = {};
      if (from) {
        where.timestamp.gte = new Date(from);
      }
      if (to) {
        where.timestamp.lte = new Date(to);
      }
    }

    // Fetch GPS positions
    const positions = await db.gpsPosition.findMany({
      where,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        speed: true,
        heading: true,
        altitude: true,
        accuracy: true,
        timestamp: true,
        loadId: true,
        truckId: true,
      },
      orderBy: {
        timestamp: 'asc',
      },
      take: Math.min(limit, 5000), // Hard cap at 5000
    });

    // Transform for response
    const history = positions.map((pos) => ({
      id: pos.id,
      lat: Number(pos.latitude),
      lng: Number(pos.longitude),
      speed: pos.speed ? Number(pos.speed) : null,
      heading: pos.heading ? Number(pos.heading) : null,
      altitude: pos.altitude ? Number(pos.altitude) : null,
      accuracy: pos.accuracy ? Number(pos.accuracy) : null,
      timestamp: pos.timestamp.toISOString(),
      loadId: pos.loadId,
      truckId: pos.truckId,
    }));

    // Calculate route statistics
    let totalDistance = 0;
    let totalTime = 0;
    let avgSpeed = 0;

    if (history.length > 1) {
      for (let i = 1; i < history.length; i++) {
        const prev = history[i - 1];
        const curr = history[i];

        // Haversine distance
        const R = 6371; // Earth radius in km
        const dLat = ((curr.lat - prev.lat) * Math.PI) / 180;
        const dLon = ((curr.lng - prev.lng) * Math.PI) / 180;
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((prev.lat * Math.PI) / 180) *
            Math.cos((curr.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        totalDistance += R * c;
      }

      const startTime = new Date(history[0].timestamp).getTime();
      const endTime = new Date(history[history.length - 1].timestamp).getTime();
      totalTime = (endTime - startTime) / 1000 / 60 / 60; // in hours

      if (totalTime > 0) {
        avgSpeed = totalDistance / totalTime;
      }
    }

    return NextResponse.json({
      positions: history,
      count: history.length,
      stats: {
        totalDistanceKm: Math.round(totalDistance * 100) / 100,
        totalTimeHours: Math.round(totalTime * 100) / 100,
        avgSpeedKmh: Math.round(avgSpeed * 100) / 100,
        startTime: history.length > 0 ? history[0].timestamp : null,
        endTime: history.length > 0 ? history[history.length - 1].timestamp : null,
      },
    });
  } catch (error) {
    console.error('GPS history error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

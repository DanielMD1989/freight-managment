/**
 * Dispatcher Dashboard API
 *
 * GET /api/dispatcher/dashboard
 *
 * Provides dashboard statistics for dispatcher portal
 * Sprint 20 - Dashboard optimization: move stats calculation server-side
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/dispatcher/dashboard
 *
 * Returns dispatcher-specific statistics calculated server-side:
 * - Posted (unassigned) loads count
 * - Assigned loads count
 * - In-transit loads count
 * - Available trucks count
 * - Deliveries today count
 * - On-time delivery rate
 * - Alert count (late loads)
 * - Today's pickups
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check if user is a dispatcher, admin, or super admin
    if (
      session.role !== 'DISPATCHER' &&
      session.role !== 'ADMIN' &&
      session.role !== 'SUPER_ADMIN'
    ) {
      return NextResponse.json(
        { error: 'Access denied. Dispatcher role required.' },
        { status: 403 }
      );
    }

    // Get today's date boundaries
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Get statistics in parallel
    const [
      postedLoads,
      assignedLoads,
      inTransitLoads,
      availableTrucks,
      deliveriesToday,
      deliveredLoads,
      lateLoads,
      pickupsToday,
    ] = await Promise.all([
      // Posted (unassigned) loads
      db.load.count({
        where: { status: 'POSTED' },
      }),

      // Assigned loads
      db.load.count({
        where: { status: 'ASSIGNED' },
      }),

      // In-transit loads
      db.load.count({
        where: { status: 'IN_TRANSIT' },
      }),

      // Available trucks (active postings)
      db.truckPosting.count({
        where: { status: 'ACTIVE' },
      }),

      // Deliveries scheduled today
      db.load.count({
        where: {
          deliveryDate: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: {
            in: ['ASSIGNED', 'IN_TRANSIT', 'DELIVERED'],
          },
        },
      }),

      // Delivered loads (for on-time rate calculation) - last 30 days
      db.load.findMany({
        where: {
          status: { in: ['DELIVERED', 'COMPLETED'] },
          updatedAt: {
            gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          },
        },
        select: {
          id: true,
          deliveryDate: true,
          updatedAt: true,
        },
      }),

      // Late loads (alerts) - past due delivery date, not delivered/completed/cancelled
      db.load.count({
        where: {
          status: {
            notIn: ['DELIVERED', 'COMPLETED', 'CANCELLED'],
          },
          deliveryDate: {
            lt: new Date(),
          },
        },
      }),

      // Today's pickups
      db.load.findMany({
        where: {
          pickupDate: {
            gte: todayStart,
            lte: todayEnd,
          },
          status: {
            in: ['POSTED', 'ASSIGNED'],
          },
        },
        select: {
          id: true,
          pickupCity: true,
          deliveryCity: true,
          pickupDate: true,
          status: true,
          truckType: true,
        },
        orderBy: {
          pickupDate: 'asc',
        },
        take: 10,
      }),
    ]);

    // Calculate on-time rate (using updatedAt as completion timestamp)
    const onTimeDeliveries = deliveredLoads.filter((load) => {
      if (!load.deliveryDate || !load.updatedAt) return true;
      return new Date(load.updatedAt) <= new Date(load.deliveryDate);
    }).length;

    const onTimeRate =
      deliveredLoads.length > 0
        ? Math.round((onTimeDeliveries / deliveredLoads.length) * 100)
        : 100;

    return NextResponse.json({
      stats: {
        postedLoads,
        assignedLoads,
        inTransitLoads,
        availableTrucks,
        deliveriesToday,
        onTimeRate,
        alertCount: lateLoads,
      },
      pickupsToday,
    });
  } catch (error) {
    console.error('Dispatcher dashboard error:', error);

    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}

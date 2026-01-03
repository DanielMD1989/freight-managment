/**
 * Platform Metrics API
 *
 * Sprint 16 - Story 16.9A: SuperAdmin Tools
 * Task 16.9A.8: Platform Metrics Dashboard
 *
 * SuperAdmin endpoint to view comprehensive platform metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, Permission } from '@/lib/rbac';
import { db } from '@/lib/db';

/**
 * GET /api/admin/platform-metrics
 *
 * Get comprehensive platform metrics and statistics
 */
export async function GET(request: NextRequest) {
  try {
    await requirePermission(Permission.MANAGE_USERS); // SuperAdmin only

    // Fetch all metrics in parallel for performance
    const [
      // User & Organization Metrics
      totalUsers,
      activeUsers,
      totalOrganizations,
      verifiedOrganizations,
      carrierOrgs,
      shipperOrgs,

      // Load Metrics
      totalLoads,
      activeLoads,
      completedLoads,
      cancelledLoads,

      // Truck Metrics
      totalTrucks,
      activeTrucks,

      // Financial Metrics
      totalRevenue,
      pendingSettlements,
      paidSettlements,

      // Activity Metrics (last 7 days)
      recentLogins,
      recentLoads,

      // Trust & Quality Metrics
      flaggedOrganizations,
      disputeCount,
      bypassAttempts,

    ] = await Promise.all([
      // Users
      db.user.count(),
      db.user.count({ where: { isActive: true } }),

      // Organizations
      db.organization.count(),
      db.organization.count({ where: { isVerified: true } }),
      db.organization.count({ where: { type: 'CARRIER' } }),
      db.organization.count({ where: { type: 'SHIPPER' } }),

      // Loads
      db.load.count(),
      db.load.count({
        where: {
          status: {
            in: ['IN_TRANSIT', 'PICKUP_PENDING', 'ASSIGNED'],
          },
        },
      }),
      db.load.count({ where: { status: 'DELIVERED' } }),
      db.load.count({ where: { status: 'CANCELLED' } }),

      // Trucks
      db.truck.count(),
      db.truck.count({ where: { isAvailable: true } }),

      // Financial
      db.settlementRecord.aggregate({
        _sum: { grossAmount: true },
      }),
      db.load.count({
        where: {
          settlementStatus: 'PENDING',
          podVerified: true,
        },
      }),
      db.load.count({ where: { settlementStatus: 'PAID' } }),

      // Recent Activity (last 7 days)
      db.auditLog.count({
        where: {
          eventType: 'AUTH_LOGIN_SUCCESS',
          timestamp: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
      db.load.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Trust Metrics
      db.organization.count({ where: { isFlagged: true } }),
      db.dispute.count(),
      db.organization.aggregate({
        _sum: { bypassAttemptCount: true },
      }),
    ]);

    // Calculate derived metrics
    const userActiveRate = totalUsers > 0 ? (activeUsers / totalUsers) * 100 : 0;
    const orgVerificationRate =
      totalOrganizations > 0
        ? (verifiedOrganizations / totalOrganizations) * 100
        : 0;
    const loadCompletionRate =
      totalLoads > 0 ? (completedLoads / totalLoads) * 100 : 0;
    const loadCancellationRate =
      totalLoads > 0 ? (cancelledLoads / totalLoads) * 100 : 0;

    // Get top event types from audit logs
    const topEvents = await db.auditLog.groupBy({
      by: ['eventType'],
      _count: {
        eventType: true,
      },
      orderBy: {
        _count: {
          eventType: 'desc',
        },
      },
      take: 5,
    });

    // Get load status breakdown
    const loadsByStatus = await db.load.groupBy({
      by: ['status'],
      _count: {
        status: true,
      },
    });

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      metrics: {
        users: {
          total: totalUsers,
          active: activeUsers,
          activeRate: userActiveRate,
        },
        organizations: {
          total: totalOrganizations,
          verified: verifiedOrganizations,
          verificationRate: orgVerificationRate,
          carriers: carrierOrgs,
          shippers: shipperOrgs,
        },
        loads: {
          total: totalLoads,
          active: activeLoads,
          completed: completedLoads,
          cancelled: cancelledLoads,
          completionRate: loadCompletionRate,
          cancellationRate: loadCancellationRate,
          byStatus: loadsByStatus.map((item) => ({
            status: item.status,
            count: item._count.status,
          })),
        },
        trucks: {
          total: totalTrucks,
          active: activeTrucks,
        },
        financial: {
          totalRevenue: Number(totalRevenue._sum.grossAmount || 0),
          pendingSettlements: pendingSettlements,
          paidSettlements: paidSettlements,
        },
        activity: {
          recentLogins: recentLogins,
          recentLoads: recentLoads,
          topEvents: topEvents.map((item) => ({
            eventType: item.eventType,
            count: item._count.eventType,
          })),
        },
        trust: {
          flaggedOrganizations: flaggedOrganizations,
          disputes: disputeCount,
          bypassAttempts: Number(bypassAttempts._sum.bypassAttemptCount || 0),
        },
      },
    });
  } catch (error) {
    console.error('Get platform metrics error:', error);

    if (error instanceof Error && error.name === 'ForbiddenError') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

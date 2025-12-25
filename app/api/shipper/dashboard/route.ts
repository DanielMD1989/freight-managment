/**
 * Shipper Dashboard API
 *
 * GET /api/shipper/dashboard
 *
 * Provides dashboard statistics for shipper portal
 * Sprint 11 - Story 11.1: Shipper Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/shipper/dashboard
 *
 * Returns:
 * - Total loads posted
 * - Active loads
 * - Completed loads
 * - Loads by status
 * - Wallet balance
 * - Pending matches
 * - Recent activity
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check if user is a shipper or admin
    if (session.role !== 'SHIPPER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Shipper role required.' },
        { status: 403 }
      );
    }

    // Check if user has an organization
    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization to access shipper features.' },
        { status: 400 }
      );
    }

    // Get statistics in parallel
    const [
      totalLoads,
      activeLoads,
      completedLoads,
      loadsByStatus,
      walletAccount,
      recentLoads,
    ] = await Promise.all([
      // Total loads
      db.load.count({
        where: { shipperId: session.organizationId },
      }),

      // Active loads (POSTED, MATCHED, IN_TRANSIT)
      db.load.count({
        where: {
          shipperId: session.organizationId,
          status: {
            in: ['POSTED', 'MATCHED', 'IN_TRANSIT'],
          },
        },
      }),

      // Completed loads
      db.load.count({
        where: {
          shipperId: session.organizationId,
          status: 'COMPLETED',
        },
      }),

      // Loads by status
      db.load.groupBy({
        by: ['status'],
        where: { shipperId: session.organizationId },
        _count: true,
      }),

      // Wallet account
      db.financialAccount.findFirst({
        where: {
          organizationId: session.organizationId,
          accountType: 'SHIPPER_WALLET',
        },
        select: {
          balance: true,
          currency: true,
        },
      }),

      // Recent loads (last 7 days)
      db.load.count({
        where: {
          shipperId: session.organizationId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // Get pending matches count (loads that are POSTED and have available trucks)
    const postedLoads = await db.load.count({
      where: {
        shipperId: session.organizationId,
        status: 'POSTED',
      },
    });

    return NextResponse.json({
      totalLoads,
      activeLoads,
      completedLoads,
      cancelledLoads: loadsByStatus.find((s) => s.status === 'CANCELLED')?._count || 0,
      loadsByStatus: loadsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      wallet: {
        balance: walletAccount?.balance || 0,
        currency: walletAccount?.currency || 'ETB',
      },
      pendingMatches: postedLoads,
      recentLoads,
    });
  } catch (error) {
    console.error('Shipper dashboard error:', error);

    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}

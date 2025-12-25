/**
 * Carrier Dashboard API
 *
 * GET /api/carrier/dashboard
 *
 * Provides dashboard statistics for carrier portal
 * Sprint 12 - Story 12.1: Carrier Dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';

/**
 * GET /api/carrier/dashboard
 *
 * Returns:
 * - Total trucks in fleet
 * - Active postings
 * - Completed deliveries
 * - Truck utilization stats
 * - Wallet balance
 * - Pending loads
 * - Recent activity
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Check if user is a carrier or admin
    if (session.role !== 'CARRIER' && session.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Access denied. Carrier role required.' },
        { status: 403 }
      );
    }

    // Check if user has an organization
    if (!session.organizationId) {
      return NextResponse.json(
        { error: 'You must belong to an organization to access carrier features.' },
        { status: 400 }
      );
    }

    // Get statistics in parallel
    const [
      totalTrucks,
      activePostings,
      completedDeliveries,
      totalRevenue,
      walletAccount,
      recentPostings,
      trucksByStatus,
    ] = await Promise.all([
      // Total trucks
      db.truck.count({
        where: { carrierId: session.organizationId },
      }),

      // Active postings (POSTED status)
      db.truckPosting.count({
        where: {
          truck: {
            carrierId: session.organizationId,
          },
          status: 'POSTED',
        },
      }),

      // Completed deliveries
      db.load.count({
        where: {
          status: 'COMPLETED',
          // TODO: Add carrierId field to Load model for proper tracking
          // For now, we'll use a workaround
        },
      }),

      // Total revenue from completed loads
      db.load.aggregate({
        where: {
          status: 'COMPLETED',
          // TODO: Filter by carrier's loads
        },
        _sum: {
          rate: true,
        },
      }),

      // Wallet account
      db.financialAccount.findFirst({
        where: {
          organizationId: session.organizationId,
          accountType: 'CARRIER_WALLET',
        },
        select: {
          balance: true,
          currency: true,
        },
      }),

      // Recent postings (last 7 days)
      db.truckPosting.count({
        where: {
          truck: {
            carrierId: session.organizationId,
          },
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Trucks by status
      db.truck.groupBy({
        by: ['status'],
        where: { carrierId: session.organizationId },
        _count: true,
      }),
    ]);

    // Calculate active trucks (ACTIVE or IN_TRANSIT)
    const activeTrucks = trucksByStatus
      .filter((s) => s.status === 'ACTIVE' || s.status === 'IN_TRANSIT')
      .reduce((sum, s) => sum + s._count, 0);

    return NextResponse.json({
      totalTrucks,
      activeTrucks,
      activePostings,
      completedDeliveries,
      totalRevenue: Number(totalRevenue._sum.rate || 0),
      wallet: {
        balance: walletAccount?.balance || 0,
        currency: walletAccount?.currency || 'ETB',
      },
      recentPostings,
      trucksByStatus: trucksByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
    });
  } catch (error) {
    console.error('Carrier dashboard error:', error);

    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}

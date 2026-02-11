/**
 * Shipper Dashboard API
 *
 * GET /api/shipper/dashboard
 *
 * Provides dashboard statistics for shipper portal
 * Sprint 11 - Story 11.1: Shipper Dashboard
 *
 * AGGREGATION NOTE (2026-02-08):
 * Spending aggregation logic duplicates lib/aggregation.ts:getShipperSpendingSummary().
 * This is acceptable for now as the dashboard has additional requirements.
 * New aggregation logic should use lib/aggregation.ts as the single source of truth.
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

    // H16 FIX: Verify user actually belongs to claimed organization
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    if (!user || user.organizationId !== session.organizationId) {
      return NextResponse.json(
        { error: 'Session organization mismatch' },
        { status: 403 }
      );
    }

    // Start of current month for "this month" queries
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);

    // Get statistics in parallel
    const [
      totalLoads,
      activeLoads,
      inTransitLoads,
      deliveredLoads,
      totalSpentResult,
      pendingPaymentsResult,
      loadsByStatus,
      walletAccount,
    ] = await Promise.all([
      // Total loads
      db.load.count({
        where: { shipperId: session.organizationId },
      }),

      // Active loads (POSTED, ASSIGNED - not counting IN_TRANSIT separately)
      db.load.count({
        where: {
          shipperId: session.organizationId,
          status: { in: ['POSTED', 'ASSIGNED'] },
        },
      }),

      // In-transit loads
      db.load.count({
        where: {
          shipperId: session.organizationId,
          status: 'IN_TRANSIT',
        },
      }),

      // Delivered this month (DELIVERED + COMPLETED)
      db.load.count({
        where: {
          shipperId: session.organizationId,
          status: { in: ['DELIVERED', 'COMPLETED'] },
          updatedAt: { gte: startOfMonth },
        },
      }),

      // Total spent: sum of shipperServiceFee where fee was deducted
      db.load.aggregate({
        where: {
          shipperId: session.organizationId,
          shipperFeeStatus: 'DEDUCTED',
        },
        _sum: { shipperServiceFee: true },
      }),

      // Pending payments: sum of shipperServiceFee for reserved (in-progress) loads
      db.load.aggregate({
        where: {
          shipperId: session.organizationId,
          shipperFeeStatus: 'RESERVED',
        },
        _sum: { shipperServiceFee: true },
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
    ]);

    const totalSpent = Number(totalSpentResult._sum?.shipperServiceFee || 0);
    const pendingPayments = Number(pendingPaymentsResult._sum?.shipperServiceFee || 0);

    return NextResponse.json({
      stats: {
        totalLoads,
        activeLoads,
        inTransitLoads,
        deliveredLoads,
        totalSpent,
        pendingPayments,
      },
      loadsByStatus: loadsByStatus.map((s) => ({
        status: s.status,
        count: s._count,
      })),
      wallet: {
        balance: Number(walletAccount?.balance || 0),
        currency: walletAccount?.currency || 'ETB',
      },
    });
  } catch (error) {
    console.error('Shipper dashboard error:', error);

    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}

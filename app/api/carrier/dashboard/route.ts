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
 * Returns carrier-specific statistics using Trip model for accurate data:
 * - Total trucks in fleet (filtered by carrierId)
 * - Active trucks available for work
 * - Active postings
 * - Completed deliveries (from Trip model, filtered by carrierId)
 * - In-transit trips
 * - Total revenue (from Trip model, filtered by carrierId)
 * - Total distance traveled
 * - Wallet balance
 * - Recent postings
 * - Pending truck approvals
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

    // Get statistics in parallel using Trip model for carrier-specific data
    const [
      totalTrucks,
      activeTrucks,
      activePostings,
      completedTrips,
      inTransitTrips,
      tripStats,
      walletAccount,
      recentPostings,
      pendingApprovals,
    ] = await Promise.all([
      // Total trucks owned by this carrier
      db.truck.count({
        where: { carrierId: session.organizationId },
      }),

      // Active trucks (available for work)
      db.truck.count({
        where: {
          carrierId: session.organizationId,
          isAvailable: true,
        },
      }),

      // Active postings (ACTIVE status)
      db.truckPosting.count({
        where: {
          carrierId: session.organizationId,
          status: 'ACTIVE',
        },
      }),

      // Completed deliveries - using Trip model with carrierId filter
      db.trip.count({
        where: {
          carrierId: session.organizationId,
          status: { in: ['DELIVERED', 'COMPLETED'] },
        },
      }),

      // In-transit trips
      db.trip.count({
        where: {
          carrierId: session.organizationId,
          status: 'IN_TRANSIT',
        },
      }),

      // Trip stats - distance only (revenue not implemented)
      db.trip.aggregate({
        where: {
          carrierId: session.organizationId,
          status: { in: ['DELIVERED', 'COMPLETED'] },
        },
        _sum: {
          estimatedDistanceKm: true,
          actualDistanceKm: true,
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
          carrierId: session.organizationId,
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),

      // Trucks pending approval
      db.truck.count({
        where: {
          carrierId: session.organizationId,
          approvalStatus: 'PENDING',
        },
      }),
    ]);

    // Calculate total distance from trips
    const totalDistance = Number(tripStats._sum?.actualDistanceKm || tripStats._sum?.estimatedDistanceKm || 0);

    return NextResponse.json({
      totalTrucks,
      activeTrucks,
      activePostings,
      completedDeliveries: completedTrips,
      inTransitTrips,
      totalRevenue: 0, // Revenue tracking not implemented
      totalDistance,
      wallet: {
        balance: walletAccount?.balance || 0,
        currency: walletAccount?.currency || 'ETB',
      },
      recentPostings,
      pendingApprovals,
    });
  } catch (error) {
    console.error('Carrier dashboard error:', error);

    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}

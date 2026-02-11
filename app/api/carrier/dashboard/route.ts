/**
 * Carrier Dashboard API
 *
 * GET /api/carrier/dashboard
 *
 * Provides dashboard statistics for carrier portal
 * Sprint 12 - Story 12.1: Carrier Dashboard
 *
 * AGGREGATION NOTE (2026-02-08):
 * Earnings aggregation logic duplicates lib/aggregation.ts:getCarrierEarningsSummary().
 * This is acceptable for now as the dashboard has additional requirements.
 * New aggregation logic should use lib/aggregation.ts as the single source of truth.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { db } from '@/lib/db';
import { checkRpsLimit, RPS_CONFIGS } from '@/lib/rateLimit';

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
    // Rate limiting: Apply dashboard RPS limit
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';
    const rpsResult = await checkRpsLimit(
      RPS_CONFIGS.dashboard.endpoint,
      ip,
      RPS_CONFIGS.dashboard.rps,
      RPS_CONFIGS.dashboard.burst
    );
    if (!rpsResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please slow down.', retryAfter: 1 },
        {
          status: 429,
          headers: {
            'X-RateLimit-Limit': rpsResult.limit.toString(),
            'X-RateLimit-Remaining': rpsResult.remaining.toString(),
            'Retry-After': '1',
          },
        }
      );
    }

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
      revenueResult,
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

      // Trip stats - distance
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

      // Total service fees paid: sum of carrierServiceFee from completed loads (fees paid TO platform)
      db.load.aggregate({
        where: {
          assignedTruck: { carrierId: session.organizationId },
          status: { in: ['DELIVERED', 'COMPLETED'] },
          carrierFeeStatus: 'DEDUCTED',
        },
        _sum: { carrierServiceFee: true },
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
    // Preserve 2 decimal precision for financial values
    const rawFees = revenueResult._sum?.carrierServiceFee;
    const totalServiceFeesPaid = rawFees ? parseFloat(Number(rawFees).toFixed(2)) : 0;

    return NextResponse.json({
      totalTrucks,
      activeTrucks,
      activePostings,
      completedDeliveries: completedTrips,
      inTransitTrips,
      totalServiceFeesPaid,
      totalDistance,
      wallet: {
        balance: Number(walletAccount?.balance || 0),
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

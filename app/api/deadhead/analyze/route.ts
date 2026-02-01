/**
 * Sprint 6: Deadhead Analysis
 * Analyze deadhead metrics for loads and provide optimization insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { calculateDHO, calculateDHD, calculateDeadheadMetrics, getTruckCurrentLocation } from '@/lib/deadheadOptimization';
import { db } from '@/lib/db';

// POST /api/deadhead/analyze - Analyze deadhead for a specific scenario
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();
    const body = await request.json();

    const { truckId, loadId, nextLoadId } = body;

    if (!truckId || !loadId) {
      return NextResponse.json(
        { error: 'truckId and loadId are required' },
        { status: 400 }
      );
    }

    // Get truck location
    const truckLocation = await getTruckCurrentLocation(truckId);
    if (!truckLocation) {
      return NextResponse.json(
        { error: 'Truck location not available' },
        { status: 404 }
      );
    }

    // Get load details
    const load = await db.load.findUnique({
      where: { id: loadId },
      select: {
        id: true,
        pickupCity: true,
        deliveryCity: true,
        tripKm: true,
        originLat: true,
        originLon: true,
        destinationLat: true,
        destinationLon: true,
        pickupLocation: {
          select: {
            latitude: true,
            longitude: true,
          },
        },
        deliveryLocation: {
          select: {
            latitude: true,
            longitude: true,
          },
        },
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // Calculate DH-O
    const dho = await calculateDHO(truckId, loadId);
    if (dho === null) {
      return NextResponse.json(
        { error: 'Could not calculate DH-O' },
        { status: 400 }
      );
    }

    // Calculate DH-D (if nextLoadId provided)
    let dhd = 0;
    if (nextLoadId) {
      const calculatedDHD = await calculateDHD(loadId, nextLoadId);
      if (calculatedDHD !== null) {
        dhd = calculatedDHD;
      }
    }

    const tripKm = load.tripKm ? Number(load.tripKm) : 0;

    // Calculate metrics
    const metrics = calculateDeadheadMetrics(dho, dhd, tripKm);

    // Calculate total distance for efficiency metrics
    const totalDistance = dho + tripKm + dhd;
    const paidPercentage = totalDistance > 0 ? (tripKm / totalDistance) * 100 : 0;

    return NextResponse.json({
      analysis: {
        load: {
          id: loadId,
          route: `${load.pickupCity} → ${load.deliveryCity}`,
          tripKm,
        },
        deadhead: {
          dho: Math.round(dho * 10) / 10,
          dhd: Math.round(dhd * 10) / 10,
          total: Math.round((dho + dhd) * 10) / 10,
        },
        metrics: {
          ...metrics,
          paidPercentage: Math.round(paidPercentage * 10) / 10,
        },
        distance: {
          totalDistance: Math.round(totalDistance * 10) / 10,
        },
        recommendation: getRecommendation(metrics.efficiency, metrics.totalDeadheadPercent),
      },
    });

  } catch (error) {
    console.error('Deadhead analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze deadhead' },
      { status: 500 }
    );
  }
}

function getRecommendation(
  efficiency: 'excellent' | 'good' | 'acceptable' | 'poor',
  totalDeadheadPercent: number
): string {
  switch (efficiency) {
    case 'excellent':
      return 'Excellent opportunity! Minimal empty miles make this highly profitable.';
    case 'good':
      return 'Good load with reasonable deadhead. Should be profitable.';
    case 'acceptable':
      return `Acceptable load but ${Math.round(totalDeadheadPercent)}% deadhead. Consider looking for closer loads.`;
    case 'poor':
      return `High deadhead (${Math.round(totalDeadheadPercent)}%). Look for loads with better positioning or negotiate higher rate.`;
    default:
      return 'Unable to provide recommendation';
  }
}

/**
 * Sprint 6: DH-O Optimized Load Search
 * Find loads near truck's current location with minimal deadhead
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { findLoadsWithMinimalDHO } from '@/lib/deadheadOptimization';

// GET /api/trucks/[id]/nearby-loads - Find loads with minimal DH-O
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: truckId } = await params;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const maxDHO = parseInt(searchParams.get('maxDHO') || '200', 10); // km
    const truckType = searchParams.get('truckType') || undefined;
    const minTripKm = searchParams.get('minTripKm')
      ? parseFloat(searchParams.get('minTripKm')!)
      : undefined;
    const maxTripKm = searchParams.get('maxTripKm')
      ? parseFloat(searchParams.get('maxTripKm')!)
      : undefined;
    const pickupAfter = searchParams.get('pickupAfter')
      ? new Date(searchParams.get('pickupAfter')!)
      : undefined;
    const pickupBefore = searchParams.get('pickupBefore')
      ? new Date(searchParams.get('pickupBefore')!)
      : undefined;

    // Find loads with minimal DH-O
    const loads = await findLoadsWithMinimalDHO(truckId, maxDHO, {
      truckType,
      minTripKm,
      maxTripKm,
      pickupAfter,
      pickupBefore,
    });

    return NextResponse.json({
      truckId,
      maxDHO,
      loads,
      count: loads.length,
      filters: {
        maxDHO,
        truckType,
        minTripKm,
        maxTripKm,
        pickupAfter,
        pickupBefore,
      },
    });

  } catch (error) {
    console.error('Nearby loads error:', error);
    return NextResponse.json(
      { error: 'Failed to find nearby loads' },
      { status: 500 }
    );
  }
}

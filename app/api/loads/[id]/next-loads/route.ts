/**
 * Sprint 6: DH-D Optimized Load Chaining
 * Find next loads from current load's delivery location with minimal deadhead
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { findNextLoadsWithMinimalDHD } from '@/lib/deadheadOptimization';

// GET /api/loads/[id]/next-loads - Find next loads with minimal DH-D
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: loadId } = await params;

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    const maxDHD = parseInt(searchParams.get('maxDHD') || '200', 10); // km
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

    // Find next loads with minimal DH-D
    const nextLoads = await findNextLoadsWithMinimalDHD(loadId, maxDHD, {
      truckType,
      minTripKm,
      maxTripKm,
      pickupAfter,
    });

    return NextResponse.json({
      currentLoadId: loadId,
      maxDHD,
      nextLoads,
      count: nextLoads.length,
      filters: {
        maxDHD,
        truckType,
        minTripKm,
        maxTripKm,
        pickupAfter,
      },
    });

  } catch (error) {
    console.error('Next loads error:', error);
    return NextResponse.json(
      { error: 'Failed to find next loads' },
      { status: 500 }
    );
  }
}

/**
 * Sprint 6: DH-O Optimized Load Search
 * Find loads near truck's current location with minimal deadhead
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

    // Verify truck exists and user has permission
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: { id: true, carrierId: true },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    // Get user's organization for access control
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    // Only truck owner or admin can access nearby loads
    const canAccess =
      user?.role === 'SUPER_ADMIN' ||
      user?.role === 'ADMIN' ||
      truck.carrierId === user?.organizationId;

    if (!canAccess) {
      return NextResponse.json(
        { error: 'You do not have permission to access this truck\'s nearby loads' },
        { status: 403 }
      );
    }

    // Parse query parameters with validation
    const { searchParams } = new URL(request.url);

    // Parse and validate maxDHO (1-2000 km range)
    const maxDHORaw = parseInt(searchParams.get('maxDHO') || '200', 10);
    const maxDHO = isNaN(maxDHORaw) ? 200 : Math.max(1, Math.min(maxDHORaw, 2000));

    const truckType = searchParams.get('truckType') || undefined;

    // Parse and validate trip distances (positive values only)
    const minTripKmRaw = searchParams.get('minTripKm')
      ? parseFloat(searchParams.get('minTripKm')!)
      : undefined;
    const minTripKm = minTripKmRaw !== undefined && !isNaN(minTripKmRaw) && minTripKmRaw >= 0
      ? minTripKmRaw
      : undefined;

    const maxTripKmRaw = searchParams.get('maxTripKm')
      ? parseFloat(searchParams.get('maxTripKm')!)
      : undefined;
    const maxTripKm = maxTripKmRaw !== undefined && !isNaN(maxTripKmRaw) && maxTripKmRaw >= 0
      ? maxTripKmRaw
      : undefined;

    // Validate minTripKm <= maxTripKm if both provided
    if (minTripKm !== undefined && maxTripKm !== undefined && minTripKm > maxTripKm) {
      return NextResponse.json(
        { error: 'minTripKm must be less than or equal to maxTripKm' },
        { status: 400 }
      );
    }

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

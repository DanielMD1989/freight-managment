/**
 * Matching Trucks API
 *
 * GET /api/loads/[id]/matching-trucks
 * Find trucks that match a specific load
 *
 * Sprint 15 - Story 15.8: Match Calculation
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { findMatchingTrucks } from '@/lib/matchingEngine';

/**
 * GET /api/loads/[id]/matching-trucks
 * Find trucks that match the specified load
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    const minScore = parseInt(searchParams.get('minScore') || '50');
    const limit = parseInt(searchParams.get('limit') || '50');

    // Fetch the load with assignedTruckId for carrier authorization check
    const load = await db.load.findUnique({
      where: { id },
      select: {
        id: true,
        shipperId: true,
        assignedTruckId: true,
        pickupCity: true,
        deliveryCity: true,
        pickupDate: true,
        truckType: true,
        weight: true,
        lengthM: true,
        fullPartial: true,
      },
    });

    if (!load) {
      return NextResponse.json(
        { error: 'Load not found' },
        { status: 404 }
      );
    }

    // H15 FIX: Proper authorization - shipper, assigned carrier, dispatcher, or admin
    const isShipper = load.shipperId === user.organizationId;
    const isAssignedCarrier = load.assignedTruckId
      ? await db.truck.findUnique({
          where: { id: load.assignedTruckId },
          select: { carrierId: true },
        }).then((t) => t?.carrierId === user.organizationId)
      : false;
    const isDispatcher = user.role === 'DISPATCHER';
    const isAdmin = user.role === 'ADMIN' || user.role === 'SUPER_ADMIN';

    if (!isShipper && !isAssignedCarrier && !isDispatcher && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to view matching trucks for this load' },
        { status: 403 }
      );
    }

    // Verify load has required fields for matching
    if (!load.pickupCity || !load.deliveryCity || !load.truckType) {
      return NextResponse.json(
        { error: 'Load missing required fields for matching' },
        { status: 400 }
      );
    }

    // Fetch all active truck postings
    const trucks = await db.truckPosting.findMany({
      where: {
        status: 'ACTIVE',
      },
      include: {
        carrier: {
          select: {
            id: true,
            name: true,
            isVerified: true,
            contactPhone: true,
            contactEmail: true,
          },
        },
        originCity: {
          select: {
            name: true,
          },
        },
        destinationCity: {
          select: {
            name: true,
          },
        },
        truck: {
          select: {
            id: true,
            truckType: true,
            capacity: true,
            lengthM: true,
            licensePlate: true,
          },
        },
      },
      take: 500, // Limit initial fetch
    });

    // Calculate matches
    const loadCriteria = {
      pickupCity: load.pickupCity,
      deliveryCity: load.deliveryCity,
      pickupDate: load.pickupDate,
      truckType: load.truckType,
      weight: load.weight ? Number(load.weight) : null,
      lengthM: load.lengthM ? Number(load.lengthM) : null,
      fullPartial: load.fullPartial,
    };

    const trucksCriteria = trucks.map(truck => ({
      id: truck.id,
      currentCity: truck.originCity?.name || '',
      destinationCity: truck.destinationCity?.name || null,
      availableDate: truck.availableFrom,
      truckType: truck.truck?.truckType || '',
      maxWeight: truck.availableWeight ? Number(truck.availableWeight) : null,
      lengthM: truck.availableLength ? Number(truck.availableLength) : null,
      fullPartial: truck.fullPartial,
      carrier: truck.carrier,
      contactName: truck.contactName,
      contactPhone: truck.contactPhone,
      createdAt: truck.createdAt,
      status: truck.status,
    }));

    const matchedTrucks = findMatchingTrucks(loadCriteria, trucksCriteria, minScore)
      .slice(0, limit)
      .map((truck: any) => ({
        ...truck,
        // Include full truck object
        ...trucks.find(t => t.id === truck.id),
      }));

    return NextResponse.json({
      trucks: matchedTrucks,
      total: matchedTrucks.length,
      exactMatches: matchedTrucks.filter(t => t.isExactMatch).length,
    });
  } catch (error: any) {
    console.error('Matching trucks error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to find matching trucks' },
      { status: 500 }
    );
  }
}

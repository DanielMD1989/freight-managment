/**
 * Map Loads API
 *
 * Get posted loads for map visualization and matching
 * MAP + GPS Implementation
 *
 * GET /api/map/loads - Get loads for map display
 *
 * Query Parameters:
 * - status: Filter by load status (default: POSTED)
 * - cargoType: Filter by cargo type
 * - minWeight: Minimum weight filter
 * - maxWeight: Maximum weight filter
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { Prisma } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const status = searchParams.get('status') || 'POSTED';
    const cargoType = searchParams.get('cargoType');
    const minWeight = searchParams.get('minWeight');
    const maxWeight = searchParams.get('maxWeight');

    const role = session.role;

    // Only Admin, Dispatcher, and Carriers can view posted loads on map
    if (!['ADMIN', 'SUPER_ADMIN', 'DISPATCHER', 'CARRIER'].includes(role)) {
      return NextResponse.json({ loads: [] });
    }

    // Build where clause
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {
      status,
      // Only loads with location data
      originLat: { not: null },
      originLon: { not: null },
    };

    // Cargo type filter
    if (cargoType) {
      where.cargoType = cargoType;
    }

    // Weight filters
    if (minWeight || maxWeight) {
      where.weight = {};
      if (minWeight) {
        where.weight.gte = parseFloat(minWeight);
      }
      if (maxWeight) {
        where.weight.lte = parseFloat(maxWeight);
      }
    }

    // Fetch loads
    const loads = await db.load.findMany({
      where,
      select: {
        id: true,
        status: true,
        cargoDescription: true,
        weight: true,
        lengthM: true,
        volume: true,
        pickupCity: true,
        pickupAddress: true,
        originLat: true,
        originLon: true,
        deliveryCity: true,
        deliveryAddress: true,
        destinationLat: true,
        destinationLon: true,
        pickupDate: true,
        deliveryDate: true,
        truckType: true,
        shipper: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 200, // Limit for performance
    });

    // Transform for map display
    const mapLoads = loads.map((load) => ({
      id: load.id,
      status: load.status,
      cargoType: load.cargoDescription,
      weight: Number(load.weight),
      truckType: load.truckType,
      pickupLocation: {
        lat: Number(load.originLat),
        lng: Number(load.originLon),
        address: load.pickupAddress || load.pickupCity || 'Unknown',
        city: load.pickupCity,
      },
      deliveryLocation: load.destinationLat && load.destinationLon ? {
        lat: Number(load.destinationLat),
        lng: Number(load.destinationLon),
        address: load.deliveryAddress || load.deliveryCity || 'Unknown',
        city: load.deliveryCity,
      } : null,
      pickupDate: load.pickupDate?.toISOString(),
      deliveryDate: load.deliveryDate?.toISOString(),
      shipper: {
        id: load.shipper?.id,
        name: load.shipper?.name,
      },
    }));

    return NextResponse.json({
      loads: mapLoads,
      total: mapLoads.length,
    });
  } catch (error) {
    console.error('Map loads API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * Sprint 6: Truck Location Management
 * Update and retrieve truck current location for DH-O calculations
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';
import { getTruckCurrentLocation } from '@/lib/deadheadOptimization';

const updateLocationSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  currentCity: z.string().optional(),
  currentRegion: z.string().optional(),
});

// PATCH /api/trucks/[id]/location - Update truck location
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: truckId } = await params;

    const body = await request.json();
    const { latitude, longitude, currentCity, currentRegion } = updateLocationSchema.parse(body);

    // Get truck to check ownership
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: {
        id: true,
        carrierId: true,
      },
    });

    if (!truck) {
      return NextResponse.json(
        { error: 'Truck not found' },
        { status: 404 }
      );
    }

    // Permission check: Only carrier who owns truck or admin
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    const isOwner = user?.organizationId === truck.carrierId;
    const isAdmin = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json(
        { error: 'You do not have permission to update this truck location' },
        { status: 403 }
      );
    }

    // Update truck location
    const updatedTruck = await db.truck.update({
      where: { id: truckId },
      data: {
        currentLocationLat: latitude,
        currentLocationLon: longitude,
        currentCity: currentCity || undefined,
        currentRegion: currentRegion || undefined,
        locationUpdatedAt: new Date(),
      },
      select: {
        id: true,
        licensePlate: true,
        currentLocationLat: true,
        currentLocationLon: true,
        currentCity: true,
        currentRegion: true,
        locationUpdatedAt: true,
      },
    });

    return NextResponse.json({
      message: 'Truck location updated successfully',
      truck: updatedTruck,
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.issues },
        { status: 400 }
      );
    }

    console.error('Update truck location error:', error);
    return NextResponse.json(
      { error: 'Failed to update truck location' },
      { status: 500 }
    );
  }
}

// GET /api/trucks/[id]/location - Get truck current location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth();
    const { id: truckId } = await params;

    // Get truck location (from GPS or database)
    const location = await getTruckCurrentLocation(truckId);

    if (!location) {
      return NextResponse.json(
        { error: 'Truck location not available' },
        { status: 404 }
      );
    }

    // Get truck details
    const truck = await db.truck.findUnique({
      where: { id: truckId },
      select: {
        id: true,
        licensePlate: true,
        currentCity: true,
        currentRegion: true,
        locationUpdatedAt: true,
      },
    });

    return NextResponse.json({
      truckId,
      location: {
        latitude: location.latitude,
        longitude: location.longitude,
        source: location.source,
        timestamp: location.timestamp || truck?.locationUpdatedAt,
        city: truck?.currentCity,
        region: truck?.currentRegion,
      },
    });

  } catch (error) {
    console.error('Get truck location error:', error);
    return NextResponse.json(
      { error: 'Failed to get truck location' },
      { status: 500 }
    );
  }
}

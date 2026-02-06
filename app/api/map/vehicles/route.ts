/**
 * Map Vehicles API
 *
 * Get vehicles/trucks for map visualization with role-based filtering
 * MAP + GPS Implementation
 *
 * GET /api/map/vehicles - Get vehicles for map display
 *
 * Query Parameters:
 * - status: Filter by truck status
 * - truckType: Filter by truck type
 * - includeAll: Include all vehicles (admin only)
 * - carrierId: Filter by carrier (admin/dispatcher only)
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const status = searchParams.get('status');
    const truckType = searchParams.get('truckType');
    const includeAll = searchParams.get('includeAll') === 'true';
    const carrierId = searchParams.get('carrierId');

    // Build where clause based on role
    const where: any = {};

    const role = session.role;

    if (role === 'CARRIER') {
      // Carrier can only see their own trucks
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        return NextResponse.json({ vehicles: [] });
      }

      where.carrierId = user.organizationId;
    } else if (role === 'SHIPPER') {
      // Shippers cannot see vehicles directly (only through trips)
      return NextResponse.json({ vehicles: [] });
    } else if (role === 'DISPATCHER' || role === 'ADMIN' || role === 'SUPER_ADMIN') {
      // Admin/Dispatcher can see all vehicles
      if (carrierId) {
        where.carrierId = carrierId;
      }
    } else {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Truck type filter
    if (truckType) {
      where.truckType = truckType;
    }

    // Only available trucks by default (unless includeAll)
    // Note: We don't filter by isAvailable to show all trucks on map

    // Fetch trucks
    const trucks = await db.truck.findMany({
      where,
      select: {
        id: true,
        licensePlate: true,
        truckType: true,
        capacity: true,
        isAvailable: true,
        currentLocationLat: true,
        currentLocationLon: true,
        locationUpdatedAt: true,
        gpsStatus: true,
        gpsLastSeenAt: true,
        carrier: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: 'desc',
      },
      take: 500, // Limit for performance
    });

    // Determine GPS status for each truck
    // Valid GpsDeviceStatus: ACTIVE, INACTIVE, SIGNAL_LOST, MAINTENANCE
    const now = new Date();
    const OFFLINE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutes

    const vehicles = trucks.map((truck) => {
      // Map to valid GpsDeviceStatus enum values
      let computedGpsStatus: 'ACTIVE' | 'INACTIVE' | 'SIGNAL_LOST' = 'INACTIVE';

      if (truck.currentLocationLat && truck.currentLocationLon) {
        if (truck.locationUpdatedAt) {
          const lastUpdate = new Date(truck.locationUpdatedAt);
          const timeDiff = now.getTime() - lastUpdate.getTime();
          // ACTIVE = recent position, SIGNAL_LOST = stale position
          computedGpsStatus = timeDiff < OFFLINE_THRESHOLD_MS ? 'ACTIVE' : 'SIGNAL_LOST';
        } else {
          computedGpsStatus = 'SIGNAL_LOST';
        }
      }

      return {
        id: truck.id,
        plateNumber: truck.licensePlate,
        truckType: truck.truckType,
        capacity: Number(truck.capacity),
        // truckAvailability is a display field, not LoadStatus
        truckAvailability: truck.isAvailable ? 'available' : 'busy',
        isActive: truck.isAvailable,
        gpsStatus: computedGpsStatus,
        currentLocation: truck.currentLocationLat && truck.currentLocationLon ? {
          lat: Number(truck.currentLocationLat),
          lng: Number(truck.currentLocationLon),
          updatedAt: truck.locationUpdatedAt?.toISOString(),
        } : null,
        carrier: {
          id: truck.carrier?.id,
          name: truck.carrier?.name,
        },
      };
    });

    return NextResponse.json({
      vehicles,
      total: vehicles.length,
      stats: {
        total: vehicles.length,
        // GPS status using valid GpsDeviceStatus enum values
        gpsActive: vehicles.filter((v) => v.gpsStatus === 'ACTIVE').length,
        gpsSignalLost: vehicles.filter((v) => v.gpsStatus === 'SIGNAL_LOST').length,
        gpsInactive: vehicles.filter((v) => v.gpsStatus === 'INACTIVE').length,
        // Availability status
        available: vehicles.filter((v) => v.truckAvailability === 'available').length,
        busy: vehicles.filter((v) => v.truckAvailability === 'busy').length,
      },
    });
  } catch (error) {
    console.error('Map vehicles API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GPS Live Position API
 *
 * GET /api/gps/live - Get live GPS positions for active trips
 *
 * Query params:
 * - loadId: Get live position for a specific load/trip
 * - truckIds: Comma-separated truck IDs to get positions for
 *
 * This endpoint is optimized for frequent polling and returns minimal data.
 *
 * MAP + GPS Implementation - Phase 2
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const loadId = searchParams.get('loadId');
    const truckIds = searchParams.get('truckIds')?.split(',').filter(Boolean);

    // Get user's organization for access control
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true },
    });

    // If loadId is provided, get live position for that specific trip
    if (loadId) {
      const load = await db.load.findUnique({
        where: { id: loadId },
        select: {
          id: true,
          status: true,
          organizationId: true,
          assignedTruck: {
            select: {
              id: true,
              licensePlate: true,
              truckType: true,
              currentLocationLat: true,
              currentLocationLon: true,
              locationUpdatedAt: true,
              gpsStatus: true,
              carrierId: true,
            },
          },
        },
      });

      if (!load) {
        return NextResponse.json({ error: 'Load not found' }, { status: 404 });
      }

      // Access control
      if (session.role === 'CARRIER') {
        if (load.assignedTruck?.carrierId !== user?.organizationId) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }
      } else if (session.role === 'SHIPPER') {
        if (load.organizationId !== user?.organizationId) {
          return NextResponse.json(
            { error: 'Access denied' },
            { status: 403 }
          );
        }
        // Shipper can only see position when trip is IN_TRANSIT
        if (load.status !== 'IN_TRANSIT') {
          return NextResponse.json({
            loadId: load.id,
            status: load.status,
            position: null,
            message: 'GPS tracking is only available when trip is IN_TRANSIT',
          });
        }
      }

      const truck = load.assignedTruck;
      if (!truck) {
        return NextResponse.json({
          loadId: load.id,
          status: load.status,
          position: null,
          message: 'No truck assigned to this load',
        });
      }

      return NextResponse.json({
        loadId: load.id,
        status: load.status,
        truck: {
          id: truck.id,
          plateNumber: truck.licensePlate,
          truckType: truck.truckType,
        },
        position: truck.currentLocationLat && truck.currentLocationLon ? {
          lat: Number(truck.currentLocationLat),
          lng: Number(truck.currentLocationLon),
          updatedAt: truck.locationUpdatedAt?.toISOString(),
          gpsStatus: truck.gpsStatus || 'UNKNOWN',
        } : null,
      });
    }

    // If truckIds are provided, get positions for multiple trucks
    if (truckIds && truckIds.length > 0) {
      // Build where clause based on role
      const where: any = {
        id: { in: truckIds },
      };

      if (session.role === 'CARRIER') {
        where.carrierId = user?.organizationId;
      } else if (session.role === 'SHIPPER') {
        // Shipper can only get positions for trucks on their loads
        const activeLoads = await db.load.findMany({
          where: {
            organizationId: user?.organizationId,
            status: 'IN_TRANSIT',
            assignedTruckId: { in: truckIds },
          },
          select: { assignedTruckId: true },
        });

        const allowedTruckIds = activeLoads
          .map((l) => l.assignedTruckId)
          .filter(Boolean) as string[];

        if (allowedTruckIds.length === 0) {
          return NextResponse.json({ positions: [] });
        }

        where.id = { in: allowedTruckIds };
      }
      // Admin/Dispatcher can access any trucks

      const trucks = await db.truck.findMany({
        where,
        select: {
          id: true,
          licensePlate: true,
          truckType: true,
          currentLocationLat: true,
          currentLocationLon: true,
          locationUpdatedAt: true,
          gpsStatus: true,
        },
      });

      const positions = trucks.map((truck) => ({
        truckId: truck.id,
        plateNumber: truck.licensePlate,
        truckType: truck.truckType,
        position: truck.currentLocationLat && truck.currentLocationLon ? {
          lat: Number(truck.currentLocationLat),
          lng: Number(truck.currentLocationLon),
          updatedAt: truck.locationUpdatedAt?.toISOString(),
          gpsStatus: truck.gpsStatus || 'UNKNOWN',
        } : null,
      }));

      return NextResponse.json({ positions });
    }

    // If no specific query, return all active trips for the user's context
    const activeLoadsWhere: any = {
      status: 'IN_TRANSIT',
      assignedTruckId: { not: null },
    };

    if (session.role === 'CARRIER') {
      activeLoadsWhere.assignedTruck = {
        carrierId: user?.organizationId,
      };
    } else if (session.role === 'SHIPPER') {
      activeLoadsWhere.organizationId = user?.organizationId;
    }
    // Admin/Dispatcher see all active trips

    const activeLoads = await db.load.findMany({
      where: activeLoadsWhere,
      select: {
        id: true,
        referenceNumber: true,
        status: true,
        assignedTruck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
            currentLocationLat: true,
            currentLocationLon: true,
            locationUpdatedAt: true,
            gpsStatus: true,
          },
        },
      },
      take: 100, // Limit for performance
    });

    const liveTrips = activeLoads.map((load) => ({
      loadId: load.id,
      referenceNumber: load.referenceNumber,
      status: load.status,
      truck: load.assignedTruck ? {
        id: load.assignedTruck.id,
        plateNumber: load.assignedTruck.licensePlate,
        truckType: load.assignedTruck.truckType,
      } : null,
      position: load.assignedTruck?.currentLocationLat && load.assignedTruck?.currentLocationLon ? {
        lat: Number(load.assignedTruck.currentLocationLat),
        lng: Number(load.assignedTruck.currentLocationLon),
        updatedAt: load.assignedTruck.locationUpdatedAt?.toISOString(),
        gpsStatus: load.assignedTruck.gpsStatus || 'UNKNOWN',
      } : null,
    }));

    return NextResponse.json({
      trips: liveTrips,
      count: liveTrips.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('GPS live position error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

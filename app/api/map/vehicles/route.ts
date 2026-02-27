/**
 * Map Vehicles API
 *
 * Get vehicles/trucks for map visualization with role-based filtering.
 *
 * USES SHARED TYPE CONTRACT: lib/types/vehicle.ts
 * - VehicleMapData: Shape of each vehicle
 * - VehicleMapStats: Shape of stats object
 * - VehicleMapResponse: Complete response shape
 *
 * GET /api/map/vehicles - Get vehicles for map display
 *
 * Query Parameters:
 * - status: Filter by truck status
 * - truckType: Filter by truck type
 * - includeAll: Include all vehicles (admin only)
 * - carrierId: Filter by carrier (admin/dispatcher only)
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import {
  VehicleMapData,
  VehicleMapStats,
  VehicleMapResponse,
  GpsDisplayStatus,
  TruckAvailabilityStatus,
  mapGpsStatus,
  mapTruckStatus,
} from "@/lib/types/vehicle";

/** Threshold for considering GPS data stale (15 minutes) */
const GPS_OFFLINE_THRESHOLD_MS = 15 * 60 * 1000;

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
    const truckType = searchParams.get("truckType");
    const carrierId = searchParams.get("carrierId");

    // Build where clause based on role
    const where: Record<string, unknown> = {};

    const role = session.role;

    if (role === "CARRIER") {
      // Carrier can only see their own trucks
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        const emptyResponse: VehicleMapResponse = {
          vehicles: [],
          total: 0,
          stats: {
            total: 0,
            active: 0,
            offline: 0,
            noDevice: 0,
            available: 0,
            inTransit: 0,
          },
        };
        return NextResponse.json(emptyResponse);
      }

      where.carrierId = user.organizationId;
    } else if (role === "SHIPPER") {
      // Shippers cannot see vehicles directly (only through trips)
      const emptyResponse: VehicleMapResponse = {
        vehicles: [],
        total: 0,
        stats: {
          total: 0,
          active: 0,
          offline: 0,
          noDevice: 0,
          available: 0,
          inTransit: 0,
        },
      };
      return NextResponse.json(emptyResponse);
    } else if (
      role === "DISPATCHER" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN"
    ) {
      // Admin/Dispatcher can see all vehicles
      if (carrierId) {
        where.carrierId = carrierId;
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Status filter
    if (status) {
      where.isAvailable = status === "AVAILABLE";
    }

    // Truck type filter
    if (truckType) {
      where.truckType = truckType;
    }

    // Fetch trucks from database
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
        updatedAt: "desc",
      },
      take: 500, // Limit for performance
    });

    const now = new Date();

    // Transform database records to VehicleMapData using shared type contract
    const vehicles: VehicleMapData[] = trucks.map((truck) => {
      // Determine if truck has GPS location data
      const hasLocation = !!(
        truck.currentLocationLat && truck.currentLocationLon
      );

      // Determine if GPS data is recent (within threshold)
      let isRecent = false;
      if (hasLocation && truck.locationUpdatedAt) {
        const lastUpdate = new Date(truck.locationUpdatedAt);
        const timeDiff = now.getTime() - lastUpdate.getTime();
        isRecent = timeDiff < GPS_OFFLINE_THRESHOLD_MS;
      }

      // Use helper functions from shared types
      const gpsStatus: GpsDisplayStatus = mapGpsStatus(
        truck.gpsStatus,
        hasLocation,
        isRecent
      );
      const truckStatus: TruckAvailabilityStatus = mapTruckStatus(
        truck.isAvailable
      );

      // Build VehicleMapData object matching the type contract exactly
      const vehicleData: VehicleMapData = {
        id: truck.id,
        plateNumber: truck.licensePlate,
        truckType: truck.truckType,
        capacity: Number(truck.capacity),
        status: truckStatus,
        isAvailable: truck.isAvailable,
        gpsStatus: gpsStatus,
        currentLocation: hasLocation
          ? {
              lat: Number(truck.currentLocationLat),
              lng: Number(truck.currentLocationLon),
              updatedAt: truck.locationUpdatedAt?.toISOString(),
            }
          : null,
        carrier: {
          id: truck.carrier?.id ?? "",
          name: truck.carrier?.name ?? "Unknown",
        },
      };

      return vehicleData;
    });

    // Calculate stats matching VehicleMapStats type contract exactly
    const stats: VehicleMapStats = {
      total: vehicles.length,
      active: vehicles.filter((v) => v.gpsStatus === "ACTIVE").length,
      offline: vehicles.filter((v) => v.gpsStatus === "OFFLINE").length,
      noDevice: vehicles.filter((v) => v.gpsStatus === "NO_DEVICE").length,
      available: vehicles.filter((v) => v.status === "AVAILABLE").length,
      inTransit: vehicles.filter((v) => v.status === "IN_TRANSIT").length,
    };

    // Build response matching VehicleMapResponse type contract exactly
    const response: VehicleMapResponse = {
      vehicles,
      total: vehicles.length,
      stats,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Map vehicles API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

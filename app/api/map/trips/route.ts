/**
 * Map Trips API
 *
 * Get trips for map visualization with role-based filtering
 * MAP + GPS Implementation
 *
 * GET /api/map/trips - Get trips for map display
 *
 * Query Parameters:
 * - status: Filter by trip status (IN_TRANSIT, COMPLETED, etc.)
 * - role: Force role filter (shipper, carrier)
 * - carrierId: Filter by carrier (admin/dispatcher only)
 * - shipperId: Filter by shipper (admin/dispatcher only)
 * - dateFrom: Filter by start date
 * - dateTo: Filter by end date
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = request.nextUrl;

    const status = searchParams.get("status");
    const roleFilter = searchParams.get("role");
    const carrierId = searchParams.get("carrierId");
    const shipperId = searchParams.get("shipperId");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build where clause based on role
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: Record<string, any> = {};

    // Role-based access control
    const role = session.role;

    if (role === "CARRIER") {
      // Carrier can only see their own trips
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        return NextResponse.json({ trips: [] });
      }

      // Find loads assigned to carrier's trucks
      where.assignedTruck = {
        carrierId: user.organizationId,
      };
    } else if (role === "SHIPPER" || roleFilter === "shipper") {
      // Shipper can only see their own loads that are IN_TRANSIT
      const user = await db.user.findUnique({
        where: { id: session.userId },
        select: { organizationId: true },
      });

      if (!user?.organizationId) {
        return NextResponse.json({ trips: [] });
      }

      where.shipperId = user.organizationId;
      // Only show trips that are approved and in transit
      where.status = { in: ["IN_TRANSIT", "DELIVERED"] };
      where.assignedTruckId = { not: null };
    } else if (
      role === "DISPATCHER" ||
      role === "ADMIN" ||
      role === "SUPER_ADMIN"
    ) {
      // Admin/Dispatcher can see all trips
      if (carrierId) {
        where.assignedTruck = {
          carrierId: carrierId,
        };
      }
      if (shipperId) {
        where.shipperId = shipperId;
      }
    } else {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Status filter
    if (status) {
      where.status = status;
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.updatedAt = {};
      if (dateFrom) {
        where.updatedAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.updatedAt.lte = new Date(dateTo);
      }
    }

    // Only get loads with assigned trucks (these are "trips")
    if (!where.assignedTruckId) {
      where.assignedTruckId = { not: null };
    }

    // Fetch loads that represent trips
    const loads = await db.load.findMany({
      where,
      select: {
        id: true,
        status: true,
        pickupCity: true,
        pickupAddress: true,
        originLat: true,
        originLon: true,
        deliveryCity: true,
        deliveryAddress: true,
        destinationLat: true,
        destinationLon: true,
        createdAt: true,
        updatedAt: true,
        assignedTruck: {
          select: {
            id: true,
            licensePlate: true,
            truckType: true,
            currentLocationLat: true,
            currentLocationLon: true,
            locationUpdatedAt: true,
            carrier: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        shipper: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 100, // Limit for performance
    });

    // Transform to trip format for map
    const trips = loads.map((load) => ({
      id: load.id,
      loadId: load.id,
      status: load.status,
      truck: load.assignedTruck
        ? {
            id: load.assignedTruck.id,
            plateNumber: load.assignedTruck.licensePlate,
            truckType: load.assignedTruck.truckType,
          }
        : null,
      carrier: load.assignedTruck?.carrier
        ? {
            id: load.assignedTruck.carrier.id,
            name: load.assignedTruck.carrier.name,
          }
        : null,
      shipper: {
        id: load.shipper?.id,
        name: load.shipper?.name,
      },
      // Current location comes from the assigned truck's GPS
      currentLocation:
        load.assignedTruck?.currentLocationLat &&
        load.assignedTruck?.currentLocationLon
          ? {
              lat: Number(load.assignedTruck.currentLocationLat),
              lng: Number(load.assignedTruck.currentLocationLon),
              updatedAt: load.assignedTruck.locationUpdatedAt?.toISOString(),
            }
          : null,
      pickupLocation:
        load.originLat && load.originLon
          ? {
              lat: Number(load.originLat),
              lng: Number(load.originLon),
              address: load.pickupAddress || load.pickupCity || "Unknown",
            }
          : null,
      deliveryLocation:
        load.destinationLat && load.destinationLon
          ? {
              lat: Number(load.destinationLat),
              lng: Number(load.destinationLon),
              address: load.deliveryAddress || load.deliveryCity || "Unknown",
            }
          : null,
      startedAt: null, // Would need to track this separately
      completedAt:
        load.status === "COMPLETED" ? load.updatedAt?.toISOString() : null,
    }));

    return NextResponse.json({
      trips,
      total: trips.length,
    });
  } catch (error) {
    console.error("Map trips API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

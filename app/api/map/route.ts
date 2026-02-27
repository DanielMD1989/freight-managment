/**
 * Map Data API
 *
 * Phase 2 - Task Group 6: Role-filtered Map View
 *
 * Returns map markers and data filtered by user role:
 * - ADMIN/SUPER_ADMIN: Everything (all trucks, loads, trips)
 * - CARRIER: Own fleet & trips
 * - SHIPPER: Own loads & trips
 * - DISPATCHER: Posted trucks & loads (for coordination)
 *
 * All interactions are read-only - no write actions through map.
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

interface MapMarker {
  id: string;
  type: "truck" | "load" | "pickup" | "delivery" | "trip";
  lat: number;
  lon: number;
  title: string;
  subtitle?: string;
  // For trucks: loadStatus is the actual LoadStatus enum (null if no assigned load)
  // truckAvailability is a display field for map styling ('available' | 'busy')
  loadStatus?: string | null;
  truckAvailability?: "available" | "busy";
  // For loads/trips: status is the actual LoadStatus
  status?: string;
  metadata?: Record<string, unknown>;
}

interface MapData {
  markers: MapMarker[];
  routes: Array<{
    id: string;
    origin: { lat: number; lon: number };
    destination: { lat: number; lon: number };
    status: string;
    loadId?: string;
    truckId?: string;
  }>;
  summary: {
    totalTrucks: number;
    totalLoads: number;
    activeTrips: number;
  };
}

/**
 * GET /api/map
 *
 * Returns map data filtered by user role.
 *
 * Query parameters:
 * - type: Filter by marker type (truck, load, trip)
 * - status: Filter by status
 * - bounds: Viewport bounds (format: "minLat,minLon,maxLat,maxLon")
 *
 * Returns: MapData object with markers, routes, and summary
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const typeFilter = searchParams.get("type");
    const statusFilter = searchParams.get("status");
    const boundsParam = searchParams.get("bounds");

    // Parse viewport bounds if provided
    let bounds: {
      minLat: number;
      minLon: number;
      maxLat: number;
      maxLon: number;
    } | null = null;
    if (boundsParam) {
      const [minLat, minLon, maxLat, maxLon] = boundsParam
        .split(",")
        .map(Number);
      if (
        !isNaN(minLat) &&
        !isNaN(minLon) &&
        !isNaN(maxLat) &&
        !isNaN(maxLon)
      ) {
        bounds = { minLat, minLon, maxLat, maxLon };
      }
    }

    // Get user details
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { organizationId: true, role: true },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const markers: MapMarker[] = [];
    const routes: MapData["routes"] = [];

    // Build filters based on role
    const isDispatcher = user.role === "DISPATCHER";
    const isCarrier = user.role === "CARRIER";
    const isShipper = user.role === "SHIPPER";

    // =========================================================================
    // TRUCK MARKERS
    // =========================================================================
    if (!typeFilter || typeFilter === "truck") {
      const truckWhere: Record<string, unknown> = {};

      if (isCarrier) {
        // Carrier: Own fleet only
        truckWhere.carrierId = user.organizationId;
      } else if (isDispatcher) {
        // Dispatcher: Only posted trucks (with active postings)
        truckWhere.postings = { some: { status: "ACTIVE" } };
      } else if (isShipper) {
        // Shipper: Only trucks assigned to their loads (in transit)
        truckWhere.assignedLoad = {
          shipperId: user.organizationId,
          status: { in: ["ASSIGNED", "IN_TRANSIT"] },
        };
      }
      // Admin: No filter

      // Get trucks with location data
      const trucks = await db.truck.findMany({
        where: {
          ...truckWhere,
          // Must have location data
          OR: [
            { currentLocationLat: { not: null } },
            { postings: { some: { status: "ACTIVE" } } },
          ],
        },
        select: {
          id: true,
          licensePlate: true,
          truckType: true,
          isAvailable: true,
          currentLocationLat: true,
          currentLocationLon: true,
          currentCity: true,
          gpsStatus: true,
          carrier: { select: { name: true } },
          postings: {
            where: { status: "ACTIVE" },
            select: {
              originCity: {
                select: { name: true, latitude: true, longitude: true },
              },
            },
            take: 1,
          },
          assignedLoad: {
            select: {
              id: true,
              status: true,
              pickupCity: true,
              deliveryCity: true,
            },
          },
        },
        take: 500, // Limit for performance
      });

      for (const truck of trucks) {
        // Get location from GPS or posting origin
        let lat = truck.currentLocationLat
          ? Number(truck.currentLocationLat)
          : null;
        let lon = truck.currentLocationLon
          ? Number(truck.currentLocationLon)
          : null;

        // Fall back to posting origin if no GPS location
        if (!lat && truck.postings[0]?.originCity) {
          lat = Number(truck.postings[0].originCity.latitude);
          lon = Number(truck.postings[0].originCity.longitude);
        }

        if (lat && lon) {
          // Apply viewport bounds filter
          if (
            bounds &&
            (lat < bounds.minLat ||
              lat > bounds.maxLat ||
              lon < bounds.minLon ||
              lon > bounds.maxLon)
          ) {
            continue;
          }

          markers.push({
            id: truck.id,
            type: "truck",
            lat,
            lon,
            title: truck.licensePlate,
            subtitle: truck.truckType,
            // loadStatus is the actual LoadStatus enum (null if no assigned load)
            // truckAvailability is a display-only field for map rendering
            loadStatus: truck.assignedLoad?.status || null,
            truckAvailability: truck.isAvailable ? "available" : "busy",
            metadata: {
              truckType: truck.truckType,
              carrier: truck.carrier?.name,
              gpsStatus: truck.gpsStatus,
              hasActiveLoad: !!truck.assignedLoad,
              loadId: truck.assignedLoad?.id,
            },
          });
        }
      }
    }

    // =========================================================================
    // LOAD MARKERS (Pickup & Delivery points)
    // =========================================================================
    if (
      !typeFilter ||
      typeFilter === "load" ||
      typeFilter === "pickup" ||
      typeFilter === "delivery"
    ) {
      const loadWhere: Record<string, unknown> = {};

      if (isShipper) {
        // Shipper: Own loads only
        loadWhere.shipperId = user.organizationId;
      } else if (isCarrier) {
        // Carrier: Loads assigned to their trucks
        loadWhere.assignedTruck = { carrierId: user.organizationId };
      } else if (isDispatcher) {
        // Dispatcher: Posted/active loads for coordination
        loadWhere.status = {
          in: ["POSTED", "SEARCHING", "OFFERED", "ASSIGNED", "IN_TRANSIT"],
        };
      }
      // Admin: No filter

      // Apply status filter
      if (statusFilter) {
        loadWhere.status = statusFilter;
      }

      const loads = await db.load.findMany({
        where: {
          ...loadWhere,
          // Must have location data
          OR: [{ originLat: { not: null } }, { destinationLat: { not: null } }],
        },
        select: {
          id: true,
          pickupCity: true,
          deliveryCity: true,
          originLat: true,
          originLon: true,
          destinationLat: true,
          destinationLon: true,
          status: true,
          truckType: true,
          weight: true,
          pickupDate: true,
          assignedTruckId: true,
          shipper: { select: { name: true } },
          assignedTruck: { select: { licensePlate: true } },
        },
        take: 500,
      });

      for (const load of loads) {
        // Pickup marker
        if (
          load.originLat &&
          load.originLon &&
          (!typeFilter || typeFilter === "load" || typeFilter === "pickup")
        ) {
          const lat = Number(load.originLat);
          const lon = Number(load.originLon);

          if (
            !bounds ||
            (lat >= bounds.minLat &&
              lat <= bounds.maxLat &&
              lon >= bounds.minLon &&
              lon <= bounds.maxLon)
          ) {
            markers.push({
              id: `${load.id}-pickup`,
              type: "pickup",
              lat,
              lon,
              title: `Pickup: ${load.pickupCity}`,
              subtitle: load.truckType,
              status: load.status,
              metadata: {
                loadId: load.id,
                weight: load.weight,
                pickupDate: load.pickupDate,
                assignedTruck: load.assignedTruck?.licensePlate,
              },
            });
          }
        }

        // Delivery marker
        if (
          load.destinationLat &&
          load.destinationLon &&
          (!typeFilter || typeFilter === "load" || typeFilter === "delivery")
        ) {
          const lat = Number(load.destinationLat);
          const lon = Number(load.destinationLon);

          if (
            !bounds ||
            (lat >= bounds.minLat &&
              lat <= bounds.maxLat &&
              lon >= bounds.minLon &&
              lon <= bounds.maxLon)
          ) {
            markers.push({
              id: `${load.id}-delivery`,
              type: "delivery",
              lat,
              lon,
              title: `Delivery: ${load.deliveryCity}`,
              subtitle: load.truckType,
              status: load.status,
              metadata: {
                loadId: load.id,
                weight: load.weight,
                assignedTruck: load.assignedTruck?.licensePlate,
              },
            });
          }
        }

        // Add route for assigned/in-transit loads
        if (
          load.originLat &&
          load.originLon &&
          load.destinationLat &&
          load.destinationLon
        ) {
          if (load.status === "ASSIGNED" || load.status === "IN_TRANSIT") {
            routes.push({
              id: load.id,
              origin: {
                lat: Number(load.originLat),
                lon: Number(load.originLon),
              },
              destination: {
                lat: Number(load.destinationLat),
                lon: Number(load.destinationLon),
              },
              status: load.status,
              loadId: load.id,
              truckId: load.assignedTruckId || undefined,
            });
          }
        }
      }
    }

    // =========================================================================
    // SUMMARY
    // =========================================================================
    const orgId = user.organizationId;

    const [totalTrucks, totalLoads, activeTrips] = await Promise.all([
      isCarrier && orgId
        ? db.truck.count({ where: { carrierId: orgId } })
        : isShipper
          ? 0
          : db.truck.count(),
      isShipper && orgId
        ? db.load.count({ where: { shipperId: orgId } })
        : isCarrier && orgId
          ? db.load.count({ where: { assignedTruck: { carrierId: orgId } } })
          : db.load.count({
              where: { status: { in: ["POSTED", "ASSIGNED", "IN_TRANSIT"] } },
            }),
      isShipper && orgId
        ? db.load.count({ where: { shipperId: orgId, status: "IN_TRANSIT" } })
        : isCarrier && orgId
          ? db.load.count({
              where: {
                assignedTruck: { carrierId: orgId },
                status: "IN_TRANSIT",
              },
            })
          : db.load.count({ where: { status: "IN_TRANSIT" } }),
    ]);

    const mapData: MapData = {
      markers,
      routes,
      summary: {
        totalTrucks,
        totalLoads,
        activeTrips,
      },
    };

    return NextResponse.json(mapData);
  } catch (error) {
    console.error("Map data error:", error);
    return NextResponse.json(
      { error: "Failed to fetch map data" },
      { status: 500 }
    );
  }
}

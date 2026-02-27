/**
 * Trip API - Main Routes
 *
 * Based on MAP_GPS_USER_STORIES.md specification:
 * - Trip is the core entity for tracking load deliveries
 * - GPS data is trip-centric
 * - Role-based access control
 */

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { TripStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { CacheInvalidation, CacheTTL, cache } from "@/lib/cache";
import { zodErrorResponse } from "@/lib/validation";

const createTripSchema = z.object({
  loadId: z.string().max(50),
  truckId: z.string().max(50),
});

/**
 * GET /api/trips
 *
 * List trips based on user role:
 * - Admin/SuperAdmin/Dispatcher: All trips
 * - Carrier: Only their organization's trips
 * - Shipper: Only their organization's trips (when approved)
 *
 * Supports filtering by:
 * - status: single status or comma-separated statuses (e.g., "ASSIGNED" or "PICKUP_PENDING,IN_TRANSIT")
 */
export async function GET(request: NextRequest) {
  try {
    const session = await requireAuth();
    const { searchParams } = new URL(request.url);

    const statusParam = searchParams.get("status");
    const page = parseInt(searchParams.get("page") || "1");
    // M3 FIX: Add pagination bounds
    const limit = Math.min(
      Math.max(parseInt(searchParams.get("limit") || "100"), 1),
      200
    ); // Higher default for UI
    const skip = (page - 1) * limit;

    // PHASE 4: Build cache key from filter parameters
    const cacheKey = `trips:list:${JSON.stringify({
      status: statusParam,
      page,
      limit,
      role: session.role,
      orgId: session.organizationId,
    })}`;

    // Try cache first for admin/dispatcher queries (global view)
    const isCacheableQuery =
      session.role === "ADMIN" ||
      session.role === "SUPER_ADMIN" ||
      session.role === "DISPATCHER";
    if (isCacheableQuery) {
      const cachedResult = await cache.get(cacheKey);
      if (cachedResult) {
        return NextResponse.json(cachedResult);
      }
    }

    // Build where clause based on role
    const whereClause: Prisma.TripWhereInput = {};

    switch (session.role) {
      case "SUPER_ADMIN":
      case "ADMIN":
      case "DISPATCHER":
        // Can see all trips
        break;
      case "CARRIER":
        // Can only see trips for their organization
        whereClause.carrierId = session.organizationId;
        break;
      case "SHIPPER":
        // Can only see trips for their loads
        whereClause.shipperId = session.organizationId;
        break;
      default:
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Add status filter if provided (supports comma-separated values)
    if (statusParam) {
      const statuses = statusParam
        .split(",")
        .map((s) => s.trim()) as TripStatus[];
      if (statuses.length === 1) {
        whereClause.status = statuses[0];
      } else {
        whereClause.status = { in: statuses };
      }
    }

    const [trips, total] = await Promise.all([
      db.trip.findMany({
        where: whereClause,
        include: {
          load: {
            select: {
              id: true,
              pickupCity: true,
              deliveryCity: true,
              cargoDescription: true,
              weight: true,
              truckType: true,
              pickupDate: true,
              deliveryDate: true,
              shipperContactName: true,
              shipperContactPhone: true,
              podSubmitted: true,
              podVerified: true,
            },
          },
          truck: {
            select: {
              id: true,
              licensePlate: true,
              truckType: true,
              contactName: true,
              contactPhone: true,
              capacity: true,
            },
          },
          carrier: {
            select: {
              id: true,
              name: true,
              isVerified: true,
              contactPhone: true,
            },
          },
          shipper: {
            select: {
              id: true,
              name: true,
              contactPhone: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.trip.count({ where: whereClause }),
    ]);

    // Transform trips to include convenience fields from load
    const transformedTrips = trips.map((trip) => ({
      ...trip,
      // Add load fields at top level for convenience
      referenceNumber: `TRIP-${trip.id.slice(-8).toUpperCase()}`,
      weight: trip.load?.weight ? Number(trip.load.weight) : null,
      truckType: trip.load?.truckType || trip.truck?.truckType,
      pickupDate: trip.load?.pickupDate,
      deliveryDate: trip.load?.deliveryDate,
      distance: trip.estimatedDistanceKm
        ? Number(trip.estimatedDistanceKm)
        : null,
    }));

    const response = {
      trips: transformedTrips,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };

    // PHASE 4: Cache the result for cacheable queries
    if (isCacheableQuery) {
      // Cache with short TTL (60 seconds) for active trips - real-time updates
      await cache.set(cacheKey, response, CacheTTL.ACTIVE_TRIP);
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error("List trips error:", error);

    // Handle specific error types
    if (error instanceof Error) {
      if (
        error.message === "Unauthorized" ||
        error.name === "UnauthorizedError"
      ) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (error.name === "ForbiddenError") {
        return NextResponse.json({ error: error.message }, { status: 403 });
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch trips" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips
 *
 * Create a new trip when a load is assigned to a truck.
 * This is typically called from the load assignment logic.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await requireAuth();

    // Only dispatchers and admins should create trips directly
    if (!["ADMIN", "SUPER_ADMIN", "DISPATCHER"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    const validatedData = createTripSchema.parse(body);

    // Get the load details
    const load = await db.load.findUnique({
      where: { id: validatedData.loadId },
      include: {
        shipper: true,
        pickupLocation: true,
        deliveryLocation: true,
      },
    });

    if (!load) {
      return NextResponse.json({ error: "Load not found" }, { status: 404 });
    }

    // Check if trip already exists for this load
    const existingTrip = await db.trip.findUnique({
      where: { loadId: validatedData.loadId },
    });

    if (existingTrip) {
      return NextResponse.json(
        { error: "Trip already exists for this load", trip: existingTrip },
        { status: 400 }
      );
    }

    // Get the truck details
    const truck = await db.truck.findUnique({
      where: { id: validatedData.truckId },
      include: { carrier: true },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // Create the trip
    const trip = await db.trip.create({
      data: {
        loadId: validatedData.loadId,
        truckId: validatedData.truckId,
        carrierId: truck.carrierId,
        shipperId: load.shipperId,
        status: "ASSIGNED",

        // Pickup location
        pickupLat: load.originLat || load.pickupLocation?.latitude,
        pickupLng: load.originLon || load.pickupLocation?.longitude,
        pickupAddress: load.pickupAddress,
        pickupCity: load.pickupCity || load.pickupLocation?.name,

        // Delivery location
        deliveryLat: load.destinationLat || load.deliveryLocation?.latitude,
        deliveryLng: load.destinationLon || load.deliveryLocation?.longitude,
        deliveryAddress: load.deliveryAddress,
        deliveryCity: load.deliveryCity || load.deliveryLocation?.name,

        // Distance
        estimatedDistanceKm: load.estimatedTripKm || load.tripKm,

        // Generate tracking URL
        trackingUrl: `trip-${validatedData.loadId.slice(-8)}-${Date.now().toString(36)}`,
        trackingEnabled: true,
      },
      include: {
        load: true,
        truck: true,
        carrier: true,
        shipper: true,
      },
    });

    // Create load event
    await db.loadEvent.create({
      data: {
        loadId: validatedData.loadId,
        eventType: "TRIP_CREATED",
        description: `Trip created for load ${load.pickupCity} → ${load.deliveryCity}`,
        userId: session.userId,
        metadata: {
          tripId: trip.id,
          truckId: validatedData.truckId,
          carrierId: truck.carrierId,
        },
      },
    });

    // PHASE 4: Invalidate trip and load caches when new trip is created
    await CacheInvalidation.trip(trip.id, truck.carrierId, load.shipperId);
    await CacheInvalidation.allListings();

    return NextResponse.json(
      {
        message: "Trip created successfully",
        trip,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create trip error:", error);

    if (error instanceof z.ZodError) {
      return zodErrorResponse(error);
    }

    return NextResponse.json(
      { error: "Failed to create trip" },
      { status: 500 }
    );
  }
}

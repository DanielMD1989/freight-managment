export const dynamic = "force-dynamic";
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
import { requireActiveUser } from "@/lib/auth";
import { validateCSRFWithMobile } from "@/lib/csrf";
import { TripStatus, Prisma } from "@prisma/client";
import { z } from "zod";
import { CacheInvalidation, CacheTTL, cache } from "@/lib/cache";
import { zodErrorResponse } from "@/lib/validation";
import { handleApiError } from "@/lib/apiErrors";

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
    const session = await requireActiveUser();
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
    // Fix 5b: Use handleApiError for consistent error handling
    return handleApiError(error, "Error fetching trips");
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
    // H5 FIX: Add CSRF protection
    const csrfError = await validateCSRFWithMobile(request);
    if (csrfError) return csrfError;

    // Fix 3f: Require ACTIVE user for trip creation
    const session = await requireActiveUser();

    // Only dispatchers and admins should create trips directly
    if (!["ADMIN", "SUPER_ADMIN", "DISPATCHER"].includes(session.role)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    const body = await request.json();
    // Fix 4c: Use safeParse to avoid leaking schema details
    const parseResult = createTripSchema.safeParse(body);
    if (!parseResult.success) {
      return zodErrorResponse(parseResult.error);
    }
    const validatedData = parseResult.data;

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

    // Get the truck details
    const truck = await db.truck.findUnique({
      where: { id: validatedData.truckId },
      include: { carrier: true },
    });

    if (!truck) {
      return NextResponse.json({ error: "Truck not found" }, { status: 404 });
    }

    // H17 FIX: Wrap trip creation in transaction to prevent duplicates
    const trip = await db.$transaction(async (tx) => {
      // G-M21-9: Clear orphaned cancelled trip loadId so @unique doesn't block re-assignment
      await tx.trip.updateMany({
        where: { loadId: validatedData.loadId, status: "CANCELLED" },
        data: { loadId: null },
      });

      // Check for existing active trip inside transaction
      const existingTrip = await tx.trip.findFirst({
        where: { loadId: validatedData.loadId, status: { not: "CANCELLED" } },
      });
      if (existingTrip) {
        throw new Error("TRIP_ALREADY_EXISTS");
      }

      // Validate load is assignable
      if (!["POSTED", "SEARCHING", "OFFERED"].includes(load.status)) {
        throw new Error("LOAD_NOT_ASSIGNABLE");
      }

      // Validate truck is available and approved
      if (!truck.isAvailable || truck.approvalStatus !== "APPROVED") {
        throw new Error("TRUCK_NOT_AVAILABLE");
      }

      const trip = await tx.trip.create({
        data: {
          loadId: validatedData.loadId,
          truckId: validatedData.truckId,
          carrierId: truck.carrierId,
          shipperId: load.shipperId,
          status: "ASSIGNED",
          pickupLat: load.originLat || load.pickupLocation?.latitude,
          pickupLng: load.originLon || load.pickupLocation?.longitude,
          pickupAddress: load.pickupAddress,
          pickupCity: load.pickupCity || load.pickupLocation?.name,
          deliveryLat: load.destinationLat || load.deliveryLocation?.latitude,
          deliveryLng: load.destinationLon || load.deliveryLocation?.longitude,
          deliveryAddress: load.deliveryAddress,
          deliveryCity: load.deliveryCity || load.deliveryLocation?.name,
          estimatedDistanceKm: load.estimatedTripKm || load.tripKm,
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

      await tx.loadEvent.create({
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

      // US-4.5: Update load, truck, and posting state atomically
      await tx.load.update({
        where: { id: validatedData.loadId },
        data: { status: "ASSIGNED", assignedTruckId: validatedData.truckId },
      });
      await tx.truck.update({
        where: { id: validatedData.truckId },
        data: { isAvailable: false },
      });
      await tx.truckPosting.updateMany({
        where: { truckId: validatedData.truckId, status: "ACTIVE" },
        data: { status: "MATCHED", updatedAt: new Date() },
      });

      return trip;
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
    // Keep specific business error handlers
    if (error instanceof Error && error.message === "TRIP_ALREADY_EXISTS") {
      return NextResponse.json(
        { error: "Trip already exists for this load" },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "LOAD_NOT_ASSIGNABLE") {
      return NextResponse.json(
        {
          error:
            "Load is not in an assignable state (must be POSTED, SEARCHING, or OFFERED)",
        },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === "TRUCK_NOT_AVAILABLE") {
      return NextResponse.json(
        { error: "Truck is not available or not approved" },
        { status: 400 }
      );
    }

    // Fix 5c: Use handleApiError for all other errors (auth, validation, 500s)
    return handleApiError(error, "Error creating trip");
  }
}
